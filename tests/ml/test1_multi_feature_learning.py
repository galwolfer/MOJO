"""
Comprehensive Test Suite for MultiFeatureLinUCB with Feature-by-Feature Learning
==================================================================================

This test file demonstrates:
1. Initial predictions WITHOUT learning (before any updates)
2. Feature-specific learning: how the model learns each feature independently
   - Motivation feature
   - Duration feature (short vs long tasks)
   - Difficulty feature (easy, medium, hard)
   - Time pressure feature (no, mild, strong, urgent)
   - Task category feature (sport, study, work, etc.)
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

from src.predict_model.multi_feature_linucb import MultiFeatureLinUCB, extract_features
import numpy as np


# Define task categories
CATEGORIES = ["sport", "study", "work", "home", "health", "habits"]


def print_header(title):
    """Helper to print formatted section headers."""
    print("\n" + "=" * 80)
    print(title)
    print("=" * 80)


def print_results(results):
    """Helper to print prediction results."""
    category_names = {
        1: "Completed Very Quickly",
        2: "Completed On Time",
        3: "Slightly Late",
        4: "Significantly Late",
        5: "Not Completed"
    }
    
    for result in results:
        cat_name = category_names[result['category']]
        print(f"  Motivation={result.get('motivation', '-'):<2} "
              f"Duration={result.get('duration', '-'):<3} "
              f"Difficulty={result.get('difficulty', '-'):<2} "
              f"Pressure={result.get('pressure', '-'):<6} "
              f"Category={result.get('category_name', '-'):<8} "
              f"| Score={result['score']:.6f} -> Pred={result['category']} ({cat_name})")


def test_initial_predictions():
    """
    TEST 1: INITIAL PREDICTIONS (No Learning)
    ===========================================
    
    Show predictions for various tasks BEFORE the model has learned anything.
    This demonstrates the default behavior with random theta initialization.
    """
    print_header("TEST 1: INITIAL PREDICTIONS (No Learning)")
    
    # Initialize the model with strong bias toward motivation feature
    n_features = (
        1 +  # motivation
        2 +  # duration (short/long)
        3 +  # difficulty (easy/medium/hard)
        4 +  # pressure (no/mild/strong/urgent)
        len(CATEGORIES)  # task categories
    )
    # Create initial theta with strong weight on motivation (position 0)
    init_theta = np.zeros(n_features)
    init_theta[0] = 2.0  # Strong initial bias toward motivation
    model = MultiFeatureLinUCB(n_features=n_features, alpha=0.1, init_theta=init_theta)
    
    print(f"\nModel initialized with MOTIVATION BIAS:")
    print(f"  Features: {n_features}")
    print(f"  Alpha (exploration): {model.alpha}")
    print(f"  Initial theta[0] (motivation): {init_theta[0]} (strongly biased)")
    print(f"  Other theta values: 0.0 (will learn as we train)")
    
    # Test various tasks
    print(f"\nInitial Predictions for Various Tasks:")
    print("-" * 80)
    
    test_cases = [
        {"motivation": 1, "duration": 10, "difficulty": 1, "delta_hours": 100, "category": "sport", "desc": "Low motivation, short, easy, no pressure, sport"},
        {"motivation": 3, "duration": 60, "difficulty": 3, "delta_hours": 24, "category": "study", "desc": "Medium motivation, medium, medium, mild pressure, study"},
        {"motivation": 5, "duration": 120, "difficulty": 5, "delta_hours": 2, "category": "work", "desc": "High motivation, long, hard, urgent, work"},
    ]
    
    results = []
    for case in test_cases:
        x = extract_features(
            motivation=case["motivation"],
            duration=case["duration"],
            difficulty=case["difficulty"],
            delta_hours=case["delta_hours"],
            category=case["category"],
            categories=CATEGORIES,
            max_duration=120
        )
        
        score = model.predict_score(x)
        category = model.predict_category(x)
        
        print(f"  {case['desc']}")
        print(f"    Score: {score:.6f}, Category: {category}")
        
        results.append({
            'motivation': case['motivation'],
            'duration': case['duration'],
            'difficulty': case['difficulty'],
            'pressure': case['delta_hours'],
            'category_name': case['category'],
            'score': score,
            'category': category
        })
    
    print("\n>> Observation: Even without learning, predictions vary slightly")
    print("   due to the exploration bonus applied to the zero-initialized weights.")
    
    return model, results


def test_motivation_feature_learning():
    """
    TEST 2: MOTIVATION FEATURE LEARNING
    ====================================
    
    Test how the model learns the motivation feature.
    We fix all other features and vary only motivation.
    
    Hypothesis: High motivation should lead to fast completion -> higher scores
    """
    print_header("TEST 2: MOTIVATION FEATURE LEARNING")
    
    # We'll run two independent sub-tests so results are not mixed:
    # 1) training on low motivation only
    # 2) training on high motivation only
    n_features = 1 + 2 + 3 + 4 + len(CATEGORIES)
    print("\nScenario: All tasks are identical EXCEPT motivation level")
    print("  Duration: 60 min (medium)")
    print("  Difficulty: 3 (medium)")
    print("  Time pressure: 48 hours (mild)")
    print("  Category: study")

    # Sub-test A: Low motivation only
    print_header("TEST 2A: MOTIVATION LOW (train on motivation=1)")
    init_theta = np.zeros(n_features)
    init_theta[0] = 2.0
    model_low = MultiFeatureLinUCB(n_features=n_features, alpha=0.1, init_theta=init_theta, prior_strength=5.0, learn_rate=0.5)
    x_low = extract_features(motivation=1, duration=60, difficulty=3, delta_hours=48, category="study", categories=CATEGORIES)
    print(f"\n{'Update':<8} {'Motivation':<12} {'Reward':<10} {'Score':<18} {'Category':<12}")
    print("-" * 70)
    print(f"{'Init':<8} {'1':<12} {'-':<10} {model_low.predict_score(x_low):<18.6f} {model_low.predict_category(x_low):<12}")
    for i in range(1, 11):
        model_low.update(x_low, reward=0.2)
        print(f"{i:<8} {'1':<12} {'0.2':<10} {model_low.predict_score(x_low):<18.6f} {model_low.predict_category(x_low):<12}")

    # Sub-test B: High motivation only
    print_header("TEST 2B: MOTIVATION HIGH (train on motivation=5)")
    init_theta = np.zeros(n_features)
    init_theta[0] = 2.0
    model_high = MultiFeatureLinUCB(n_features=n_features, alpha=0.1, init_theta=init_theta, prior_strength=5.0, learn_rate=0.5)
    x_high = extract_features(motivation=5, duration=60, difficulty=3, delta_hours=48, category="study", categories=CATEGORIES)
    print(f"\n{'Update':<8} {'Motivation':<12} {'Reward':<10} {'Score':<18} {'Category':<12}")
    print("-" * 70)
    print(f"{'Init':<8} {'5':<12} {'-':<10} {model_high.predict_score(x_high):<18.6f} {model_high.predict_category(x_high):<12}")
    for i in range(1, 11):
        model_high.update(x_high, reward=1.0)
        print(f"{i:<8} {'5':<12} {'1.0':<10} {model_high.predict_score(x_high):<18.6f} {model_high.predict_category(x_high):<12}")

    print(f"\n[OK] Result: Motivation feature tested in two separated sub-tests.")


def test_duration_feature_learning():
    """
    TEST 3: DURATION FEATURE LEARNING
    ==================================
    
    Test how the model learns the duration feature.
    We fix all other features and vary only task duration.
    
    Hypothesis: Short tasks should have better completion rates
    """
    print_header("TEST 3: DURATION FEATURE LEARNING")
    
    n_features = 1 + 2 + 3 + 4 + len(CATEGORIES)
    print("\nScenario: All tasks are identical EXCEPT duration")
    print("  Motivation: 3 (medium)")
    print("  Difficulty: 3 (medium)")
    print("  Time pressure: 48 hours (mild)")
    print("  Category: study")
    print("\nTraining: Short tasks (10 min) get high reward (0.9)")
    print("          Long tasks (120 min) get low reward (0.3)")

    # Sub-test A: Short tasks only
    print_header("TEST 3A: DURATION SHORT (train on 10 min)")
    init_theta = np.zeros(n_features)
    init_theta[0] = 2.0
    model_short = MultiFeatureLinUCB(n_features=n_features, alpha=0.1, init_theta=init_theta)
    x_short = extract_features(motivation=3, duration=10, difficulty=3, delta_hours=48, category="study", categories=CATEGORIES)
    print(f"\n{'Update':<8} {'Duration':<12} {'Reward':<10} {'Score':<18} {'Category':<12}")
    print("-" * 70)
    print(f"{'Init':<8} {'10':<12} {'-':<10} {model_short.predict_score(x_short):<18.6f} {model_short.predict_category(x_short):<12}")
    for i in range(1, 11):
        model_short.update(x_short, reward=0.9)
        print(f"{i:<8} {'10':<12} {'0.9':<10} {model_short.predict_score(x_short):<18.6f} {model_short.predict_category(x_short):<12}")

    # Sub-test B: Long tasks only
    print_header("TEST 3B: DURATION LONG (train on 120 min)")
    init_theta = np.zeros(n_features)
    init_theta[0] = 2.0
    model_long = MultiFeatureLinUCB(n_features=n_features, alpha=0.1, init_theta=init_theta)
    x_long = extract_features(motivation=3, duration=120, difficulty=3, delta_hours=48, category="study", categories=CATEGORIES)
    print(f"\n{'Update':<8} {'Duration':<12} {'Reward':<10} {'Score':<18} {'Category':<12}")
    print("-" * 70)
    print(f"{'Init':<8} {'120':<12} {'-':<10} {model_long.predict_score(x_long):<18.6f} {model_long.predict_category(x_long):<12}")
    for i in range(1, 11):
        model_long.update(x_long, reward=0.3)
        print(f"{i:<8} {'120':<12} {'0.3':<10} {model_long.predict_score(x_long):<18.6f} {model_long.predict_category(x_long):<12}")

    print(f"\n[OK] Result: Duration feature tested in two separated sub-tests.")


def test_difficulty_feature_learning():
    """
    TEST 4: DIFFICULTY FEATURE LEARNING
    ====================================
    
    Test how the model learns the difficulty feature.
    We fix all other features and vary only difficulty (easy, medium, hard).
    
    Hypothesis: Easy tasks should have better completion rates
    """
    print_header("TEST 4: DIFFICULTY FEATURE LEARNING")
    
    n_features = 1 + 2 + 3 + 4 + len(CATEGORIES)
    print("\nScenario: All tasks are identical EXCEPT difficulty")
    print("  Motivation: 4 (high)")
    print("  Duration: 60 min (medium)")
    print("  Time pressure: 48 hours (mild)")
    print("  Category: work")
    print("\nTraining: Easy tasks (difficulty=1) get high reward (0.95)")
    print("          Medium tasks (difficulty=3) get medium reward (0.5)")
    print("          Hard tasks (difficulty=5) get low reward (0.2)")

    # Sub-test A: Easy only
    print_header("TEST 4A: DIFFICULTY EASY (train on difficulty=1)")
    init_theta = np.zeros(n_features); init_theta[0] = 2.0
    model_easy = MultiFeatureLinUCB(n_features=n_features, alpha=0.1, init_theta=init_theta)
    x_easy = extract_features(motivation=4, duration=60, difficulty=1, delta_hours=48, category="work", categories=CATEGORIES)
    print(f"\n{'Update':<8} {'Difficulty':<12} {'Reward':<10} {'Score':<18} {'Category':<12}")
    print("-" * 70)
    print(f"{'Init':<8} {'1':<12} {'-':<10} {model_easy.predict_score(x_easy):<18.6f} {model_easy.predict_category(x_easy):<12}")
    for i in range(1, 11):
        model_easy.update(x_easy, reward=0.95)
        print(f"{i:<8} {'1':<12} {'0.95':<10} {model_easy.predict_score(x_easy):<18.6f} {model_easy.predict_category(x_easy):<12}")

    # Sub-test B: Medium only
    print_header("TEST 4B: DIFFICULTY MEDIUM (train on difficulty=3)")
    init_theta = np.zeros(n_features); init_theta[0] = 2.0
    model_med = MultiFeatureLinUCB(n_features=n_features, alpha=0.1, init_theta=init_theta)
    x_med = extract_features(motivation=4, duration=60, difficulty=3, delta_hours=48, category="work", categories=CATEGORIES)
    print(f"\n{'Update':<8} {'Difficulty':<12} {'Reward':<10} {'Score':<18} {'Category':<12}")
    print("-" * 70)
    print(f"{'Init':<8} {'3':<12} {'-':<10} {model_med.predict_score(x_med):<18.6f} {model_med.predict_category(x_med):<12}")
    for i in range(1, 11):
        model_med.update(x_med, reward=0.5)
        print(f"{i:<8} {'3':<12} {'0.5':<10} {model_med.predict_score(x_med):<18.6f} {model_med.predict_category(x_med):<12}")

    # Sub-test C: Hard only
    print_header("TEST 4C: DIFFICULTY HARD (train on difficulty=5)")
    init_theta = np.zeros(n_features); init_theta[0] = 2.0
    model_hard = MultiFeatureLinUCB(n_features=n_features, alpha=0.1, init_theta=init_theta)
    x_hard = extract_features(motivation=4, duration=60, difficulty=5, delta_hours=48, category="work", categories=CATEGORIES)
    print(f"\n{'Update':<8} {'Difficulty':<12} {'Reward':<10} {'Score':<18} {'Category':<12}")
    print("-" * 70)
    for i in range(1, 11):
        model_hard.update(x_hard, reward=0.2)
        print(f"{i:<8} {'5':<12} {'0.2':<10} {model_hard.predict_score(x_hard):<18.6f} {model_hard.predict_category(x_hard):<12}")

    print(f"\n[OK] Result: Difficulty feature tested in three separated sub-tests.")


def test_pressure_feature_learning():
    """
    TEST 5: TIME PRESSURE FEATURE LEARNING
    =======================================
    
    Test how the model learns the time pressure feature.
    We fix all other features and vary only time pressure (no, mild, strong, urgent).
    
    Hypothesis: More time pressure might lead to faster completion (motivation) or worse (stress)
    """
    print_header("TEST 5: TIME PRESSURE FEATURE LEARNING")
    
    n_features = 1 + 2 + 3 + 4 + len(CATEGORIES)
    print("\nScenario: All tasks are identical EXCEPT time pressure")
    print("  Motivation: 4 (high)")
    print("  Duration: 45 min (short-medium)")
    print("  Difficulty: 2 (easy-medium)")
    print("  Category: sport")
    print("\nTraining: No pressure (>72 hours) gets reward (0.8)")
    print("          Urgent (≤6 hours) gets reward (0.3)")

    # Sub-test A: No pressure only
    print_header("TEST 5A: PRESSURE NO (train on >72h)")
    init_theta = np.zeros(n_features); init_theta[0] = 2.0
    model_no = MultiFeatureLinUCB(n_features=n_features, alpha=0.1, init_theta=init_theta)
    x_no_pressure = extract_features(motivation=4, duration=45, difficulty=2, delta_hours=100, category="sport", categories=CATEGORIES)
    print(f"\n{'Update':<8} {'Hours':<8} {'Reward':<10} {'Score':<18} {'Category':<12}")
    print("-" * 70)
    print(f"{'Init':<8} {'100':<8} {'-':<10} {model_no.predict_score(x_no_pressure):<18.6f} {model_no.predict_category(x_no_pressure):<12}")
    for i in range(1, 11):
        model_no.update(x_no_pressure, reward=0.8)
        print(f"{i:<8} {'100':<8} {'0.8':<10} {model_no.predict_score(x_no_pressure):<18.6f} {model_no.predict_category(x_no_pressure):<12}")

    # Sub-test B: Urgent only
    print_header("TEST 5B: PRESSURE URGENT (train on <=6h)")
    init_theta = np.zeros(n_features); init_theta[0] = 2.0
    model_urgent = MultiFeatureLinUCB(n_features=n_features, alpha=0.1, init_theta=init_theta)
    x_urgent = extract_features(motivation=4, duration=45, difficulty=2, delta_hours=2, category="sport", categories=CATEGORIES)
    print(f"\n{'Update':<8} {'Hours':<8} {'Reward':<10} {'Score':<18} {'Category':<12}")
    print("-" * 70)
    print(f"{'Init':<8} {'2':<8} {'-':<10} {model_urgent.predict_score(x_urgent):<18.6f} {model_urgent.predict_category(x_urgent):<12}")
    for i in range(1, 11):
        model_urgent.update(x_urgent, reward=0.3)
        print(f"{i:<8} {'2':<8} {'0.3':<10} {model_urgent.predict_score(x_urgent):<18.6f} {model_urgent.predict_category(x_urgent):<12}")

    print(f"\n[OK] Result: Time pressure feature tested in two separated sub-tests.")


def test_category_feature_learning():
    """
    TEST 6: TASK CATEGORY FEATURE LEARNING
    =======================================
    
    Test how the model learns category preferences.
    We fix all other features and vary only the task category.
    
    Hypothesis: Different task types might have different completion rates
    """
    print_header("TEST 6: TASK CATEGORY FEATURE LEARNING")
    
    n_features = 1 + 2 + 3 + 4 + len(CATEGORIES)
    print("\nScenario: All tasks are identical EXCEPT category")
    print("  Motivation: 4 (high)")
    print("  Duration: 50 min")
    print("  Difficulty: 3 (medium)")
    print("  Time pressure: 48 hours (mild)")
    print("\nTraining: 'sport' tasks get high reward (0.9)")
    print("          'study' tasks get medium reward (0.5)")
    print("          'work' tasks get low reward (0.3)")

    # Sub-test A: Sport only
    print_header("TEST 6A: CATEGORY SPORT (train on sport)")
    init_theta = np.zeros(n_features); init_theta[0] = 2.0
    model_sport = MultiFeatureLinUCB(n_features=n_features, alpha=0.1, init_theta=init_theta)
    x_sport = extract_features(motivation=4, duration=50, difficulty=3, delta_hours=48, category="sport", categories=CATEGORIES)
    print(f"\n{'Update':<8} {'Category':<12} {'Reward':<10} {'Score':<18} {'CategoryPred':<12}")
    print("-" * 70)
    for i in range(1, 7):
        model_sport.update(x_sport, reward=0.9)
        print(f"{i:<8} {'sport':<12} {'0.9':<10} {model_sport.predict_score(x_sport):<18.6f} {model_sport.predict_category(x_sport):<12}")

    # Sub-test B: Study only
    print_header("TEST 6B: CATEGORY STUDY (train on study)")
    init_theta = np.zeros(n_features); init_theta[0] = 2.0
    model_study = MultiFeatureLinUCB(n_features=n_features, alpha=0.1, init_theta=init_theta)
    x_study = extract_features(motivation=4, duration=50, difficulty=3, delta_hours=48, category="study", categories=CATEGORIES)
    print(f"\n{'Update':<8} {'Category':<12} {'Reward':<10} {'Score':<18} {'CategoryPred':<12}")
    print("-" * 70)
    for i in range(1, 7):
        model_study.update(x_study, reward=0.5)
        print(f"{i:<8} {'study':<12} {'0.5':<10} {model_study.predict_score(x_study):<18.6f} {model_study.predict_category(x_study):<12}")

    # Sub-test C: Work only
    print_header("TEST 6C: CATEGORY WORK (train on work)")
    init_theta = np.zeros(n_features); init_theta[0] = 2.0
    model_work = MultiFeatureLinUCB(n_features=n_features, alpha=0.1, init_theta=init_theta)
    x_work = extract_features(motivation=4, duration=50, difficulty=3, delta_hours=48, category="work", categories=CATEGORIES)
    print(f"\n{'Update':<8} {'Category':<12} {'Reward':<10} {'Score':<18} {'CategoryPred':<12}")
    print("-" * 70)
    for i in range(1, 7):
        model_work.update(x_work, reward=0.3)
        print(f"{i:<8} {'work':<12} {'0.3':<10} {model_work.predict_score(x_work):<18.6f} {model_work.predict_category(x_work):<12}")

    print(f"\n[OK] Result: Category feature tested in three separated sub-tests.")


def test_combined_learning():
    """
    TEST 7: COMBINED MULTI-FEATURE LEARNING
    ========================================
    
    Show how the model learns when all features are used together.
    Realistic scenario with diverse tasks and outcomes.
    """
    print_header("TEST 7: COMBINED MULTI-FEATURE LEARNING")
    
    n_features = 1 + 2 + 3 + 4 + len(CATEGORIES)
    # Initialize with motivation bias - will gradually learn other features as training progresses
    init_theta = np.zeros(n_features)
    init_theta[0] = 2.0  # Strong initial bias toward motivation
    model = MultiFeatureLinUCB(n_features=n_features, alpha=0.1, init_theta=init_theta)
    
    print("\nScenario: Real-world tasks with varying features")
    print("Training data: 20 diverse tasks with different characteristics")
    
    # Diverse training data
    training_data = [
        {"motivation": 5, "duration": 10, "difficulty": 1, "delta_hours": 100, "category": "sport", "reward": 0.95, "desc": "Easy sport task, high motivation, no pressure"},
        {"motivation": 4, "duration": 30, "difficulty": 2, "delta_hours": 48, "category": "study", "reward": 0.7, "desc": "Medium study task, good motivation"},
        {"motivation": 2, "duration": 100, "difficulty": 5, "delta_hours": 4, "category": "work", "reward": 0.1, "desc": "Difficult work task, low motivation, urgent"},
        {"motivation": 5, "duration": 20, "difficulty": 2, "delta_hours": 72, "category": "health", "reward": 0.9, "desc": "Easy health task, high motivation"},
        {"motivation": 3, "duration": 60, "difficulty": 3, "delta_hours": 24, "category": "home", "reward": 0.5, "desc": "Medium home task"},
        {"motivation": 4, "duration": 15, "difficulty": 1, "delta_hours": 200, "category": "habits", "reward": 0.85, "desc": "Easy habit, high motivation"},
        {"motivation": 1, "duration": 120, "difficulty": 5, "delta_hours": 2, "category": "work", "reward": 0.05, "desc": "Very hard, low motivation, urgent"},
        {"motivation": 5, "duration": 5, "difficulty": 1, "delta_hours": 100, "category": "sport", "reward": 1.0, "desc": "Tiny easy sport task"},
        {"motivation": 3, "duration": 50, "difficulty": 2, "delta_hours": 36, "category": "study", "reward": 0.6, "desc": "Medium study task"},
        {"motivation": 4, "duration": 30, "difficulty": 3, "delta_hours": 12, "category": "health", "reward": 0.7, "desc": "Medium health task with some pressure"},
    ]
    
    print(f"\n{'Update':<8} {'Motivation':<12} {'Category':<10} {'Difficulty':<12} {'Reward':<10} {'Theta Avg':<12} {'Theta Variance':<15}")
    print("-" * 90)
    
    # Initial theta
    print(f"{'Init':<8} {'-':<12} {'-':<10} {'-':<12} {'-':<10} {np.mean(model.theta):<12.6f} {np.var(model.theta):<15.6f}")
    
    # Train on data twice to see convergence
    for epoch in range(2):
        for i, task in enumerate(training_data):
            x = extract_features(
                motivation=task["motivation"],
                duration=task["duration"],
                difficulty=task["difficulty"],
                delta_hours=task["delta_hours"],
                category=task["category"],
                categories=CATEGORIES,
                max_duration=120
            )
            model.update(x, reward=task["reward"])
            
            update_num = epoch * len(training_data) + i + 1
            if (update_num) % 5 == 0:  # Print every 5 updates
                print(f"{update_num:<8} {task['motivation']:<12} {task['category']:<10} {task['difficulty']:<12} {task['reward']:<10} "
                      f"{np.mean(model.theta):<12.6f} {np.var(model.theta):<15.6f}")
    
    print(f"\n[OK] Result: Model learned from 20 diverse tasks!")
    print(f"   Final theta average: {np.mean(model.theta):.6f}")
    print(f"   Final theta variance: {np.var(model.theta):.6f}")
    
    # Show predictions for different task types
    print(f"\nFinal Predictions for Standard Tasks:")
    print("-" * 80)
    
    test_cases = [
        {"motivation": 5, "duration": 10, "difficulty": 1, "delta_hours": 100, "category": "sport", "label": "Ideal task (easy, motivated, no pressure)"},
        {"motivation": 3, "duration": 60, "difficulty": 3, "delta_hours": 24, "category": "study", "label": "Typical task (medium everything)"},
        {"motivation": 1, "duration": 120, "difficulty": 5, "delta_hours": 2, "category": "work", "label": "Worst task (hard, unmotivated, urgent)"},
    ]
    
    for case in test_cases:
        x = extract_features(
            motivation=case["motivation"],
            duration=case["duration"],
            difficulty=case["difficulty"],
            delta_hours=case["delta_hours"],
            category=case["category"],
            categories=CATEGORIES,
            max_duration=120
        )
        score = model.predict_score(x)
        category = model.predict_category(x)
        print(f"  {case['label']}: Score={score:.6f}, Category={category}")


def test_user_behavior_progression():
    """
    TEST 8: USER BEHAVIOR PROGRESSION LEARNING
    ============================================
    
    A realistic scenario where a user's behavior improves over time.
    The user starts with a poor combination of features:
      - Low motivation + Long tasks + High difficulty + Time pressure = Not Completed
    
    Then transitions to medium behavior:
      - Medium motivation + Medium tasks + Medium difficulty = Slightly Late
    
    Finally improves to excellent behavior:
      - High motivation + Short tasks + Easy difficulty + No pressure = Completed On Time
    
    The model learns to predict better outcomes as the user's behavior improves.
    """
    print_header("TEST 8: USER BEHAVIOR PROGRESSION LEARNING")
    
    n_features = 1 + 2 + 3 + 4 + len(CATEGORIES)
    init_theta = np.zeros(n_features)
    init_theta[0] = 2.0  # Strong initial bias toward motivation
    model = MultiFeatureLinUCB(n_features=n_features, alpha=0.1, init_theta=init_theta)
    
    print("\nScenario: Single user learning and improving their task completion behavior")
    print("Phase 1: Poor behavior (low motivation, difficult, time-pressured)")
    print("Phase 2: Medium behavior (medium motivation, balanced tasks)")
    print("Phase 3: Excellent behavior (high motivation, easy, well-planned)")
    
    # Keep the feature vector identical across all phases; vary only the reward
    print_header("TEST 8A-C: USER BEHAVIOR PROGRESSION WITH FIXED FEATURES (vary rewards)")
    print("\nSingle task features (fixed): motivation=2, duration=90, difficulty=4, pressure=12h, category=work")
    print("We simulate the same user/task over time; the user's performance (reward) improves over phases.")

    # Use a single feature vector for the entire progression
    x_user = extract_features(motivation=2, duration=90, difficulty=4, delta_hours=12, category="work", categories=CATEGORIES)

    print(f"\n{'Update':<8} {'Phase':<12} {'Reward':<10} {'Score':<18} {'Category':<12}")
    print("-" * 70)

    # Phase 1: Poor performance from the user (low reward)
    print_header("PHASE 1 - POOR PERFORMANCE (low reward)")
    print(f"{'Init':<8} {'POOR':<12} {'-':<10} {model.predict_score(x_user):<18.6f} {model.predict_category(x_user):<12}")
    for i in range(1, 6):
        model.update(x_user, reward=0.1)
        print(f"{i:<8} {'POOR':<12} {'0.1':<10} {model.predict_score(x_user):<18.6f} {model.predict_category(x_user):<12}")

    # Phase 2: User improves to medium performance (medium reward)
    print_header("PHASE 2 - MEDIUM PERFORMANCE (medium reward)")
    for i in range(6, 11):
        model.update(x_user, reward=0.5)
        print(f"{i:<8} {'MEDIUM':<12} {'0.5':<10} {model.predict_score(x_user):<18.6f} {model.predict_category(x_user):<12}")

    # Phase 3: User achieves excellent performance (high reward)
    print_header("PHASE 3 - EXCELLENT PERFORMANCE (high reward)")
    for i in range(11, 16):
        model.update(x_user, reward=0.8)
        print(f"{i:<8} {'EXCELLENT':<12} {'0.8':<10} {model.predict_score(x_user):<18.6f} {model.predict_category(x_user):<12}")

    # Phase 4: Decay then rise — user performance fluctuates
    print_header("PHASE 4 - DECAY THEN RISE (rewards fluctuate)")
    print("\nSimulate a period where the user's reward decays (worse performance), then recovers.")
    print(f"\n{'Update':<8} {'Phase':<12} {'Reward':<10} {'Score':<18} {'Category':<12}")
    print("-" * 70)

    rewards = [0.8, 0.6, 0.4, 0.2, 0.3, 0.5, 0.7, 0.9]
    start_idx = 16
    for offset, r in enumerate(rewards):
        idx = start_idx + offset
        model.update(x_user, reward=r)
        print(f"{idx:<8} {'FLUX':<12} {r:<10} {model.predict_score(x_user):<18.6f} {model.predict_category(x_user):<12}")

    # Final summary: how the model now predicts this fixed feature vector
    print_header("FINAL PREDICTION - Fixed Features After Progression + Flux")
    score_final = model.predict_score(x_user)
    cat_final = model.predict_category(x_user)
    print(f"Fixed features -> Final Score={score_final:.6f}, Category={cat_final}")
    print(f"\n[OK] Result: Model adjusted its prediction for the SAME features as rewards fluctuated and recovered.")


if __name__ == "__main__":
    print("\n")
    print("=" * 80)
    print("         MultiFeatureLinUCB Learning Test Suite".center(80))
    print("=" * 80)
    print("\nComprehensive testing of feature-by-feature learning")
    
    test_initial_predictions()
    test_motivation_feature_learning()
    test_duration_feature_learning()
    test_difficulty_feature_learning()
    test_pressure_feature_learning()
    test_category_feature_learning()
    test_combined_learning()
    test_user_behavior_progression()
    
    print("\n" + "=" * 80)
    print("[OK] ALL TESTS COMPLETED SUCCESSFULLY")
    print("=" * 80 + "\n")
