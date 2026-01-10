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
├── single_feature_linucb_model.py  # Legacy single-feature model
├── model_service.py          # Flask service wrapper
└── README.md                 # This file
```

---

## Quick Start

### Option 1: Create model WITH priors (recommended)

```python
from src.predict_model.linucb import MultiFeatureLinUCB

CATEGORIES = ["sport", "study", "work", "home", "health", "habits"]

# Create model with sensible priors
model = MultiFeatureLinUCB.create_with_priors(
    categories=CATEGORIES,
    motivation_weight=1.0,              # High motivation → better completion
    difficulty_weights=(0.3, 0.0, -0.3), # Easy → better, hard → worse
    prior_strength=5.0,                 # Prior worth ~5 observations
    learn_rate=0.5,                     # Smooth adaptation
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

### Option 2: Create model WITHOUT priors

```python
from src.predict_model.linucb import MultiFeatureLinUCB, extract_features, get_feature_count

CATEGORIES = ["sport", "study", "work", "home", "health", "habits"]

n_features = get_feature_count(num_categories=len(CATEGORIES))
model = MultiFeatureLinUCB(
    n_features=n_features,
    categories=CATEGORIES,
    alpha=0.1,
)

x = extract_features(
    motivation=4, duration=30, difficulty=3, delta_hours=24,
    category="study", categories=CATEGORIES,
)
pred_cat = model.predict_category(x)
```

---

## Feature Vector Layout

| Index | Feature    | Description                              |
|-------|------------|------------------------------------------|
| 0     | Motivation | Normalized motivation (0-1 from 1-5)     |
| 1-2   | Duration   | [shortness, longness] (complementary)    |
| 3-5   | Difficulty | One-hot [easy, medium, hard]             |
| 6-9   | Pressure   | One-hot [no, mild, strong, urgent]       |
| 10+   | Categories | One-hot encoding of task categories      |
| ...   | Subcategories | Dynamic one-hot (if configured)       |
| ...   | Interactions | Optional category×difficulty/pressure |

---

## Key Features

### 🎯 Prior-Based Initialization
The `create_with_priors()` factory method sets up the model with domain knowledge:
- High motivation → better task completion
- Easy tasks → better completion
- Hard tasks → worse completion

### 📊 Dynamic Subcategories
Add/remove subcategories at runtime:
```python
model.add_subcategory("sport", "football")
model.add_subcategory("sport", "basketball")
model.remove_subcategory("sport", "basketball")
```

### ⚡ Efficient Updates
Uses Sherman-Morrison formula for O(n²) rank-1 updates instead of O(n³) matrix inversion.

### 🔧 Configurable Parameters
- `alpha`: Exploration bonus (higher = more exploration)
- `prior_strength`: How strongly to hold initial beliefs
- `learn_rate`: How fast to adapt to new data
- `thresholds`: Score-to-category mapping

---

## API Reference

### `MultiFeatureLinUCB`

**Factory Methods:**
- `create_with_priors(categories, ...)` — Create model with priors

**Prediction:**
- `predict_score(x)` → float — UCB score
- `predict_category(x)` → int — Category 1-5

**Learning:**
- `update(x, reward)` — Update with observation

**Feature Extraction:**
- `extract_features_with_subcategory(...)` → ndarray

**Category Info:**
- `get_category_weight(category)` → float
- `get_category_weights_map()` → Dict[str, float]
- `get_category_info(category)` → Dict

**Subcategory Management:**
- `add_subcategory(category, subcategory)` → Tuple[bool, str]
- `remove_subcategory(category, subcategory)` → Tuple[bool, str]
- `get_subcategories(category)` → List[str]
- `has_subcategory(category, subcategory)` → bool

---

## Tests

Located in `tests/ml/`:
- `test0_quickstart_model_usage.py` — Quick start demo
- `test1_multi_feature_learning.py` — Feature-by-feature tests
- `test2_user_behavior_learning.py` — User type simulations
- `test3_motivation_difficulty_prior.py` — Prior behavior tests
- `test4_category_specific_behavior.py` — Category learning tests
- `test5_unknown_category.py` — Error handling tests
- `test6_subcategory_learning.py` — Subcategory tests

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
