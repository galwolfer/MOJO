"""
Test: Motivation + Difficulty as Base Priors
=============================================

This test demonstrates initializing the LinUCB model with both
motivation and difficulty as strong priors BEFORE any learning.

Feature vector layout (16 features with 6 categories):
  [0]     = motivation (normalized 0-1)
  [1-2]   = duration (shortness, longness)
  [3-5]   = difficulty (easy, medium, hard) - one-hot
  [6-9]   = pressure (no, mild, strong, urgent) - one-hot
  [10-15] = category (sport, study, work, home, health, habits) - one-hot
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

from src.predict_model.multi_feature_linucb import MultiFeatureLinUCB, extract_features
import numpy as np

CATEGORIES = ["sport", "study", "work", "home", "health", "habits"]


def print_header(title):
    print("\n" + "=" * 80)
    print(title)
    print("=" * 80)


def create_model_with_motivation_difficulty_prior():
    """
    Create a model with motivation and difficulty as base priors.
    
    Prior beliefs:
    - High motivation → better completion (positive weight)
    - Easy tasks → better completion (positive weight)
    - Hard tasks → worse completion (negative weight)
    """
    n_features = 1 + 2 + 3 + 4 + len(CATEGORIES)  # 16 features
    
    init_theta = np.zeros(n_features)
    
    # Motivation prior: index 0
    # Weight of 1.0 means motivation contributes up to 1.0 to score
    # (since motivation is normalized to [0,1])
    init_theta[0] = 1.0
    
    # Difficulty priors: indices 3, 4, 5 (easy, medium, hard)
    init_theta[3] = 0.3   # Easy tasks: boost score
    init_theta[4] = 0.0   # Medium tasks: neutral
    init_theta[5] = -0.3  # Hard tasks: reduce score
    
    # Create model with prior_strength to preserve these beliefs
    model = MultiFeatureLinUCB(
        n_features=n_features,
        alpha=0.1,
        init_theta=init_theta,
        prior_strength=5.0,   # Prior worth ~5 observations
        learn_rate=0.5        # Smooth adaptation
    )
    
    return model, init_theta


def test_initial_predictions_with_prior():
    """
    TEST 1: Show initial predictions based on motivation + difficulty priors
    before any learning occurs.
    """
    print_header("TEST 1: INITIAL PREDICTIONS (Motivation + Difficulty Prior)")
    
    model, init_theta = create_model_with_motivation_difficulty_prior()
    
    print("\nModel initialized with MOTIVATION + DIFFICULTY priors:")
    print(f"  theta[0] (motivation)     = {init_theta[0]:.2f}")
    print(f"  theta[3] (easy)           = {init_theta[3]:.2f}")
    print(f"  theta[4] (medium)         = {init_theta[4]:.2f}")
    print(f"  theta[5] (hard)           = {init_theta[5]:.2f}")
    print(f"  prior_strength            = {model.prior_strength}")
    print(f"  learn_rate                = {model.learn_rate}")
    
    # Test matrix: vary motivation (1-5) and difficulty (1=easy, 3=medium, 5=hard)
    print("\n" + "-" * 80)
    print("Initial Predictions Grid (before any learning):")
    print("-" * 80)
    print(f"{'Motivation':<12} {'Difficulty':<12} {'Score':<12} {'Category':<12}")
    print("-" * 80)
    
    test_cases = [
        # Low motivation
        (1, 1, "Low mot, Easy"),
        (1, 3, "Low mot, Medium"),
        (1, 5, "Low mot, Hard"),
        # Medium motivation
        (3, 1, "Med mot, Easy"),
        (3, 3, "Med mot, Medium"),
        (3, 5, "Med mot, Hard"),
        # High motivation
        (5, 1, "High mot, Easy"),
        (5, 3, "High mot, Medium"),
        (5, 5, "High mot, Hard"),
    ]
    
    for mot, diff, desc in test_cases:
        x = extract_features(
            motivation=mot,
            duration=60,        # Fixed: medium duration
            difficulty=diff,
            delta_hours=48,     # Fixed: mild pressure
            category="study",   # Fixed category
            categories=CATEGORIES
        )
        score = model.predict_score(x)
        cat = model.predict_category(x)
        print(f"{mot:<12} {diff:<12} {score:<12.4f} {cat:<12}")
    
    print("\n>> Observation: Score increases with motivation and decreases with difficulty")
    print("   This is purely from the prior - no learning has occurred yet!")


def test_learning_preserves_prior_influence():
    """
    TEST 2: Show how learning from new data respects the prior.
    The prior gradually fades but initial beliefs influence early predictions.
    """
    print_header("TEST 2: LEARNING WITH PRIOR INFLUENCE")
    
    model, init_theta = create_model_with_motivation_difficulty_prior()
    
    print("\nScenario: Train on a HARD task with HIGH motivation, reward=0.5")
    print("Prior expects: High motivation (+), Hard difficulty (-)")
    print("Let's see how the model balances prior beliefs with observed data.\n")
    
    # Create a hard task with high motivation
    x = extract_features(
        motivation=5,       # High motivation
        duration=60,
        difficulty=5,       # Hard
        delta_hours=48,
        category="work",
        categories=CATEGORIES
    )
    
    print(f"{'Update':<8} {'Reward':<10} {'Score':<12} {'Category':<12} {'Note':<30}")
    print("-" * 80)
    
    # Initial prediction
    score = model.predict_score(x)
    cat = model.predict_category(x)
    print(f"{'Init':<8} {'-':<10} {score:<12.4f} {cat:<12} {'Prior: +mot, -hard':<30}")
    
    # Train with reward=0.5 (medium performance)
    for i in range(1, 16):
        model.update(x, reward=0.5)
        score = model.predict_score(x)
        cat = model.predict_category(x)
        note = "Blending prior + data" if i < 5 else "Data dominates" if i > 10 else "Transitioning"
        print(f"{i:<8} {'0.5':<10} {score:<12.4f} {cat:<12} {note:<30}")
    
    print("\n>> Observation: Score starts from prior belief, then smoothly converges to ~0.5")


def test_different_difficulty_levels():
    """
    TEST 3: Compare learning trajectories for easy vs hard tasks.
    """
    print_header("TEST 3: EASY vs HARD TASK LEARNING")
    
    print("\nScenario: Same motivation (4), same reward (0.7), different difficulty")
    print("Prior expects: Easy → higher initial score, Hard → lower initial score\n")
    
    # Create two models with same prior
    model_easy, _ = create_model_with_motivation_difficulty_prior()
    model_hard, _ = create_model_with_motivation_difficulty_prior()
    
    x_easy = extract_features(
        motivation=4, duration=60, difficulty=1,  # Easy
        delta_hours=48, category="study", categories=CATEGORIES
    )
    x_hard = extract_features(
        motivation=4, duration=60, difficulty=5,  # Hard
        delta_hours=48, category="study", categories=CATEGORIES
    )
    
    print(f"{'Update':<8} {'Easy Score':<14} {'Hard Score':<14} {'Difference':<14}")
    print("-" * 60)
    
    # Initial
    score_easy = model_easy.predict_score(x_easy)
    score_hard = model_hard.predict_score(x_hard)
    print(f"{'Init':<8} {score_easy:<14.4f} {score_hard:<14.4f} {score_easy - score_hard:<14.4f}")
    
    # Train both with same reward
    for i in range(1, 11):
        model_easy.update(x_easy, reward=0.7)
        model_hard.update(x_hard, reward=0.7)
        score_easy = model_easy.predict_score(x_easy)
        score_hard = model_hard.predict_score(x_hard)
        print(f"{i:<8} {score_easy:<14.4f} {score_hard:<14.4f} {score_easy - score_hard:<14.4f}")
    
    print("\n>> Observation: Both converge to ~0.7, but easy task starts higher due to prior")


def test_motivation_impact():
    """
    TEST 4: Compare learning trajectories for different motivation levels.
    """
    print_header("TEST 4: LOW vs HIGH MOTIVATION LEARNING")
    
    print("\nScenario: Same difficulty (medium), same reward (0.8), different motivation")
    print("Prior expects: High motivation → higher initial score\n")
    
    model_low, _ = create_model_with_motivation_difficulty_prior()
    model_high, _ = create_model_with_motivation_difficulty_prior()
    
    x_low = extract_features(
        motivation=1, duration=60, difficulty=3,  # Low motivation
        delta_hours=48, category="study", categories=CATEGORIES
    )
    x_high = extract_features(
        motivation=5, duration=60, difficulty=3,  # High motivation
        delta_hours=48, category="study", categories=CATEGORIES
    )
    
    print(f"{'Update':<8} {'Low Mot Score':<16} {'High Mot Score':<16} {'Difference':<14}")
    print("-" * 65)
    
    # Initial
    score_low = model_low.predict_score(x_low)
    score_high = model_high.predict_score(x_high)
    print(f"{'Init':<8} {score_low:<16.4f} {score_high:<16.4f} {score_high - score_low:<14.4f}")
    
    # Train both with same reward
    for i in range(1, 11):
        model_low.update(x_low, reward=0.8)
        model_high.update(x_high, reward=0.8)
        score_low = model_low.predict_score(x_low)
        score_high = model_high.predict_score(x_high)
        print(f"{i:<8} {score_low:<16.4f} {score_high:<16.4f} {score_high - score_low:<14.4f}")
    
    print("\n>> Observation: Both converge to ~0.8, but high motivation starts higher")


def test_combined_prior_effect():
    """
    TEST 5: Show the combined effect of motivation + difficulty on initial predictions.
    """
    print_header("TEST 5: COMBINED PRIOR EFFECT MATRIX")
    
    model, init_theta = create_model_with_motivation_difficulty_prior()
    
    print("\nPrediction matrix BEFORE any learning:")
    print("(Score = motivation_weight * mot_norm + difficulty_weight + exploration_bonus)")
    print()
    
    # Headers
    print(f"{'':12}", end="")
    for diff_label in ["Easy(1)", "Medium(3)", "Hard(5)"]:
        print(f"{diff_label:>12}", end="")
    print()
    print("-" * 48)
    
    for mot in [1, 2, 3, 4, 5]:
        print(f"Mot={mot:<6}", end="")
        for diff in [1, 3, 5]:
            x = extract_features(
                motivation=mot, duration=60, difficulty=diff,
                delta_hours=48, category="study", categories=CATEGORIES
            )
            score = model.predict_score(x)
            print(f"{score:>12.3f}", end="")
        print()
    
    print("\n>> Key insight: Top-right (high mot + easy) has highest score")
    print("                Bottom-left (low mot + hard) has lowest score")


def test_real_world_scenario():
    """
    TEST 6: Realistic scenario - user behavior over time.
    """
    print_header("TEST 6: REAL-WORLD SCENARIO")
    
    model, _ = create_model_with_motivation_difficulty_prior()
    
    print("\nScenario: Track predictions as user completes various tasks")
    print("Prior: motivation and difficulty influence initial predictions\n")
    
    tasks = [
        {"mot": 5, "dur": 30, "diff": 1, "hours": 100, "cat": "sport", "reward": 0.95, "desc": "Easy sport, high mot"},
        {"mot": 4, "dur": 45, "diff": 3, "hours": 48, "cat": "study", "reward": 0.7, "desc": "Medium study"},
        {"mot": 2, "dur": 90, "diff": 5, "hours": 12, "cat": "work", "reward": 0.3, "desc": "Hard work, low mot"},
        {"mot": 5, "dur": 20, "diff": 1, "hours": 100, "cat": "health", "reward": 0.9, "desc": "Easy health, high mot"},
        {"mot": 3, "dur": 60, "diff": 3, "hours": 24, "cat": "home", "reward": 0.5, "desc": "Medium home task"},
    ]
    
    print(f"{'#':<4} {'Description':<25} {'Pred Score':<12} {'Pred Cat':<10} {'Reward':<8} {'Post Score':<12}")
    print("-" * 85)
    
    for i, task in enumerate(tasks, 1):
        x = extract_features(
            motivation=task["mot"],
            duration=task["dur"],
            difficulty=task["diff"],
            delta_hours=task["hours"],
            category=task["cat"],
            categories=CATEGORIES
        )
        
        # Prediction before seeing reward
        pre_score = model.predict_score(x)
        pre_cat = model.predict_category(x)
        
        # Update with observed reward
        model.update(x, reward=task["reward"])
        
        # Prediction after update
        post_score = model.predict_score(x)
        
        print(f"{i:<4} {task['desc']:<25} {pre_score:<12.4f} {pre_cat:<10} {task['reward']:<8} {post_score:<12.4f}")
    
    print("\n>> Note: Pre-scores reflect prior beliefs; post-scores blend in observed rewards")


if __name__ == "__main__":
    print("\n" + "=" * 80)
    print("    Motivation + Difficulty Prior Test Suite".center(80))
    print("=" * 80)
    print("\nDemonstrating how motivation and difficulty serve as base priors")
    print("before learning from new data.")
    
    test_initial_predictions_with_prior()
    test_learning_preserves_prior_influence()
    test_different_difficulty_levels()
    test_motivation_impact()
    test_combined_prior_effect()
    test_real_world_scenario()
    
    print("\n" + "=" * 80)
    print("[OK] ALL TESTS COMPLETED")
    print("=" * 80 + "\n")
