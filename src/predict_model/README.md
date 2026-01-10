# predict_model — LinUCB Package 🔍

A modular implementation of the LinUCB contextual bandit algorithm for task completion prediction.

---

## Package Structure

```
predict_model/
├── linucb/                    # Main LinUCB package
│   ├── __init__.py           # Public API exports
│   ├── model.py              # MultiFeatureLinUCB class
│   ├── features.py           # Feature extraction functions
│   └── constants.py          # Configuration constants
├── multi_feature_linucb.py   # Backward-compatible shim
├── multi_feature_linucb_legacy.py  # Archived monolithic version
├── single_feature_linucb_model.py  # Legacy single-feature model
├── model_service.py          # Flask service wrapper
└── README.md                 # This file
```

---

## Quick Start

```python
from src.predict_model.linucb import MultiFeatureLinUCB

CATEGORIES = ["sport", "study", "work", "home", "health", "other"]

# Create model with priors and excluded categories
model = MultiFeatureLinUCB.create_with_priors(
    categories=CATEGORIES,
    excluded_categories=["other"],      # Won't learn from "other" tasks
    motivation_weight=1.0,              # High motivation → better completion
    difficulty_weights=(0.3, 0.0, -0.3), # Easy → better, hard → worse
)

# Extract features and predict
x = model.extract_features_with_subcategory(
    motivation=4,
    duration=30,
    difficulty=3,
    delta_hours=24,
    category="study",
)

pred_cat = model.predict_category(x)  # Returns 1-5
model.update(x, reward=0.75)          # Learn from outcome
```

---

## Model Creation Options

### Option 1: With Priors (Recommended)

Use `create_with_priors()` factory method for models with domain knowledge:

```python
model = MultiFeatureLinUCB.create_with_priors(
    # Required
    categories=["sport", "study", "work", "home", "health", "other"],
    
    # Prior weights (optional)
    motivation_weight=1.0,               # Positive = high motivation helps
    difficulty_weights=(0.3, 0.0, -0.3), # (easy, medium, hard) weights
    
    # Excluded categories (optional)
    excluded_categories=["other"],       # Categories that won't be learned
    
    # Learning parameters (optional)
    prior_strength=5.0,                  # Prior worth ~5 observations
    learn_rate=0.5,                      # How fast to adapt (0-1)
    alpha=0.1,                           # Exploration bonus
    
    # Category interactions (optional)
    include_category_difficulty_interactions=False,
    include_category_pressure_interactions=False,
    
    # Score thresholds (optional)
    thresholds=(0.2, 0.4, 0.6, 0.8),     # Score → category 1-5
)
```

### Option 2: Without Priors

Create a blank model that learns entirely from data:

```python
from src.predict_model.linucb import MultiFeatureLinUCB, get_feature_count

CATEGORIES = ["sport", "study", "work", "home", "health", "other"]

n_features = get_feature_count(num_categories=len(CATEGORIES))
model = MultiFeatureLinUCB(
    n_features=n_features,
    categories=CATEGORIES,
    alpha=0.1,
)
```

### Option 3: With Category Interactions

Enable interaction features to learn category-specific difficulty/pressure effects:

```python
model = MultiFeatureLinUCB.create_with_priors(
    categories=CATEGORIES,
    include_category_difficulty_interactions=True,   # category × difficulty
    include_category_pressure_interactions=True,     # category × pressure
)
```

This allows the model to learn patterns like:
- "Hard sport tasks are still completable" (different from hard study tasks)
- "Urgent work tasks have different completion rates than urgent home tasks"

---

## Excluded Categories

Use excluded categories for catch-all categories like "other" that contain diverse, unrelated tasks:

```python
model = MultiFeatureLinUCB.create_with_priors(
    categories=["sport", "study", "work", "other"],
    excluded_categories=["other"],  # Won't learn, can't have subcategories
)

# Check if a category is excluded
model.is_excluded_category("other")   # True
model.is_excluded_category("sport")   # False

# Get all excluded categories
model.get_excluded_categories()       # ["other"]

# Excluded categories cannot have subcategories
model.add_subcategory("other", "misc")  # Returns (False, "...excluded...")
```

**Why exclude categories?**
- "Other" contains diverse tasks with no common pattern
- Learning weights for such categories adds noise
- Excluding them focuses learning on meaningful categories

---

## Subcategory Management

Dynamically add/remove subcategories at runtime:

```python
# Add subcategories
model.add_subcategory("sport", "football")    # (True, "Subcategory 'football' added...")
model.add_subcategory("sport", "basketball")  # (True, "Subcategory 'basketball' added...")
model.add_subcategory("study", "math")        # (True, "Subcategory 'math' added...")

# Check subcategories
model.get_subcategories("sport")              # ["football", "basketball"]
model.has_subcategory("sport", "football")    # True
model.get_all_subcategories()                 # {"sport": ["football", "basketball"], "study": ["math"]}

# Remove subcategory
model.remove_subcategory("sport", "basketball")  # (True, "Subcategory removed...")

# Get subcategory info
model.get_subcategory_info("sport", "football")  # {"index": 0, "global_index": 16, "weight": 0.05}

# Extract features with subcategory
x = model.extract_features_with_subcategory(
    motivation=4, duration=30, difficulty=2, delta_hours=24,
    category="sport", subcategory="football"
)
```

**Note:** Excluded categories cannot have subcategories.

---

## Feature Vector Layout

| Index | Feature    | Description                              |
|-------|------------|------------------------------------------|
| 0     | Motivation | Normalized motivation (0-1 from 1-5)     |
| 1-2   | Duration   | [shortness, longness] (complementary)    |
| 3-5   | Difficulty | One-hot [easy, medium, hard]             |
| 6-9   | Pressure   | One-hot [no, mild, strong, urgent]       |
| 10+   | Categories | One-hot encoding (zeros for excluded)    |
| ...   | Subcategories | Dynamic one-hot (if any added)        |
| ...   | Interactions | Optional category×difficulty/pressure |

---

## Tuning Time-Based Features

- **Pressure thresholds** — set in [src/predict_model/linucb/constants.py](src/predict_model/linucb/constants.py). The one-hot pressure feature uses three cutoffs (hours until deadline):
    - `PRESSURE_NO_THRESHOLD` (default 72): > threshold → no pressure
    - `PRESSURE_MILD_THRESHOLD` (default 24): (mild, strong, urgent depend on this and the next)
    - `PRESSURE_STRONG_THRESHOLD` (default 6): > strong → strong; ≤ strong → urgent
    Adjust these values to change when tasks flip between no/mild/strong/urgent. The extractor [src/predict_model/linucb/features.py](src/predict_model/linucb/features.py) uses only these constants—no other code changes needed.

- **Duration scaling** — the shortness/longness pair is normalized by `max_duration` (default `DEFAULT_MAX_DURATION` in [src/predict_model/linucb/constants.py](src/predict_model/linucb/constants.py)).
    - To change globally, edit `DEFAULT_MAX_DURATION` (minutes by default).
    - To change per-call, pass `max_duration` into `extract_duration_features` or via model feature extraction helpers; larger `max_duration` makes the same task look “shorter”, smaller makes it look “longer”.

---

## Prediction & Learning

### Making Predictions

```python
# Extract features
x = model.extract_features_with_subcategory(
    motivation=4,      # 1-5 scale
    duration=30,       # minutes
    difficulty=2,      # 1=easy, 2=medium, 3=hard
    delta_hours=24,    # hours until deadline
    category="study",
    subcategory=None,  # optional
)

# Get prediction
score = model.predict_score(x)      # Raw UCB score (float)
category = model.predict_category(x) # 1-5 completion likelihood
```

### Updating the Model

```python
# After observing task outcome
model.update(x, reward=0.75)  # reward: 0-1 (0=not completed, 1=completed)
```

---

## Inspecting Model Weights

### Category Weights

```python
# Single category
model.get_category_weight("sport")     # 0.15

# All categories
model.get_category_weights_map()       # {"sport": 0.15, "study": 0.22, ...}

# Detailed category info
model.get_category_info("sport")
# {
#     "category": "sport",
#     "feature_index": 10,
#     "weight": 0.15,
#     "is_excluded": False,
#     "subcategories": ["football", "basketball"],
#     "subcategory_weights": {"football": 0.05, "basketball": 0.03}
# }
```

### Feature Weights

```python
# All weights
model.theta  # numpy array of all feature weights

# Specific indices (from constants)
from src.predict_model.linucb import MOTIVATION_INDEX, DIFFICULTY_START_INDEX
model.theta[MOTIVATION_INDEX]           # Motivation weight
model.theta[DIFFICULTY_START_INDEX:DIFFICULTY_START_INDEX+3]  # Difficulty weights
```

---

## Configuration Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `categories` | required | List of category names |
| `excluded_categories` | `None` | Categories to exclude from learning |
| `motivation_weight` | `0.0` | Prior weight for motivation feature |
| `difficulty_weights` | `(0,0,0)` | Prior weights for (easy, medium, hard) |
| `prior_strength` | `5.0` | How strongly to hold priors (~N observations) |
| `learn_rate` | `0.5` | Adaptation speed (0=slow, 1=fast) |
| `alpha` | `0.1` | Exploration bonus (higher=more exploration) |
| `thresholds` | `(0.2,0.4,0.6,0.8)` | Score boundaries for categories 1-5 |
| `include_category_difficulty_interactions` | `False` | Add category×difficulty features |
| `include_category_pressure_interactions` | `False` | Add category×pressure features |

---

## API Reference

### `MultiFeatureLinUCB`

**Factory Methods:**
- `create_with_priors(categories, ...)` — Create model with priors and options

**Prediction:**
- `predict_score(x)` → `float` — UCB score
- `predict_category(x)` → `int` — Category 1-5

**Learning:**
- `update(x, reward)` — Update model with observation

**Feature Extraction:**
- `extract_features_with_subcategory(...)` → `ndarray`

**Category Info:**
- `get_category_weight(category)` → `float`
- `get_category_weights_map()` → `Dict[str, float]`
- `get_category_info(category)` → `Dict`

**Excluded Categories:**
- `is_excluded_category(category)` → `bool`
- `get_excluded_categories()` → `List[str]`

**Subcategory Management:**
- `add_subcategory(category, subcategory)` → `Tuple[bool, str]`
- `remove_subcategory(category, subcategory)` → `Tuple[bool, str]`
- `get_subcategories(category)` → `List[str]`
- `get_all_subcategories()` → `Dict[str, List[str]]`
- `has_subcategory(category, subcategory)` → `bool`
- `get_subcategory_info(category, subcategory)` → `Dict`

---

## Tests

Located in `tests/ml/`:

| File | Description |
|------|-------------|
| `test0_quickstart_model_usage.py` | Quick start demo |
| `test1_multi_feature_learning.py` | Feature-by-feature tests |
| `test2_user_behavior_learning.py` | User type simulations |
| `test3_motivation_difficulty_prior.py` | Prior behavior tests |
| `test4_category_specific_behavior.py` | Category learning tests |
| `test5_unknown_category.py` | Error handling tests |
| `test6_subcategory_learning.py` | Subcategory management tests |
| `test7_excluded_categories.py` | Excluded categories tests |

Run all tests:
```bash
python -m pytest tests/ml/
```

---

## Migration from Old Import

**Old (still works via shim):**
```python
from src.predict_model.multi_feature_linucb import MultiFeatureLinUCB
```

**New (preferred):**
```python
from src.predict_model.linucb import MultiFeatureLinUCB
```
