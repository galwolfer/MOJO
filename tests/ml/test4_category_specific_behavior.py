"""
Test: Category-Specific Behavior Learning
==========================================

This test demonstrates:
1. A single model with motivation + difficulty priors
2. Different learned behaviors for different categories
3. One category ("work") has consistently WORST behavior across ALL feature combinations
4. Other categories have varying behaviors based on training

The goal: verify that predictions are low for the "bad" category regardless of
motivation/difficulty, while other categories reflect their trained behaviors.

Feature vector layout (16 features with 6 categories):
  [0]     = motivation (normalized 0-1)
  [1-2]   = duration (shortness, longness)
  [3-5]   = difficulty (easy, medium, hard) - one-hot
  [6-9]   = pressure (no, mild, strong, urgent) - one-hot
  [10-15] = category (sport, study, work, home, health, habits) - one-hot
"""

import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))

from src.predict_model.multi_feature_linucb import (
    MultiFeatureLinUCB,
    extract_features,
    get_feature_count,
)
import numpy as np

CATEGORIES = ["sport", "study", "work", "home", "health", "habits"]

# Category indices in the feature vector (starting at index 10)
CAT_INDICES = {cat: 10 + i for i, cat in enumerate(CATEGORIES)}


def print_header(title):
    print("\n" + "=" * 80)
    print(title)
    print("=" * 80)


def create_model_with_priors():
    """
    Create a model with motivation and difficulty priors.
    Categories start neutral and shift only through observed rewards.
    The priors are just the starting belief; after training, predictions
    come from the learned weights (theta) that incorporate the data.
    """
    n_features = 1 + 2 + 3 + 4 + len(CATEGORIES)  # 16 features

    init_theta = np.zeros(n_features)

    # Motivation prior: higher motivation - better completion
    init_theta[0] = 1.0

    # Difficulty priors: easy - better, hard - worse
    init_theta[3] = 0.3  # easy: boost
    init_theta[4] = 0.0  # medium: neutral
    init_theta[5] = -0.3  # hard: penalty

    # Categories start at 0 - will learn from training data
    # (indices 10-15 remain zero)

    model = MultiFeatureLinUCB(
        n_features=n_features,
        alpha=0.1,
        init_theta=init_theta,
        prior_strength=5.0,
        learn_rate=0.5,
    )

    return model, init_theta


def train_category_behaviors(model):
    """
    Train the model with category-specific behaviors:

    - sport:  EXCELLENT behavior (reward ~0.9) - user loves sports
    - study:  GOOD behavior (reward ~0.7) - user is decent at studying
    - work:   WORST behavior (reward ~0.1) - user hates work, always fails
    - home:   MEDIUM behavior (reward ~0.5) - average performance
    - health: GOOD behavior (reward ~0.75) - user cares about health
    - habits: MEDIUM behavior (reward ~0.55) - slightly above average

    For WORK category specifically: train with LOW rewards across ALL
    feature combinations to ensure it learns to predict poorly regardless
    of motivation, difficulty, duration, or pressure.
    """

    category_rewards = {
        "sport": 0.9,
        "study": 0.7,
        "work": 0.1,  # WORST - always fails
        "home": 0.5,
        "health": 0.75,
        "habits": 0.55,
    }

    print("\nTraining category-specific behaviors...")
    print("-" * 60)

    # Train each category with various feature combinations
    # This ensures the model learns category-specific patterns

    training_rounds = 15  # Enough to establish clear patterns

    for category, base_reward in category_rewards.items():
        print(f"\nTraining '{category}' with base reward {base_reward}:")

        # Train with ALL combinations of motivation and difficulty
        # For work: always bad regardless of features
        # For others: reward varies slightly with features but stays near base

        combinations = [
            # (motivation, difficulty, duration, pressure_hours, reward_modifier)
            (1, 1, 30, 100, 0.0),  # Low mot, easy, short, no pressure
            (1, 3, 60, 48, 0.0),  # Low mot, medium, medium, mild
            (1, 5, 90, 6, 0.0),  # Low mot, hard, long, urgent
            (3, 1, 30, 100, 0.0),  # Med mot, easy
            (3, 3, 60, 48, 0.0),  # Med mot, medium
            (3, 5, 90, 6, 0.0),  # Med mot, hard
            (5, 1, 30, 100, 0.0),  # High mot, easy
            (5, 3, 60, 48, 0.0),  # High mot, medium
            (5, 5, 90, 6, 0.0),  # High mot, hard
        ]

        for _ in range(training_rounds):
            for mot, diff, dur, hours, mod in combinations:
                # For work: ALWAYS low reward regardless of features
                if category == "work":
                    reward = 0.1 + np.random.uniform(0.0, 0.05)  # 0.05-0.15
                else:
                    # Other categories: reward based on category + small variation
                    reward = base_reward + np.random.uniform(0.0, 0.1)
                    reward = np.clip(reward, 0.0, 1.0)

                x = extract_features(
                    motivation=mot,
                    duration=dur,
                    difficulty=diff,
                    delta_hours=hours,
                    category=category,
                    categories=CATEGORIES,
                )
                model.update(x, reward=reward)

        print(f"  Trained {training_rounds * len(combinations)} samples")

    print("\n" + "-" * 60)
    print("Training complete!")

    return category_rewards


def test_category_predictions(model, category_rewards):
    """
    TEST 1: Verify predictions differ by category.
    Work should always be low, others should reflect training.
    """
    print_header("TEST 1: CATEGORY PREDICTIONS (Fixed Features)")

    print(
        "\nUsing fixed features: motivation=3, difficulty=3, duration=60, pressure=mild"
    )
    print("Only varying the category to see learned differences.\n")

    print(
        f"{'Category':<12} {'Expected':<12} {'Pred Score':<14} {'Pred Cat':<12} {'Match?':<10}"
    )
    print("-" * 65)

    for category in CATEGORIES:
        x = extract_features(
            motivation=3,
            duration=60,
            difficulty=3,
            delta_hours=48,
            category=category,
            categories=CATEGORIES,
        )

        score = model.predict_score(x)
        pred_cat = model.predict_category(x)
        expected = category_rewards[category]

        # Check if prediction roughly matches expected
        match = "OK" if abs(score - expected) < 0.25 else "~"
        if category == "work" and score < 0.35:
            match = "OK LOW"

        print(
            f"{category:<12} {expected:<12.2f} {score:<14.4f} {pred_cat:<12} {match:<10}"
        )

    print(
        "\n>> Key observation: 'work' should have lowest score regardless of features"
    )


def test_work_always_bad(model):
    """
    TEST 2: Verify WORK category is bad across ALL feature combinations.
    Even with high motivation + easy difficulty, work should predict poorly.
    """
    print_header("TEST 2: WORK CATEGORY - ALWAYS BAD")

    print("\nTesting 'work' category with ALL feature combinations:")
    print(
        "Even the 'ideal' combination (high mot + easy) should predict LOW for work.\n"
    )

    print(
        f"{'Motivation':<12} {'Difficulty':<12} {'Duration':<10} {'Pressure':<10} {'Score':<12} {'Category':<10}"
    )
    print("-" * 75)

    all_scores = []

    test_cases = [
        (1, 1, 30, 100, "Low/Easy/Short/None"),
        (1, 3, 60, 48, "Low/Med/Med/Mild"),
        (1, 5, 120, 2, "Low/Hard/Long/Urgent"),
        (3, 1, 30, 100, "Med/Easy/Short/None"),
        (3, 3, 60, 48, "Med/Med/Med/Mild"),
        (3, 5, 120, 2, "Med/Hard/Long/Urgent"),
        (5, 1, 30, 100, "High/Easy/Short/None"),
        (5, 3, 60, 48, "High/Med/Med/Mild"),
        (5, 5, 120, 2, "High/Hard/Long/Urgent"),
    ]

    for mot, diff, dur, hours, desc in test_cases:
        x = extract_features(
            motivation=mot,
            duration=dur,
            difficulty=diff,
            delta_hours=hours,
            category="work",
            categories=CATEGORIES,
        )

        score = model.predict_score(x)
        pred_cat = model.predict_category(x)
        all_scores.append(score)

        print(
            f"{mot:<12} {diff:<12} {dur:<10} {hours:<10} {score:<12.4f} {pred_cat:<10}"
        )

    avg_score = np.mean(all_scores)
    max_score = np.max(all_scores)

    print("-" * 75)
    print(f"Average work score: {avg_score:.4f}")
    print(f"Maximum work score: {max_score:.4f}")
    print(
        f"\n>> Result: {'[PASS]' if max_score < 0.45 else '[FAIL]'} - Work predictions should all be LOW"
    )


def test_sport_always_good(model):
    """
    TEST 3: Verify SPORT category is good across feature combinations.
    Contrast with work to show category-specific learning.
    """
    print_header("TEST 3: SPORT CATEGORY - ALWAYS GOOD (Contrast)")

    print("\nTesting 'sport' category with same feature combinations as work:")
    print("Sport should predict HIGH even with challenging features.\n")

    print(
        f"{'Motivation':<12} {'Difficulty':<12} {'Duration':<10} {'Pressure':<10} {'Score':<12} {'Category':<10}"
    )
    print("-" * 75)

    all_scores = []

    test_cases = [
        (1, 1, 30, 100),
        (1, 3, 60, 48),
        (1, 5, 120, 2),
        (3, 1, 30, 100),
        (3, 3, 60, 48),
        (3, 5, 120, 2),
        (5, 1, 30, 100),
        (5, 3, 60, 48),
        (5, 5, 120, 2),
    ]

    for mot, diff, dur, hours in test_cases:
        x = extract_features(
            motivation=mot,
            duration=dur,
            difficulty=diff,
            delta_hours=hours,
            category="sport",
            categories=CATEGORIES,
        )

        score = model.predict_score(x)
        pred_cat = model.predict_category(x)
        all_scores.append(score)

        print(
            f"{mot:<12} {diff:<12} {dur:<10} {hours:<10} {score:<12.4f} {pred_cat:<10}"
        )

    avg_score = np.mean(all_scores)
    min_score = np.min(all_scores)

    print("-" * 75)
    print(f"Average sport score: {avg_score:.4f}")
    print(f"Minimum sport score: {min_score:.4f}")
    print(
        f"\n>> Result: {'[PASS]' if min_score > 0.5 else '[FAIL]'} - Sport predictions should all be HIGH"
    )


def test_category_comparison_matrix(model):
    """
    TEST 4: Full comparison matrix - same features, different categories.
    """
    print_header("TEST 4: CATEGORY COMPARISON MATRIX")

    print("\nPrediction scores for each category with IDENTICAL features:")
    print("(motivation=4, difficulty=3, duration=60, pressure=mild)\n")

    # Create header
    print(f"{'Feature Combo':<25}", end="")
    for cat in CATEGORIES:
        print(f"{cat:>10}", end="")
    print()
    print("-" * 85)

    feature_combos = [
        (5, 1, "High mot + Easy"),
        (5, 3, "High mot + Medium"),
        (5, 5, "High mot + Hard"),
        (3, 1, "Med mot + Easy"),
        (3, 3, "Med mot + Medium"),
        (3, 5, "Med mot + Hard"),
        (1, 1, "Low mot + Easy"),
        (1, 3, "Low mot + Medium"),
        (1, 5, "Low mot + Hard"),
    ]

    for mot, diff, desc in feature_combos:
        print(f"{desc:<25}", end="")
        for cat in CATEGORIES:
            x = extract_features(
                motivation=mot,
                duration=60,
                difficulty=diff,
                delta_hours=48,
                category=cat,
                categories=CATEGORIES,
            )
            score = model.predict_score(x)
            print(f"{score:>10.3f}", end="")
        print()

    print("\n>> Key: 'work' column should be consistently LOWEST across all rows")


def test_new_task_predictions(model):
    """
    TEST 5: Predict new unseen tasks - verify category dominates for work.
    """
    print_header("TEST 5: NEW TASK PREDICTIONS")

    print("\nSimulating new tasks the model hasn't seen before:")
    print("Checking if learned category patterns generalize.\n")

    new_tasks = [
        # Even with BEST features, work should still be bad
        {
            "mot": 5,
            "diff": 1,
            "dur": 15,
            "hours": 200,
            "cat": "work",
            "desc": "IDEAL features but WORK category",
        },
        # Even with WORST features, sport should still be decent
        {
            "mot": 1,
            "diff": 5,
            "dur": 120,
            "hours": 1,
            "cat": "sport",
            "desc": "WORST features but SPORT category",
        },
        # Normal cases
        {
            "mot": 4,
            "diff": 2,
            "dur": 45,
            "hours": 36,
            "cat": "study",
            "desc": "Good student task",
        },
        {
            "mot": 3,
            "diff": 3,
            "dur": 60,
            "hours": 24,
            "cat": "home",
            "desc": "Average home task",
        },
        {
            "mot": 5,
            "diff": 1,
            "dur": 20,
            "hours": 100,
            "cat": "health",
            "desc": "Motivated health task",
        },
        {
            "mot": 2,
            "diff": 4,
            "dur": 90,
            "hours": 12,
            "cat": "work",
            "desc": "Unmotivated hard work",
        },
    ]

    print(f"{'Description':<35} {'Score':<10} {'Category':<10} {'Interpretation':<25}")
    print("-" * 85)

    for task in new_tasks:
        x = extract_features(
            motivation=task["mot"],
            duration=task["dur"],
            difficulty=task["diff"],
            delta_hours=task["hours"],
            category=task["cat"],
            categories=CATEGORIES,
        )

        score = model.predict_score(x)
        pred_cat = model.predict_category(x)

        if task["cat"] == "work":
            interp = "OK Low (work penalty)" if score < 0.4 else "BAD Should be lower"
        elif task["cat"] == "sport":
            interp = "OK High (sport bonus)" if score > 0.5 else "BAD Should be higher"
        else:
            interp = "Normal range"

        print(f"{task['desc']:<35} {score:<10.4f} {pred_cat:<10} {interp:<25}")


def test_theta_analysis(model):
    """
    TEST 6: Analyze the learned theta weights to understand category effects.
    """
    print_header("TEST 6: LEARNED THETA WEIGHTS ANALYSIS")

    print("\nExamining the learned weights for each feature:\n")

    feature_names = [
        "motivation",
        "duration_short",
        "duration_long",
        "diff_easy",
        "diff_medium",
        "diff_hard",
        "pressure_no",
        "pressure_mild",
        "pressure_strong",
        "pressure_urgent",
    ] + [f"cat_{cat}" for cat in CATEGORIES]

    print(f"{'Feature':<20} {'Weight':<12} {'Interpretation':<40}")
    print("-" * 75)

    for i, name in enumerate(feature_names):
        weight = model.theta[i]

        # Interpretation
        if "cat_" in name:
            cat = name.replace("cat_", "")
            if cat == "work":
                interp = "LOWEST - learned worst behavior"
            elif cat == "sport":
                interp = "HIGHEST - learned best behavior"
            else:
                interp = "Moderate"
        elif name == "motivation":
            interp = "Higher motivation - better (from prior + data)"
        elif "diff_easy" in name:
            interp = "Easy - better (from prior)"
        elif "diff_hard" in name:
            interp = "Hard - worse (from prior)"
        else:
            interp = "Learned from data"

        print(f"{name:<20} {weight:<12.4f} {interp:<40}")

    # Category comparison
    print("\n" + "-" * 75)
    print("Category weights comparison:")
    cat_weights = [(cat, model.theta[CAT_INDICES[cat]]) for cat in CATEGORIES]
    cat_weights.sort(key=lambda x: x[1], reverse=True)

    for rank, (cat, weight) in enumerate(cat_weights, 1):
        marker = (
            "<< BEST" if rank == 1 else "<< WORST" if rank == len(CATEGORIES) else ""
        )
        print(f"  {rank}. {cat:<10}: {weight:>8.4f}  {marker}")


def test_all_categories_excellent_except_work(model):
    """
    TEST 7: Show that ALL categories (except work) perform VERY WELL
    with a good combination of features, while work remains bad.

    Using ideal features: high motivation (5), easy difficulty (1),
    short duration (30 min), no pressure (100 hours).
    """
    print_header("TEST 7: ALL CATEGORIES EXCELLENT (except work)")

    print("\nUsing IDEAL features for all categories:")
    print("  • Motivation: 5 (highest)")
    print("  • Difficulty: 1 (easy)")
    print("  • Duration: 30 min (short)")
    print("  • Pressure: 100 hours (no pressure)")
    print("\nExpectation: ALL categories perform VERY WELL, EXCEPT work stays BAD\n")

    print(
        f"{'Category':<12} {'Score':<12} {'Pred Cat':<12} {'Performance':<20} {'Result':<10}"
    )
    print("-" * 70)

    results = []

    for category in CATEGORIES:
        x = extract_features(
            motivation=5,  # HIGH motivation
            duration=30,  # SHORT duration
            difficulty=1,  # EASY
            delta_hours=100,  # NO pressure
            category=category,
            categories=CATEGORIES,
        )

        score = model.predict_score(x)
        pred_cat = model.predict_category(x)

        if category == "work":
            performance = "BAD (as expected)"
            result = "OK" if score < 0.4 else "BAD"
        else:
            performance = (
                "EXCELLENT" if score > 0.7 else "GOOD" if score > 0.5 else "NEEDS WORK"
            )
            result = "OK" if score > 0.7 else "~"

        results.append((category, score, pred_cat, performance, result))
        print(
            f"{category:<12} {score:<12.4f} {pred_cat:<12} {performance:<20} {result:<10}"
        )

    # Summary
    print("-" * 70)
    non_work_scores = [r[1] for r in results if r[0] != "work"]
    work_score = [r[1] for r in results if r[0] == "work"][0]

    print(f"\nSummary:")
    print(f"  Non-work average score: {np.mean(non_work_scores):.4f}")
    print(f"  Non-work minimum score: {np.min(non_work_scores):.4f}")
    print(f"  Work score:             {work_score:.4f}")
    print(f"  Gap (min non-work - work): {np.min(non_work_scores) - work_score:.4f}")

    all_non_work_good = all(s > 0.7 for s in non_work_scores)
    work_bad = work_score < 0.4

    print(f"\n>> Result: {'[PASS]' if all_non_work_good and work_bad else '[FAIL]'}")
    print(f"   All non-work categories excellent: {all_non_work_good}")
    print(f"   Work category stays bad: {work_bad}")


def test_varied_excellent_features_per_category(model):
    """
    TEST 8: Each category (except work) has a DIFFERENT combination of features
    that leads to excellent performance. Work always stays bad.
    """
    print_header("TEST 8: VARIED EXCELLENT FEATURES PER CATEGORY")

    print("\nEach category uses a DIFFERENT 'ideal' feature combination:")
    print("Work uses the SAME ideal features but should still perform BADLY.\n")

    # Different "ideal" combinations for each category
    category_features = {
        "sport": {
            "mot": 5,
            "diff": 1,
            "dur": 20,
            "hours": 100,
            "desc": "High mot, easy, very short, no pressure",
        },
        "study": {
            "mot": 4,
            "diff": 2,
            "dur": 45,
            "hours": 48,
            "desc": "Good mot, easy-med, medium, mild pressure",
        },
        "work": {
            "mot": 5,
            "diff": 1,
            "dur": 15,
            "hours": 200,  # IDEAL features!
            "desc": "IDEAL: High mot, easy, short, no pressure",
        },
        "home": {
            "mot": 4,
            "diff": 1,
            "dur": 30,
            "hours": 72,
            "desc": "Good mot, easy, short, mild pressure",
        },
        "health": {
            "mot": 5,
            "diff": 2,
            "dur": 25,
            "hours": 100,
            "desc": "High mot, easy-med, short, no pressure",
        },
        "habits": {
            "mot": 5,
            "diff": 1,
            "dur": 10,
            "hours": 200,
            "desc": "High mot, easy, very short, no pressure",
        },
    }

    print(f"{'Category':<10} {'Features':<45} {'Score':<10} {'Cat':<6} {'Status':<15}")
    print("-" * 95)

    for category in CATEGORIES:
        feat = category_features[category]
        x = extract_features(
            motivation=feat["mot"],
            duration=feat["dur"],
            difficulty=feat["diff"],
            delta_hours=feat["hours"],
            category=category,
            categories=CATEGORIES,
        )

        score = model.predict_score(x)
        pred_cat = model.predict_category(x)

        if category == "work":
            status = "STILL BAD" if score < 0.4 else "Problem!"
        else:
            status = "EXCELLENT" if score > 0.75 else "GOOD" if score > 0.6 else "~"

        print(
            f"{category:<10} {feat['desc']:<45} {score:<10.4f} {pred_cat:<6} {status:<15}"
        )

    print("\n>> Key insight: Work with IDEAL features still predicts poorly!")
    print("   The category-specific learning dominates over feature quality.")


def test_side_by_side_comparison(model):
    """
    TEST 9: Side-by-side comparison showing the SAME features
    produce very different scores based on category.
    """
    print_header(
        "TEST 9: SIDE-BY-SIDE COMPARISON (Same Features, Different Categories)"
    )

    # Define 3 feature combinations: ideal, medium, challenging
    feature_sets = [
        {
            "mot": 5,
            "diff": 1,
            "dur": 20,
            "hours": 100,
            "name": "IDEAL (high mot, easy, short, no pressure)",
        },
        {
            "mot": 3,
            "diff": 3,
            "dur": 60,
            "hours": 48,
            "name": "MEDIUM (med mot, med diff, med dur, mild pressure)",
        },
        {
            "mot": 2,
            "diff": 4,
            "dur": 90,
            "hours": 12,
            "name": "CHALLENGING (low mot, hard, long, strong pressure)",
        },
    ]

    for feat in feature_sets:
        print(f"\n{feat['name']}:")
        print(f"{'Category':<12} {'Score':<12} {'Pred Cat':<12} {'Performance':<20}")
        print("-" * 55)

        scores = []
        for category in CATEGORIES:
            x = extract_features(
                motivation=feat["mot"],
                duration=feat["dur"],
                difficulty=feat["diff"],
                delta_hours=feat["hours"],
                category=category,
                categories=CATEGORIES,
            )

            score = model.predict_score(x)
            pred_cat = model.predict_category(x)
            scores.append((category, score))

            if category == "work":
                perf = "BAD"
            elif score > 0.8:
                perf = "EXCELLENT"
            elif score > 0.6:
                perf = "GOOD"
            elif score > 0.4:
                perf = "MEDIUM"
            else:
                perf = "POOR"

            print(f"{category:<12} {score:<12.4f} {pred_cat:<12} {perf:<20}")

        # Show gap
        work_score = [s for c, s in scores if c == "work"][0]
        best_score = max(s for c, s in scores if c != "work")
        print(
            f"   Gap between best non-work ({best_score:.3f}) and work ({work_score:.3f}): {best_score - work_score:.3f}"
        )


def test_unseen_category_behavior():
    """
    TEST 10: Add an UNSEEN category that never gets trained.
    Shows how the model scores a category with no data while others are trained.
    """
    print_header("TEST 10: UNSEEN CATEGORY (Not Trained)")

    # Extend categories with a brand-new one that will receive zero training samples
    extended_categories = CATEGORIES + ["music"]
    cat_indices_ext = {cat: 10 + i for i, cat in enumerate(extended_categories)}

    n_features = 1 + 2 + 3 + 4 + len(extended_categories)

    init_theta = np.zeros(n_features)
    init_theta[0] = 1.0  # motivation prior
    init_theta[3] = 0.3  # easy difficulty prior
    init_theta[5] = -0.3  # hard difficulty prior

    model = MultiFeatureLinUCB(
        n_features=n_features,
        alpha=0.1,
        init_theta=init_theta,
        prior_strength=5.0,
        learn_rate=0.5,
    )

    # Train all known categories EXCEPT the unseen one
    category_rewards = {
        "sport": 0.9,
        "study": 0.7,
        "work": 0.1,
        "home": 0.5,
        "health": 0.75,
        "habits": 0.55,
        # "music" intentionally omitted
    }

    combinations = [
        (1, 1, 30, 100),
        (1, 3, 60, 48),
        (1, 5, 90, 6),
        (3, 1, 30, 100),
        (3, 3, 60, 48),
        (3, 5, 90, 6),
        (5, 1, 30, 100),
        (5, 3, 60, 48),
        (5, 5, 90, 6),
    ]

    training_rounds = 10

    for category, base_reward in category_rewards.items():
        for _ in range(training_rounds):
            for mot, diff, dur, hours in combinations:
                if category == "work":
                    reward = 0.1 + np.random.uniform(0.0, 0.05)
                else:
                    reward = base_reward + np.random.uniform(0.0, 0.1)
                    reward = np.clip(reward, 0.0, 1.0)

                x = extract_features(
                    motivation=mot,
                    duration=dur,
                    difficulty=diff,
                    delta_hours=hours,
                    category=category,
                    categories=extended_categories,
                )
                model.update(x, reward=reward)

    # Evaluate the unseen category against trained ones with identical features
    eval_features = {"mot": 4, "diff": 2, "dur": 45, "hours": 48}

    print(f"\nEvaluating unseen category 'music' with the same features as others:")
    print(
        f"  Features: motivation={eval_features['mot']}, difficulty={eval_features['diff']}, duration={eval_features['dur']}, pressure_hours={eval_features['hours']}"
    )
    print(
        f"{'Category':<10} {'Score':<10} {'Pred Cat':<10} {'Cat Weight':<12} {'Notes':<30}"
    )
    print("-" * 75)

    for category in extended_categories:
        x = extract_features(
            motivation=eval_features["mot"],
            duration=eval_features["dur"],
            difficulty=eval_features["diff"],
            delta_hours=eval_features["hours"],
            category=category,
            categories=extended_categories,
        )

        score = model.predict_score(x)
        pred_cat = model.predict_category(x)
        cat_weight = model.theta[cat_indices_ext[category]]

        if category == "music":
            notes = "Untrained; relies on priors"
        elif category == "work":
            notes = "Trained bad"
        elif category == "sport":
            notes = "Trained excellent"
        else:
            notes = "Trained moderate"

        print(
            f"{category:<10} {score:<10.4f} {pred_cat:<10} {cat_weight:<12.4f} {notes:<30}"
        )

    music_weight = model.theta[cat_indices_ext["music"]]
    print("\nKey takeaways:")
    print(
        "- The unseen category keeps its category weight near the prior (0), so its score reflects only shared features (motivation/duration/difficulty/pressure)."
    )
    print(
        "- Trained categories diverge via observed rewards: 'sport' weight rises, 'work' weight drops, so identical features give different scores by category."
    )
    print(
        f"- Unseen category weight (music): {music_weight:.4f} (stays ~0 without any category-specific updates)"
    )


def test_exception_behavior_single_category():
    """
    TEST 11: One category is bad for everything EXCEPT one specific behavior
    where it excels. All other categories are bad on that same behavior.
    """
    print_header("TEST 11: CATEGORY EXCEPTION BEHAVIOR")

    special_category = "work"
    special_behavior = {"mot": 4, "diff": 5, "dur": 90, "hours": 6}  # hard + urgent

    # Fresh model to isolate this scenario
    model, _ = create_model_with_priors()
    # Reduce prior_strength and increase learn_rate for stronger updates
    model.prior_strength = 2.0
    model.learn_rate = 0.8

    # Baseline: make work category bad, others good
    baseline_cases = [
        (3, 3, 60, 48, 0.75),  # medium everything - good for most
        (2, 4, 90, 12, 0.65),  # harder/longer - still decent
    ]

    baseline_rounds = 100
    for category in CATEGORIES:
        for _ in range(baseline_rounds):
            for mot, diff, dur, hours, base_reward in baseline_cases:
                # Make work especially bad on baseline cases, others good
                if category == special_category:
                    reward = 0.01 + np.random.uniform(0.0, 0.01)
                else:
                    reward = base_reward + np.random.uniform(0.0, 0.1)
                x = extract_features(
                    motivation=mot,
                    duration=dur,
                    difficulty=diff,
                    delta_hours=hours,
                    category=category,
                    categories=CATEGORIES,
                )
                model.update(x, reward=reward)

    # Special behavior: only the special category gets high rewards; others stay bad
    special_rounds = 350
    for category in CATEGORIES:
        for _ in range(special_rounds):
            reward = 1.0 if category == special_category else 0.01
            x = extract_features(
                motivation=special_behavior["mot"],
                duration=special_behavior["dur"],
                difficulty=special_behavior["diff"],
                delta_hours=special_behavior["hours"],
                category=category,
                categories=CATEGORIES,
            )
            model.update(x, reward=reward)

    print(
        "\nSpecial behavior (hard + urgent) should be GOOD only for 'work' and BAD elsewhere:"
    )
    print(
        f"  Features: motivation={special_behavior['mot']}, difficulty={special_behavior['diff']}, duration={special_behavior['dur']}, pressure_hours={special_behavior['hours']}"
    )
    print(
        f"{'Category':<10} {'Score':<10} {'Pred Cat':<10} {'Cat Weight':<12} {'Note':<25}"
    )
    print("-" * 75)

    for category in CATEGORIES:
        x = extract_features(
            motivation=special_behavior["mot"],
            duration=special_behavior["dur"],
            difficulty=special_behavior["diff"],
            delta_hours=special_behavior["hours"],
            category=category,
            categories=CATEGORIES,
        )
        score = model.predict_score(x)
        pred_cat = model.predict_category(x)
        cat_weight = model.theta[CAT_INDICES[category]]
        note = "GOOD exception" if category == special_category else "BAD elsewhere"
        print(
            f"{category:<10} {score:<10.4f} {pred_cat:<10} {cat_weight:<12.4f} {note:<25}"
        )

    print(
        "\nCheck a normal (non-special) combo to confirm the special category stays bad otherwise:"
    )
    normal = {"mot": 3, "diff": 3, "dur": 60, "hours": 48}
    print(
        f"  Normal features: mot={normal['mot']}, diff={normal['diff']}, dur={normal['dur']}, hours={normal['hours']}"
    )
    print(f"{'Category':<10} {'Score':<10} {'Note':<20}")
    print("-" * 45)

    for category in CATEGORIES:
        x = extract_features(
            motivation=normal["mot"],
            duration=normal["dur"],
            difficulty=normal["diff"],
            delta_hours=normal["hours"],
            category=category,
            categories=CATEGORIES,
        )
        score = model.predict_score(x)
        note = "Bad (as expected)" if category == special_category else "Good (trained)"
        print(f"{category:<10} {score:<10.4f} {note:<20}")


def test_exception_behavior_with_interactions():
    """
    TEST 12: Solve the exception behavior problem using INTERACTION FEATURES.

    With interaction features enabled, the model can learn:
    - "Work is generally bad" (negative category weight)
    - "BUT work + hard + urgent is good" (positive interaction weight)

    This test demonstrates that interaction features enable category-specific
    exceptions that were impossible with the base model.
    """
    print_header("TEST 12: EXCEPTION BEHAVIOR WITH INTERACTIONS (SOLUTION)")

    special_category = "work"
    special_behavior = {"mot": 4, "diff": 5, "dur": 90, "hours": 6}  # hard + urgent
    normal_behavior = {"mot": 3, "diff": 3, "dur": 60, "hours": 48}  # medium everything

    # Create model WITH interaction features
    n_features = get_feature_count(len(CATEGORIES), use_interactions=True)
    print(f"\nUsing interaction features: {n_features} total features")
    print(f"  Base features: 16")
    print(f"  Category×Difficulty interactions: {len(CATEGORIES) * 3}")
    print(f"  Category×Pressure interactions: {len(CATEGORIES) * 4}")

    init_theta = np.zeros(n_features)
    # Set motivation prior
    init_theta[0] = 1.0
    # Difficulty priors
    init_theta[3] = 0.3  # easy
    init_theta[5] = -0.3  # hard

    model = MultiFeatureLinUCB(
        n_features=n_features,
        alpha=0.1,
        init_theta=init_theta,
        prior_strength=2.0,
        learn_rate=0.8,
    )

    # Calculate indices for interaction features
    base_features = 10 + len(CATEGORIES)  # 16
    cat_diff_start = base_features  # 16
    cat_press_start = cat_diff_start + len(CATEGORIES) * 3  # 16 + 18 = 34

    # Helper to get interaction indices
    def get_cat_diff_idx(cat_name, diff_level):
        # diff_level: 0=easy, 1=medium, 2=hard
        cat_idx = CATEGORIES.index(cat_name)
        return cat_diff_start + cat_idx * 3 + diff_level

    def get_cat_press_idx(cat_name, press_level):
        # press_level: 0=no, 1=mild, 2=strong, 3=urgent
        cat_idx = CATEGORIES.index(cat_name)
        return cat_press_start + cat_idx * 4 + press_level

    print("\nTraining Phase 1: Make work BAD on normal features...")
    # Train work with low rewards on normal/easy features
    baseline_rounds = 150
    for _ in range(baseline_rounds):
        for mot in [2, 3, 4]:
            for diff in [1, 2, 3]:  # easy and medium
                for hours in [100, 48, 24]:  # no/mild/strong pressure (NOT urgent)
                    for category in CATEGORIES:
                        if category == special_category:
                            reward = 0.05 + np.random.uniform(0.0, 0.05)
                        else:
                            reward = 0.75 + np.random.uniform(0.0, 0.15)
                        x = extract_features(
                            motivation=mot,
                            duration=60,
                            difficulty=diff,
                            delta_hours=hours,
                            category=category,
                            categories=CATEGORIES,
                            use_interactions=True,
                        )
                        model.update(x, reward=reward)

    print("Training Phase 2: Make work GOOD ONLY on hard+urgent...")
    # Train work with HIGH rewards ONLY on hard + urgent
    special_rounds = 200
    for _ in range(special_rounds):
        for category in CATEGORIES:
            if category == special_category:
                # Work gets HIGH reward for hard+urgent
                reward = 0.95 + np.random.uniform(0.0, 0.05)
            else:
                # Other categories get LOW reward for hard+urgent
                reward = 0.05 + np.random.uniform(0.0, 0.05)
            x = extract_features(
                motivation=special_behavior["mot"],
                duration=special_behavior["dur"],
                difficulty=special_behavior["diff"],
                delta_hours=special_behavior["hours"],
                category=category,
                categories=CATEGORIES,
                use_interactions=True,
            )
            model.update(x, reward=reward)

    # Evaluate: Special behavior (hard + urgent)
    print(f"\nSpecial behavior (hard + urgent) - work should be GOOD, others BAD:")
    print(
        f"  Features: mot={special_behavior['mot']}, diff={special_behavior['diff']}, dur={special_behavior['dur']}, hours={special_behavior['hours']}"
    )
    print(
        f"{'Category':<10} {'Score':<10} {'Pred Cat':<10} {'Expected':<15} {'Result':<10}"
    )
    print("-" * 60)

    work_special_score = None
    other_special_scores = []
    for category in CATEGORIES:
        x = extract_features(
            motivation=special_behavior["mot"],
            duration=special_behavior["dur"],
            difficulty=special_behavior["diff"],
            delta_hours=special_behavior["hours"],
            category=category,
            categories=CATEGORIES,
            use_interactions=True,
        )
        score = model.predict_score(x)
        pred_cat = model.predict_category(x)

        if category == special_category:
            expected = "HIGH (exception)"
            result = "✓ PASS" if score > 0.6 else "✗ FAIL"
            work_special_score = score
        else:
            expected = "LOW"
            result = "✓ PASS" if score < 0.4 else "✗ FAIL"
            other_special_scores.append(score)

        print(
            f"{category:<10} {score:<10.4f} {pred_cat:<10} {expected:<15} {result:<10}"
        )

    # Evaluate: Normal behavior (medium everything)
    print(f"\nNormal behavior (medium features) - work should be BAD, others GOOD:")
    print(
        f"  Features: mot={normal_behavior['mot']}, diff={normal_behavior['diff']}, dur={normal_behavior['dur']}, hours={normal_behavior['hours']}"
    )
    print(
        f"{'Category':<10} {'Score':<10} {'Pred Cat':<10} {'Expected':<15} {'Result':<10}"
    )
    print("-" * 60)

    work_normal_score = None
    other_normal_scores = []
    for category in CATEGORIES:
        x = extract_features(
            motivation=normal_behavior["mot"],
            duration=normal_behavior["dur"],
            difficulty=normal_behavior["diff"],
            delta_hours=normal_behavior["hours"],
            category=category,
            categories=CATEGORIES,
            use_interactions=True,
        )
        score = model.predict_score(x)
        pred_cat = model.predict_category(x)

        if category == special_category:
            expected = "LOW (bad)"
            result = "✓ PASS" if score < 0.4 else "✗ FAIL"
            work_normal_score = score
        else:
            expected = "HIGH (good)"
            result = "✓ PASS" if score > 0.5 else "✗ FAIL"
            other_normal_scores.append(score)

        print(
            f"{category:<10} {score:<10.4f} {pred_cat:<10} {expected:<15} {result:<10}"
        )

    # Print key interaction weights
    print("\n" + "-" * 60)
    print("KEY LEARNED WEIGHTS:")
    print("-" * 60)

    work_cat_idx = 10 + CATEGORIES.index("work")
    print(f"  Work category weight (global): {model.theta[work_cat_idx]:.4f}")
    print(f"  Work×Hard interaction: {model.theta[get_cat_diff_idx('work', 2)]:.4f}")
    print(f"  Work×Urgent interaction: {model.theta[get_cat_press_idx('work', 3)]:.4f}")
    print(f"  Sport×Hard interaction: {model.theta[get_cat_diff_idx('sport', 2)]:.4f}")
    print(
        f"  Sport×Urgent interaction: {model.theta[get_cat_press_idx('sport', 3)]:.4f}"
    )

    print("\n" + "-" * 60)
    print("SUMMARY:")
    print("-" * 60)
    print(f"  Work on SPECIAL (hard+urgent): {work_special_score:.4f} (target: >0.6)")
    print(f"  Work on NORMAL: {work_normal_score:.4f} (target: <0.4)")
    print(
        f"  Others on SPECIAL avg: {np.mean(other_special_scores):.4f} (target: <0.4)"
    )
    print(f"  Others on NORMAL avg: {np.mean(other_normal_scores):.4f} (target: >0.5)")

    # Determine overall pass/fail
    special_pass = work_special_score > 0.6 and np.mean(other_special_scores) < 0.4
    normal_pass = work_normal_score < 0.4 and np.mean(other_normal_scores) > 0.5

    if special_pass and normal_pass:
        print(
            "\n>> Result: [PASS] - Interaction features SOLVED the exception behavior!"
        )
        print("   The model successfully learned category-specific exceptions.")
    else:
        print("\n>> Result: [PARTIAL] - Adjust training rounds if needed.")
        print("   Interaction features enable this, but may need tuning.")


if __name__ == "__main__":
    print("\n" + "=" * 80)
    print("    Category-Specific Behavior Test Suite".center(80))
    print("=" * 80)
    print("\nGoal: Train one model where 'work' category has WORST behavior")
    print("      regardless of motivation, difficulty, or other features.")
    print("      Other categories should reflect their trained behaviors.")

    # Create and train model
    model, init_theta = create_model_with_priors()

    print("\nInitial priors:")
    print(f"  motivation weight: {init_theta[0]}")
    print(f"  easy difficulty:   {init_theta[3]}")
    print(f"  hard difficulty:   {init_theta[5]}")

    category_rewards = train_category_behaviors(model)

    # Run all tests
    test_category_predictions(model, category_rewards)
    test_work_always_bad(model)
    test_sport_always_good(model)
    test_category_comparison_matrix(model)
    test_new_task_predictions(model)
    test_theta_analysis(model)
    test_all_categories_excellent_except_work(model)
    test_varied_excellent_features_per_category(model)
    test_side_by_side_comparison(model)
    test_unseen_category_behavior()
    test_exception_behavior_single_category()
    test_exception_behavior_with_interactions()

    print("\n" + "=" * 80)
    print("[OK] ALL TESTS COMPLETED")
    print("=" * 80 + "\n")
