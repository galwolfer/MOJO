"""
Quickstart Demo: MultiFeatureLinUCB
===================================

This short script shows how to:
- initialize the multi-feature LinUCB model
- build a task into features
- predict score/category
- update the model with an observed reward

Run:
  python tests/ml/test0_quickstart_model_usage.py
"""

from __future__ import annotations

from typing import List

import sys
import os

# Make repository root importable so `src.*` modules resolve when running directly
sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))

from src.predict_model.multi_feature_linucb import (
    MultiFeatureLinUCB,
    extract_features,
    get_feature_count,
)


def main() -> None:
    print("\n==============================")
    print(" Quickstart: MultiFeatureLinUCB")
    print("==============================\n")

    # 1) Choose your categories (these are the one-hot labels)
    categories: List[str] = [
        "sport",
        "study",
        "work",
        "home",
        "health",
        "habits",
    ]

    # 2) Decide if you want interaction features (False for a simple start)
    use_interactions = False

    # 3) Compute total feature count for the model
    n_features = get_feature_count(len(categories), use_interactions=use_interactions)

    # 4) Add priors for motivation and difficulty (optional)
    # Feature layout without interactions:
    #  [0] motivation, [1-2] duration, [3-5] difficulty, [6-9] pressure, [10..] categories
    init_theta = [0.0] * n_features
    init_theta[0] = 1.0    # motivation prior: higher motivation should help
    init_theta[3] = 0.3    # easy difficulty prior: positive effect
    init_theta[5] = -0.3   # hard difficulty prior: negative effect
    prior_strength = 1.0   # strength λ of the Bayesian prior

    # 5) Create the model (alpha controls exploration bonus)
    model = MultiFeatureLinUCB(
        n_features=n_features,
        alpha=0.1,
        categories=categories,
        init_theta=init_theta,
        prior_strength=prior_strength,
        learn_rate=0.5,
    )

    print(f"Categories: {categories}")
    print(f"Total features: {n_features} (interactions={use_interactions})")
    print("Initial priors:")
    print("  motivation weight: 1.0")
    print("  easy difficulty:   0.3")
    print("  hard difficulty:   -0.3\n")

    # 6) Define a task (raw inputs)
    task = {
        "motivation": 4,      # 1..5
        "duration": 45,       # minutes
        "difficulty": 3,      # 1..5
        "delta_hours": 48,    # hours until deadline
        "category": "study", # must be in categories above for 1-hot
    }

    # 7) Turn the task into a feature vector the model understands
    x = extract_features(
        motivation=task["motivation"],
        duration=task["duration"],
        difficulty=task["difficulty"],
        delta_hours=task["delta_hours"],
        category=task["category"],
        categories=categories,
        use_interactions=use_interactions,
    )

    # 8) Predict score and category BEFORE any learning (priors applied)
    score_before = model.predict_score(x)
    cat_before = model.predict_category(x)
    print("Task (study) — BEFORE learning:")
    print(f"  Score:    {score_before:.4f}")
    print(f"  Category: {cat_before} (1=best .. 5=worst)\n")

    # 9) Simulate an observed reward (e.g., user completed well)
    reward = 0.9  # in [0,1]
    model.update(x, reward=reward)

    # 10) Predict again AFTER learning from this one example
    score_after = model.predict_score(x)
    cat_after = model.predict_category(x)
    print("Task (study) — AFTER one update (reward=0.9):")
    print(f"  Score:    {score_after:.4f}")
    print(f"  Category: {cat_after} (1=best .. 5=worst)\n")

    # 11) Contrast with another category using the SAME raw features
    x_work = extract_features(
        motivation=task["motivation"],
        duration=task["duration"],
        difficulty=task["difficulty"],
        delta_hours=task["delta_hours"],
        category="work",
        categories=categories,
        use_interactions=use_interactions,
    )

    score_work = model.predict_score(x_work)
    cat_work = model.predict_category(x_work)
    print("Same features but category='work':")
    print(f"  Score:    {score_work:.4f}")
    print(f"  Category: {cat_work}\n")

    # 12) Learn that 'work' performed poorly in this case
    model.update(x_work, reward=0.2)

    score_work_after = model.predict_score(x_work)
    cat_work_after = model.predict_category(x_work)
    print("After teaching one poor 'work' outcome (reward=0.2):")
    print(f"  Work Score:    {score_work_after:.4f}")
    print(f"  Work Category: {cat_work_after}\n")

    # 13) Peek at learned category weights
    weights = model.get_category_weights_map()
    print("Learned category weights (theta entries):")
    for k, v in weights.items():
        print(f"  {k:8s}: {v:+.4f}")

    # 14) Test unknown category fallback behavior
    # print("\n" + "=" * 50)
    # print("Unknown Category Fallback Test")
    # print("=" * 50)
    # print("\nWhat happens with a category NOT in the original list?")
    # print("Example: category='music' (not in model's categories)\n")

    # x_music = extract_features(
    #     motivation=task["motivation"],
    #     duration=task["duration"],
    #     difficulty=task["difficulty"],
    #     delta_hours=task["delta_hours"],
    #     category="music",  # Unknown category!
    #     categories=categories,
    #     use_interactions=use_interactions,
    # )

    # score_music = model.predict_score(x_music)
    # cat_music = model.predict_category(x_music)
    
    # print(f"Unknown category 'music':")
    # print(f"  Score:    {score_music:.4f}")
    # print(f"  Category: {cat_music}")
    
    # # Compare to the last category in list (fallback target)
    # last_cat = categories[-1]
    # weight_habits = weights[last_cat]
    # print(f"\nFallback behavior:")
    # print(f"  'music' maps to last category: '{last_cat}'")
    # print(f"  '{last_cat}' weight: {weight_habits:+.4f}")
    # print(f"  Unknown categories inherit this weight")

    print("\n[OK] Quickstart complete — predictions and updates ran.")


if __name__ == "__main__":
    main()
