"""
User Behavior Learning Tests
============================

This test suite demonstrates how the MultiFeatureLinUCB model learns
different user behavior patterns over time. Each test simulates a
distinct user profile and shows how the model adapts its predictions.

User Profiles Tested:
---------------------
1. High Performer - Consistently completes tasks quickly
2. Procrastinator - Often delays or fails to complete tasks
3. Category Specialist - Excels in specific task categories
4. Short Task Lover - Better with quick tasks, struggles with long ones
5. Pressure Performer - Works better under deadline pressure
6. Improving User - Behavior improves over time
7. Declining User - Behavior worsens over time
8. Inconsistent User - Unpredictable behavior pattern

Run with: python test_user_behavior_learning.py
"""

import numpy as np
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))

from src.predict_model.multi_feature_linucb import MultiFeatureLinUCB, extract_features

# Standard categories used across all tests
CATEGORIES = ["sport", "study", "work", "home", "health", "habits"]
MAX_DURATION = 120  # minutes


def create_model(
    alpha: float = 0.1, motivation_bias: float = 0.0
) -> MultiFeatureLinUCB:
    """Create a fresh model with optional motivation bias."""
    n_features = 1 + 2 + 3 + 4 + len(CATEGORIES)  # 16 features
    init_theta = None
    if motivation_bias > 0:
        init_theta = [motivation_bias] + [0.0] * (n_features - 1)
    return MultiFeatureLinUCB(n_features=n_features, alpha=alpha, init_theta=init_theta)


def get_features(
    motivation: int,
    duration: int,
    difficulty: int,
    hours_to_deadline: float,
    category: str,
) -> np.ndarray:
    """Helper to extract features with standard parameters."""
    return extract_features(
        motivation=motivation,
        duration=duration,
        difficulty=difficulty,
        delta_hours=hours_to_deadline,
        category=category,
        categories=CATEGORIES,
        max_duration=MAX_DURATION,
    )


def print_header(title: str) -> None:
    """Print a formatted section header."""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def print_prediction(label: str, score: float, category: int) -> None:
    """Print a formatted prediction result."""
    category_names = {
        1: "Will complete very quickly",
        2: "Will complete on time",
        3: "Will complete slightly late",
        4: "Will complete significantly late",
        5: "Will NOT complete",
    }
    print(f"  {label}")
    print(f"    Score: {score:.4f} → Category {category}: {category_names[category]}")


# =============================================================================
# TEST 1: HIGH PERFORMER USER
# =============================================================================
def test_high_performer():
    """
    Simulates a user who consistently completes tasks quickly.
    The model should learn to predict high scores for this user.
    """
    print_header("TEST 1: HIGH PERFORMER USER")
    print(
        "\nProfile: Always motivated, completes tasks quickly regardless of difficulty"
    )

    model = create_model(alpha=0.1)

    # Training data: High performer always gets good rewards
    training_tasks = [
        # (motivation, duration, difficulty, hours_to_deadline, category, reward)
        (5, 30, 1, 48, "work", 0.95),
        (5, 60, 3, 24, "study", 0.90),
        (4, 90, 5, 12, "work", 0.85),
        (5, 45, 2, 72, "sport", 0.95),
        (4, 120, 4, 6, "home", 0.80),
        (5, 30, 3, 48, "health", 0.92),
        (5, 60, 2, 24, "habits", 0.88),
        (4, 45, 1, 36, "study", 0.95),
    ]

    print("\nTraining Phase:")
    print("-" * 60)
    for i, (mot, dur, diff, hours, cat, reward) in enumerate(training_tasks):
        x = get_features(mot, dur, diff, hours, cat)
        score_before = model.predict_score(x)
        model.update(x, reward)
        score_after = model.predict_score(x)
        print(
            f"  Task {i+1}: {cat:6} (diff={diff}) | Reward={reward:.2f} | "
            f"Score: {score_before:.3f} → {score_after:.3f}"
        )

    # Test predictions
    print("\nPredictions After Training:")
    print("-" * 60)

    test_cases = [
        ("Easy work task", 5, 30, 1, 48, "work"),
        ("Hard study task", 4, 90, 5, 12, "study"),
        ("Medium sport task", 5, 60, 3, 24, "sport"),
    ]

    all_high = True
    for label, mot, dur, diff, hours, cat in test_cases:
        x = get_features(mot, dur, diff, hours, cat)
        score = model.predict_score(x)
        category = model.predict_category(x)
        print_prediction(label, score, category)
        if category > 2:  # Should predict category 1 or 2 for high performer
            all_high = False

    test_passed = all_high
    print(
        f"\n{'PASSED' if test_passed else 'FAILED'} - Model learned: High performer = High predicted scores"
    )
    return test_passed


# =============================================================================
# TEST 2: PROCRASTINATOR USER
# =============================================================================
def test_procrastinator():
    """
    Simulates a user who often delays or fails to complete tasks.
    The model should learn to predict low scores.
    """
    print_header("TEST 2: PROCRASTINATOR USER")
    print("\nProfile: Low motivation, often fails to complete tasks on time")

    model = create_model(alpha=0.1)

    # Training data: Procrastinator gets poor rewards
    training_tasks = [
        (2, 60, 3, 48, "work", 0.20),
        (1, 30, 2, 24, "study", 0.15),
        (2, 90, 4, 12, "work", 0.10),
        (3, 45, 3, 72, "home", 0.30),
        (1, 60, 2, 6, "study", 0.05),
        (2, 30, 1, 48, "habits", 0.25),
        (2, 45, 3, 24, "health", 0.20),
        (1, 90, 5, 12, "work", 0.00),
    ]

    print("\nTraining Phase:")
    print("-" * 60)
    for i, (mot, dur, diff, hours, cat, reward) in enumerate(training_tasks):
        x = get_features(mot, dur, diff, hours, cat)
        score_before = model.predict_score(x)
        model.update(x, reward)
        score_after = model.predict_score(x)
        print(
            f"  Task {i+1}: {cat:6} (diff={diff}) | Reward={reward:.2f} | "
            f"Score: {score_before:.3f} → {score_after:.3f}"
        )

    print("\nPredictions After Training:")
    print("-" * 60)

    test_cases = [
        ("Easy work task", 2, 30, 1, 48, "work"),
        ("Hard study task", 1, 90, 5, 12, "study"),
        ("Medium home task", 2, 60, 3, 24, "home"),
    ]

    all_low = True
    for label, mot, dur, diff, hours, cat in test_cases:
        x = get_features(mot, dur, diff, hours, cat)
        score = model.predict_score(x)
        category = model.predict_category(x)
        print_prediction(label, score, category)
        if category < 4:  # Should predict category 4 or 5 for procrastinator
            all_low = False

    test_passed = all_low
    print(
        f"\n{'PASSED' if test_passed else 'FAILED'} - Model learned: Procrastinator = Low predicted scores"
    )
    return test_passed


# =============================================================================
# TEST 3: CATEGORY SPECIALIST USER
# =============================================================================
def test_category_specialist():
    """
    Simulates a user who excels in 'sport' tasks but struggles with 'work'.
    The model should learn category-specific preferences.
    """
    print_header("TEST 3: CATEGORY SPECIALIST USER")
    print("\nProfile: Loves sports activities, dislikes work tasks")

    model = create_model(alpha=0.1)

    # Training: Great at sport, bad at work
    training_tasks = [
        # Sport tasks - high rewards
        (5, 45, 2, 48, "sport", 0.95),
        (4, 60, 3, 24, "sport", 0.90),
        (5, 30, 1, 72, "sport", 0.98),
        (4, 90, 4, 12, "sport", 0.85),
        # Work tasks - low rewards
        (3, 45, 2, 48, "work", 0.25),
        (2, 60, 3, 24, "work", 0.20),
        (3, 30, 1, 72, "work", 0.30),
        (2, 90, 4, 12, "work", 0.15),
        # Study tasks - medium rewards
        (4, 45, 2, 48, "study", 0.60),
        (3, 60, 3, 24, "study", 0.55),
    ]

    print("\nTraining Phase:")
    print("-" * 60)
    for i, (mot, dur, diff, hours, cat, reward) in enumerate(training_tasks):
        x = get_features(mot, dur, diff, hours, cat)
        model.update(x, reward)
        print(f"  Task {i+1}: {cat:6} | Reward={reward:.2f}")

    print("\nPredictions After Training (same task parameters, different categories):")
    print("-" * 60)

    # Same task parameters, different categories
    base_params = (4, 60, 3, 48)  # motivation, duration, difficulty, hours

    scores = {}
    for cat in ["sport", "study", "work"]:
        x = get_features(*base_params, cat)
        score = model.predict_score(x)
        category = model.predict_category(x)
        scores[cat] = score
        print_prediction(f"{cat.upper()} task (same parameters)", score, category)

    # Verify Sport > Study > Work
    test_passed = scores["sport"] > scores["study"] > scores["work"]
    print(
        f"\n{'PASSED' if test_passed else 'FAILED'} - Model learned: Sport > Study > Work for this user"
    )
    return test_passed


# =============================================================================
# TEST 4: SHORT TASK LOVER
# =============================================================================
def test_short_task_lover():
    """
    Simulates a user who excels at short tasks but struggles with long ones.
    """
    print_header("TEST 4: SHORT TASK LOVER")
    print("\nProfile: Great focus for short tasks, loses concentration on long tasks")

    model = create_model(alpha=0.1)

    # Training: Good at short tasks, bad at long tasks
    training_tasks = [
        # Short tasks (< 30 min) - high rewards
        (4, 15, 2, 48, "work", 0.95),
        (4, 20, 3, 24, "study", 0.90),
        (4, 25, 2, 72, "home", 0.92),
        (4, 30, 3, 12, "health", 0.88),
        # Long tasks (> 90 min) - low rewards
        (4, 90, 2, 48, "work", 0.30),
        (4, 100, 3, 24, "study", 0.25),
        (4, 110, 2, 72, "home", 0.20),
        (4, 120, 3, 12, "health", 0.15),
    ]

    print("\nTraining Phase:")
    print("-" * 60)
    for i, (mot, dur, diff, hours, cat, reward) in enumerate(training_tasks):
        x = get_features(mot, dur, diff, hours, cat)
        model.update(x, reward)
        duration_label = "SHORT" if dur <= 30 else "LONG"
        print(f"  Task {i+1}: {duration_label:5} ({dur:3} min) | Reward={reward:.2f}")

    print("\nPredictions After Training (same parameters, different durations):")
    print("-" * 60)

    scores = {}
    for duration in [15, 45, 90, 120]:
        x = get_features(4, duration, 3, 48, "work")
        score = model.predict_score(x)
        category = model.predict_category(x)
        scores[duration] = score
        print_prediction(f"Task duration: {duration} minutes", score, category)

    # Verify short tasks have higher scores than long tasks
    test_passed = scores[15] > scores[45] > scores[90] > scores[120]
    print(
        f"\n{'PASSED' if test_passed else 'FAILED'} - Model learned: Short tasks = Better performance"
    )
    return test_passed


# =============================================================================
# TEST 5: PRESSURE PERFORMER
# =============================================================================
def test_pressure_performer():
    """
    Simulates a user who performs BETTER under deadline pressure.
    """
    print_header("TEST 5: PRESSURE PERFORMER")
    print("\nProfile: Thrives under pressure, lazy without deadlines")

    model = create_model(alpha=0.1)

    # Training: Good with pressure, bad without
    training_tasks = [
        # Urgent (< 6 hours) - high rewards
        (4, 45, 3, 2, "work", 0.90),
        (4, 45, 3, 4, "study", 0.88),
        (4, 45, 3, 5, "home", 0.85),
        # Strong pressure (6-24 hours) - good rewards
        (4, 45, 3, 12, "work", 0.80),
        (4, 45, 3, 18, "study", 0.75),
        # No pressure (> 72 hours) - low rewards
        (4, 45, 3, 100, "work", 0.25),
        (4, 45, 3, 120, "study", 0.20),
        (4, 45, 3, 168, "home", 0.15),
    ]

    print("\nTraining Phase:")
    print("-" * 60)
    for i, (mot, dur, diff, hours, cat, reward) in enumerate(training_tasks):
        x = get_features(mot, dur, diff, hours, cat)
        model.update(x, reward)
        if hours <= 6:
            pressure = "URGENT"
        elif hours <= 24:
            pressure = "STRONG"
        elif hours <= 72:
            pressure = "MILD"
        else:
            pressure = "NONE"
        print(
            f"  Task {i+1}: {pressure:6} ({hours:3}h to deadline) | Reward={reward:.2f}"
        )

    print("\nPredictions After Training (same task, different deadlines):")
    print("-" * 60)

    scores = {}
    for hours in [2, 12, 48, 120]:
        x = get_features(4, 45, 3, hours, "work")
        score = model.predict_score(x)
        category = model.predict_category(x)
        scores[hours] = score
        if hours <= 6:
            label = f"URGENT ({hours}h left)"
        elif hours <= 24:
            label = f"Strong pressure ({hours}h left)"
        elif hours <= 72:
            label = f"Mild pressure ({hours}h left)"
        else:
            label = f"No pressure ({hours}h left)"
        print_prediction(label, score, category)

    # Verify more pressure = higher score
    test_passed = scores[2] > scores[12] > scores[120]
    print(
        f"\n{'PASSED' if test_passed else 'FAILED'} - Model learned: More pressure = Better performance"
    )
    return test_passed


# =============================================================================
# TEST 6: IMPROVING USER
# =============================================================================
def test_improving_user():
    """
    Simulates a user whose performance improves over time.
    Shows how the model adapts to changing behavior.
    """
    print_header("TEST 6: IMPROVING USER")
    print("\nProfile: Started poorly, getting better with each task")

    model = create_model(alpha=0.1)

    # Standard test task
    test_task = get_features(4, 60, 3, 48, "work")

    print("\nBehavior Evolution:")
    print("-" * 60)
    print(f"{'Phase':<12} {'Avg Reward':<12} {'Predicted Score':<18} {'Category'}")
    print("-" * 60)

    # Phase 1: Poor performance
    initial_score = model.predict_score(test_task)
    initial_cat = model.predict_category(test_task)
    print(f"{'Initial':<12} {'-':<12} {initial_score:<18.4f} {initial_cat}")

    phases = [
        ("Week 1", [0.15, 0.20, 0.18, 0.22, 0.25]),
        ("Week 2", [0.35, 0.40, 0.38, 0.42, 0.45]),
        ("Week 3", [0.55, 0.60, 0.58, 0.62, 0.65]),
        ("Week 4", [0.75, 0.80, 0.78, 0.82, 0.85]),
        ("Week 5", [0.88, 0.90, 0.92, 0.91, 0.93]),
    ]

    for phase_name, rewards in phases:
        for reward in rewards:
            x = get_features(4, 60, 3, 48, "work")
            model.update(x, reward)

        score = model.predict_score(test_task)
        category = model.predict_category(test_task)
        avg_reward = sum(rewards) / len(rewards)
        print(f"{phase_name:<12} {avg_reward:<12.2f} {score:<18.4f} {category}")

    final_score = model.predict_score(test_task)
    final_cat = model.predict_category(test_task)

    # Verify improvement: final score > initial score
    test_passed = final_score > initial_score and final_cat < initial_cat
    print(
        f"\n{'PASSED' if test_passed else 'FAILED'} - Model adapted: Predictions improved as user performance improved"
    )
    return test_passed


# =============================================================================
# TEST 7: DECLINING USER
# =============================================================================
def test_declining_user():
    """
    Simulates a user whose performance declines over time (burnout).
    """
    print_header("TEST 7: DECLINING USER (Burnout)")
    print("\nProfile: Started strong, performance declining over time")

    model = create_model(alpha=0.1)

    test_task = get_features(4, 60, 3, 48, "work")

    print("\nBehavior Evolution:")
    print("-" * 60)
    print(f"{'Phase':<12} {'Avg Reward':<12} {'Predicted Score':<18} {'Category'}")
    print("-" * 60)

    initial_score = model.predict_score(test_task)
    initial_cat = model.predict_category(test_task)
    print(f"{'Initial':<12} {'-':<12} {initial_score:<18.4f} {initial_cat}")

    phases = [
        ("Week 1", [0.92, 0.95, 0.90, 0.88, 0.93]),
        ("Week 2", [0.80, 0.75, 0.78, 0.72, 0.70]),
        ("Week 3", [0.60, 0.55, 0.58, 0.52, 0.50]),
        ("Week 4", [0.40, 0.35, 0.38, 0.32, 0.30]),
        ("Week 5", [0.20, 0.15, 0.18, 0.12, 0.10]),
    ]

    peak_score = 0
    peak_cat = 5
    for phase_name, rewards in phases:
        for reward in rewards:
            x = get_features(4, 60, 3, 48, "work")
            model.update(x, reward)

        score = model.predict_score(test_task)
        category = model.predict_category(test_task)
        avg_reward = sum(rewards) / len(rewards)
        print(f"{phase_name:<12} {avg_reward:<12.2f} {score:<18.4f} {category}")

        # Track the peak (best) score after Week 1
        if phase_name == "Week 1":
            peak_score = score
            peak_cat = category

    # Final prediction details
    final_score = model.predict_score(test_task)
    final_category = model.predict_category(test_task)

    print("\nFinal Prediction After Burnout:")
    print("-" * 60)
    print(f"  Score: {final_score:.4f}")
    print(f"  Category: {final_category}")
    category_names = {
        1: "Will complete very quickly",
        2: "Will complete on time",
        3: "Will complete slightly late",
        4: "Will complete significantly late",
        5: "Will NOT complete",
    }
    print(f"  Meaning: {category_names[final_category]}")
    print(f"  Peak score (Week 1): {peak_score:.4f} (Category {peak_cat})")
    print(f"  Score dropped by: {peak_score - final_score:.4f}")

    # Return test result for verification - compare peak to final
    test_passed = final_score < peak_score and final_category > peak_cat
    print(
        f"\n{'PASSED' if test_passed else 'FAILED'} - Model adapted: Predictions declined as user experienced burnout"
    )
    return test_passed


# =============================================================================
# TEST 8: INCONSISTENT USER
# =============================================================================
def test_inconsistent_user():
    """
    Simulates a user with highly variable/unpredictable performance.
    """
    print_header("TEST 8: INCONSISTENT USER")
    print("\nProfile: Unpredictable performance, high variance in results")

    model = create_model(alpha=0.1)

    test_task = get_features(4, 60, 3, 48, "work")

    # Random-ish rewards alternating between good and bad
    training_rewards = [
        0.90,
        0.15,
        0.85,
        0.20,
        0.10,
        0.95,
        0.25,
        0.80,
        0.15,
        0.90,
        0.30,
        0.85,
        0.20,
        0.92,
        0.18,
        0.88,
    ]

    print("\nTraining with Inconsistent Rewards:")
    print("-" * 60)

    scores_over_time = []
    for i, reward in enumerate(training_rewards):
        x = get_features(4, 60, 3, 48, "work")
        score_before = model.predict_score(x)
        model.update(x, reward)
        score_after = model.predict_score(x)
        scores_over_time.append(score_after)

        print(
            f"  Task {i+1:2}: Reward={reward:.2f} | Score: {score_before:.3f} → {score_after:.3f}"
        )

    final_score = model.predict_score(test_task)
    final_category = model.predict_category(test_task)
    avg_reward = sum(training_rewards) / len(training_rewards)

    print(f"\nFinal Prediction:")
    print(f"  Score: {final_score:.4f}")
    print(f"  Category: {final_category}")
    print(f"  Average training reward: {avg_reward:.2f}")

    # Verify model converged to average
    test_passed = (
        abs(final_score - avg_reward) < 0.15
    )  # Score should be close to average
    print(
        f"\n{'PASSED' if test_passed else 'FAILED'} - Model learned: Converged to average behavior despite variance"
    )
    return test_passed


# =============================================================================
# TEST 9: COMPARATIVE ANALYSIS
# =============================================================================
def test_comparative_analysis():
    """
    Creates multiple user models and compares their predictions side by side.
    """
    print_header("TEST 9: COMPARATIVE ANALYSIS")
    print("\nComparing predictions for the SAME task across different user types")

    # Create separate models for different user types
    models = {
        "High Performer": create_model(),
        "Procrastinator": create_model(),
        "Sport Lover": create_model(),
        "Work Avoider": create_model(),
    }

    # Train each model with their characteristic behavior
    # High Performer - good at ALL categories
    for cat in CATEGORIES:
        for _ in range(3):
            x = get_features(5, 60, 3, 48, cat)
            models["High Performer"].update(x, np.random.uniform(0.85, 0.98))

    # Procrastinator - bad at ALL categories
    for cat in CATEGORIES:
        for _ in range(3):
            x = get_features(2, 60, 3, 48, cat)
            models["Procrastinator"].update(x, np.random.uniform(0.05, 0.25))

    # Sport Lover - good at sport, okay at work
    for _ in range(5):
        x = get_features(5, 60, 3, 48, "sport")
        models["Sport Lover"].update(x, np.random.uniform(0.85, 0.95))
        x = get_features(4, 60, 3, 48, "work")
        models["Sport Lover"].update(x, np.random.uniform(0.40, 0.60))

    # Work Avoider - bad at work, okay at others
    for _ in range(5):
        x = get_features(2, 60, 3, 48, "work")
        models["Work Avoider"].update(x, np.random.uniform(0.10, 0.25))
        x = get_features(4, 60, 3, 48, "home")
        models["Work Avoider"].update(x, np.random.uniform(0.60, 0.80))

    # Compare predictions for various tasks
    # All tasks use similar base parameters to fairly compare users
    # (motivation, duration, difficulty, hours_to_deadline, category)
    test_tasks = [
        ("Work task (medium)", 4, 60, 3, 48, "work"),
        ("Sport task (medium)", 4, 60, 3, 48, "sport"),
        ("Study task (medium)", 4, 60, 3, 48, "study"),
        ("Home task (medium)", 4, 60, 3, 48, "home"),
    ]

    print("\nPrediction Comparison:")
    print("-" * 80)

    for task_label, mot, dur, diff, hours, cat in test_tasks:
        print(f"\n  {task_label}:")
        x = get_features(mot, dur, diff, hours, cat)

        for user_type, model in models.items():
            score = model.predict_score(x)
            category = model.predict_category(x)
            print(f"    {user_type:<16} Score: {score:6.3f} | Category: {category}")

    # Verify different users have different predictions
    x_work = get_features(4, 60, 3, 48, "work")
    high_perf_score = models["High Performer"].predict_score(x_work)
    procrast_score = models["Procrastinator"].predict_score(x_work)
    test_passed = high_perf_score > procrast_score

    print(
        f"\n{'PASSED' if test_passed else 'FAILED'} - Same task, different predictions based on learned user behavior"
    )
    return test_passed


# =============================================================================
# MAIN
# =============================================================================
def main():
    """Run all user behavior learning tests."""
    print("\n" + "=" * 70)
    print("       USER BEHAVIOR LEARNING TEST SUITE")
    print("       MultiFeatureLinUCB Model Demonstration")
    print("=" * 70)
    print("\nThis suite demonstrates how the model learns and adapts to")
    print("different user behavior patterns over time.\n")

    # Track test results
    results = {}

    # Tests that return True/False for verification
    tests_with_verification = [
        ("High Performer", test_high_performer),
        ("Procrastinator", test_procrastinator),
        ("Category Expert", test_category_specialist),
        ("Short Task Lover", test_short_task_lover),
        ("Pressure Performer", test_pressure_performer),
        ("Improving User", test_improving_user),
        ("Declining User", test_declining_user),
        ("Inconsistent User", test_inconsistent_user),
        ("Comparative", test_comparative_analysis),
    ]

    for test_name, test_func in tests_with_verification:
        result = test_func()
        results[test_name] = result if result is not None else True

    # Print summary with verification
    print("\n" + "=" * 70)
    all_passed = all(results.values())
    if all_passed:
        print("       ALL TESTS COMPLETED SUCCESSFULLY")
    else:
        print("       SOME TESTS FAILED")
    print("=" * 70)
    print("\nSummary of Learned Behaviors:")
    print("-" * 70)

    summaries = [
        ("High Performer", "Model predicts high completion rates"),
        ("Procrastinator", "Model predicts low completion rates"),
        ("Category Expert", "Model learns category preferences"),
        ("Short Task Lover", "Model learns duration preferences"),
        ("Pressure Performer", "Model learns deadline behavior"),
        ("Improving User", "Model adapts to positive changes"),
        ("Declining User", "Model adapts to negative changes"),
        ("Inconsistent User", "Model converges to average behavior"),
        ("Comparative", "Different users = Different predictions"),
    ]

    for i, (name, description) in enumerate(summaries, 1):
        status = "PASSED" if results.get(name, False) else "FAILED"
        print(f"  [{status}] {i}. {name:<17} -> {description}")

    print("-" * 70)
    passed_count = sum(1 for v in results.values() if v)
    print(f"\n  Results: {passed_count}/{len(results)} tests passed")


if __name__ == "__main__":
    main()
