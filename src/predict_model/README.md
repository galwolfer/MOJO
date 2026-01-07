# predict_model — Models & Tests 🔍

A brief, practical guide to the files in `src/predict_model` and how to use them.

---

## What’s in this folder

- **`single_feature_linucb_model.py`** 🔧
  - Simple, minimal LinUCB implementation for a single feature (user motivation 1–5).
  - Exposes `SingleFeatureLinUCB` with `predict_score`, `predict_category`, and `update`.
  - Purpose: baseline / educational model and quick experiments.

- **`multi_feature_linucb.py`** 🔬
  - Full LinUCB implementation with many interpretable features and optional interactions.
  - Feature helpers: `extract_motivation_feature`, `extract_duration_features`, `extract_difficulty_features`, `extract_pressure_features`, `extract_category_features`, `extract_category_*_interactions` and `extract_features(...)`.
  - Model class: `MultiFeatureLinUCB` (supports priors, `alpha`, `learn_rate`, and Sherman–Morrison updates).
  - Purpose: production-like contextual bandit model handling categories, priors and interaction features.

- **`test_single_feature_linucb.py`** 🧪
  - Small demo script that shows predictions and how updates change `SingleFeatureLinUCB` behavior.

- **`test1_multi_feature_learning.py`** 🧩
  - Step-by-step tests that exercise each feature (motivation, duration, difficulty, pressure, category) and combined learning behavior.

- **`test2_user_behavior_learning.py`** 👥
  - Simulates different user types (high performer, procrastinator, pressure performer, improving/declining users, etc.) to verify adaptation.

- **`test3_motivation_difficulty_prior.py`** 🧭
  - Demonstrates using `init_theta` + `prior_strength` to encode prior beliefs (motivation and difficulty) and how learning interacts with priors.

- **`test4_category_specific_behavior.py`** 🏷️
  - Extensive scenarios to train category-specific behaviors, test unseen categories, and demonstrate exception handling via interaction features.

---

## Quick usage examples

- Multi-feature model (recommended for realistic tasks):

```python
from predict_model.multi_feature_linucb import MultiFeatureLinUCB, extract_features

CATEGORIES = [
    "study_and_education",
    "skill_building",
    "workout",
    "reflection",
    "home_and_chores",
    "family",
    "life_management",
    "work_and_career",
    "creative_projects",
    "hobbies",
    "relationship",
    "goals",
    "mindfulness",
    "health",
    "social_activity",
    "recovery",
    "exploration",
    "uncategorized",
]

# Create model
n_features = 1 + 2 + 3 + 4 + len(CATEGORIES)
model = MultiFeatureLinUCB(n_features=n_features, alpha=0.1)

# Build features for a task
x = extract_features(motivation=4, duration=30, difficulty=3, delta_hours=24, category="study", categories=CATEGORIES)

# Predict and update
pred_cat = model.predict_category(x)
model.update(x, reward=0.75)
```

- Single-feature quick test:

```python
from predict_model.single_feature_linucb_model import SingleFeatureLinUCB
model = SingleFeatureLinUCB(alpha=0.1)
category = model.predict_category(5)  # motivation=5
model.update(5, reward=1.0)
```

- Run the test suites (examples):

```
python src/predict_model/test1_multi_feature_learning.py
python src/predict_model/test2_user_behavior_learning.py
```

---

## Tips & notes 💡

- Enable `use_interactions=True` in `extract_features(...)` to learn category-specific exceptions (requires larger feature vectors).
- Use `init_theta` + `prior_strength` to inject prior beliefs (e.g., "motivation is good").
- Tune `alpha` (exploration), `prior_strength`, and `learn_rate` to control exploration vs. stability.
- `MultiFeatureLinUCB.update` uses Sherman–Morrison to maintain `A_inv` efficiently—avoid manual matrix inversion.

---

If you want, I can:
- Add a short example script that simulates a user and plots score progression, or
- Add docstrings or type annotations to specific functions. Tell me which option you'd prefer. ✅
