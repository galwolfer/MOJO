"""
Test: Subcategory Learning and Management
==========================================

This test demonstrates:
1. Adding subcategories dynamically after model creation
2. Removing subcategories
3. Feature extraction with and without subcategories
4. Subcategory-specific learning
5. Subcategory weight analysis
6. Edge cases and validation

Feature vector layout (with subcategories):
  [0]     = motivation (normalized 0-1)
  [1-2]   = duration (shortness, longness)
  [3-5]   = difficulty (easy, medium, hard) - one-hot
  [6-9]   = pressure (no, mild, strong, urgent) - one-hot
  [10-15] = category (sport, study, work, home, health, habits) - one-hot
  [16+]   = subcategories (dynamically added) - one-hot
"""

import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))

from src.predict_model.multi_feature_linucb import (
    MultiFeatureLinUCB,
    extract_features,
    get_feature_count,
    extract_subcategory_features,
    get_subcategory_global_index,
)
import numpy as np

CATEGORIES = ["sport", "study", "work", "home", "health", "habits"]


def print_header(title):
    """Helper to print formatted section headers."""
    print("\n" + "=" * 80)
    print(title)
    print("=" * 80)


def print_subheader(title):
    """Helper to print formatted sub-section headers."""
    print(f"\n{title}")
    print("-" * 60)


def test_add_subcategories():
    """
    TEST 1: ADD SUBCATEGORIES
    =========================
    
    Demonstrates adding subcategories dynamically after model creation.
    """
    print_header("TEST 1: ADD SUBCATEGORIES")
    
    # Create model without subcategories
    n_features = get_feature_count(len(CATEGORIES), use_interactions=False)
    model = MultiFeatureLinUCB(
        n_features=n_features,
        categories=CATEGORIES,
        alpha=0.1
    )
    
    print(f"Initial model created:")
    print(f"  Features: {model.n_features}")
    print(f"  Categories: {model.categories}")
    print(f"  Subcategories: {model.get_all_subcategories()}")
    
    # Add subcategories to sport
    print_subheader("Adding subcategories to 'sport'")
    
    success, msg = model.add_subcategory("sport", "football")
    print(f"  add_subcategory('sport', 'football'): {success} - {msg}")
    print(f"    n_features now: {model.n_features}")
    
    success, msg = model.add_subcategory("sport", "basketball")
    print(f"  add_subcategory('sport', 'basketball'): {success} - {msg}")
    print(f"    n_features now: {model.n_features}")
    
    success, msg = model.add_subcategory("sport", "swimming")
    print(f"  add_subcategory('sport', 'swimming'): {success} - {msg}")
    print(f"    n_features now: {model.n_features}")
    
    # Add subcategories to study
    print_subheader("Adding subcategories to 'study'")
    
    success, msg = model.add_subcategory("study", "math")
    print(f"  add_subcategory('study', 'math'): {success} - {msg}")
    
    success, msg = model.add_subcategory("study", "english")
    print(f"  add_subcategory('study', 'english'): {success} - {msg}")
    
    # Add subcategory to work
    print_subheader("Adding subcategories to 'work'")
    
    success, msg = model.add_subcategory("work", "meetings")
    print(f"  add_subcategory('work', 'meetings'): {success} - {msg}")
    
    success, msg = model.add_subcategory("work", "coding")
    print(f"  add_subcategory('work', 'coding'): {success} - {msg}")
    
    # Show final state
    print_subheader("Final Model State")
    print(f"  Total features: {model.n_features}")
    print(f"  Total subcategories: {model.get_total_subcategories()}")
    print(f"  Subcategory map: {model.get_all_subcategories()}")
    
    # Verify matrix dimensions
    print_subheader("Matrix Dimensions Check")
    print(f"  A shape: {model.A.shape}")
    print(f"  A_inv shape: {model.A_inv.shape}")
    print(f"  b shape: {model.b.shape}")
    print(f"  theta shape: {model.theta.shape}")
    
    assert model.A.shape == (model.n_features, model.n_features), "A matrix dimension mismatch"
    assert model.theta.shape == (model.n_features,), "theta dimension mismatch"
    print("  All matrix dimensions correct!")
    
    return model


def test_duplicate_subcategory():
    """
    TEST 2: DUPLICATE SUBCATEGORY HANDLING
    ======================================
    
    Verifies that adding a duplicate subcategory is handled correctly.
    """
    print_header("TEST 2: DUPLICATE SUBCATEGORY HANDLING")
    
    n_features = get_feature_count(len(CATEGORIES))
    model = MultiFeatureLinUCB(n_features=n_features, categories=CATEGORIES, alpha=0.1)
    
    # Add a subcategory
    success, msg = model.add_subcategory("sport", "football")
    print(f"First add: {success} - {msg}")
    
    # Try to add the same subcategory again
    success, msg = model.add_subcategory("sport", "football")
    print(f"Duplicate add: {success} - {msg}")
    
    assert not success, "Should not allow duplicate subcategory"
    print("\nDuplicate handling works correctly!")


def test_invalid_category_subcategory():
    """
    TEST 3: INVALID CATEGORY FOR SUBCATEGORY
    ========================================
    
    Verifies that adding subcategory to invalid category fails.
    """
    print_header("TEST 3: INVALID CATEGORY FOR SUBCATEGORY")
    
    n_features = get_feature_count(len(CATEGORIES))
    model = MultiFeatureLinUCB(n_features=n_features, categories=CATEGORIES, alpha=0.1)
    
    # Try to add subcategory to non-existent category
    success, msg = model.add_subcategory("invalid_category", "subcategory")
    print(f"Add to invalid category: {success} - {msg}")
    
    assert not success, "Should not allow subcategory for invalid category"
    print("\nInvalid category handling works correctly!")


def test_remove_subcategories():
    """
    TEST 4: REMOVE SUBCATEGORIES
    ============================
    
    Demonstrates removing subcategories and verifying matrix shrinkage.
    """
    print_header("TEST 4: REMOVE SUBCATEGORIES")
    
    n_features = get_feature_count(len(CATEGORIES))
    model = MultiFeatureLinUCB(n_features=n_features, categories=CATEGORIES, alpha=0.1)
    
    # Add subcategories
    model.add_subcategory("sport", "football")
    model.add_subcategory("sport", "basketball")
    model.add_subcategory("sport", "swimming")
    model.add_subcategory("study", "math")
    
    print(f"After adding subcategories:")
    print(f"  n_features: {model.n_features}")
    print(f"  subcategories: {model.get_all_subcategories()}")
    
    # Remove a subcategory
    print_subheader("Removing 'basketball' from 'sport'")
    success, msg = model.remove_subcategory("sport", "basketball")
    print(f"  Result: {success} - {msg}")
    print(f"  n_features now: {model.n_features}")
    print(f"  sport subcategories: {model.get_subcategories('sport')}")
    
    # Try to remove non-existent subcategory
    print_subheader("Removing non-existent subcategory")
    success, msg = model.remove_subcategory("sport", "tennis")
    print(f"  Result: {success} - {msg}")
    
    # Remove all subcategories from sport
    print_subheader("Removing all subcategories from 'sport'")
    model.remove_subcategory("sport", "football")
    model.remove_subcategory("sport", "swimming")
    print(f"  n_features now: {model.n_features}")
    print(f"  sport subcategories: {model.get_subcategories('sport')}")
    print(f"  All subcategories: {model.get_all_subcategories()}")
    
    # Verify matrices
    assert model.A.shape == (model.n_features, model.n_features), "A matrix dimension mismatch"
    print("\n  Matrix dimensions correct after removal!")


def test_feature_extraction_with_subcategory():
    """
    TEST 5: FEATURE EXTRACTION WITH SUBCATEGORIES
    =============================================
    
    Demonstrates feature extraction with and without subcategories.
    """
    print_header("TEST 5: FEATURE EXTRACTION WITH SUBCATEGORIES")
    
    n_features = get_feature_count(len(CATEGORIES))
    model = MultiFeatureLinUCB(n_features=n_features, categories=CATEGORIES, alpha=0.1)
    
    # Add subcategories
    model.add_subcategory("sport", "football")
    model.add_subcategory("sport", "basketball")
    model.add_subcategory("study", "math")
    
    print(f"Model setup:")
    print(f"  n_features: {model.n_features}")
    print(f"  subcategories: {model.get_all_subcategories()}")
    
    # Extract features WITH subcategory
    print_subheader("Features WITH subcategory ('sport' -> 'football')")
    x_with_sub = model.extract_features_with_subcategory(
        motivation=4,
        duration=45,
        difficulty=3,
        delta_hours=30,
        category="sport",
        subcategory="football"
    )
    print(f"  Feature vector length: {len(x_with_sub)}")
    print(f"  Feature vector: {x_with_sub}")
    
    # Find subcategory feature position
    football_idx = model.get_subcategory_feature_index("sport", "football")
    print(f"  Football feature index: {football_idx}")
    print(f"  Value at football index: {x_with_sub[football_idx]}")
    
    # Extract features WITHOUT subcategory
    print_subheader("Features WITHOUT subcategory ('sport', no subcategory)")
    x_no_sub = model.extract_features_with_subcategory(
        motivation=4,
        duration=45,
        difficulty=3,
        delta_hours=30,
        category="sport",
        subcategory=None  # No subcategory
    )
    print(f"  Feature vector length: {len(x_no_sub)}")
    print(f"  Subcategory features (should be all zeros): {x_no_sub[16:]}")
    
    # Verify subcategory features are zeros when not specified
    assert all(v == 0.0 for v in x_no_sub[16:]), "Subcategory features should be zeros"
    print("  Verified: subcategory features are all zeros!")
    
    # Extract features for different subcategory
    print_subheader("Features for different subcategory ('study' -> 'math')")
    x_math = model.extract_features_with_subcategory(
        motivation=3,
        duration=60,
        difficulty=4,
        delta_hours=10,
        category="study",
        subcategory="math"
    )
    math_idx = model.get_subcategory_feature_index("study", "math")
    print(f"  Math feature index: {math_idx}")
    print(f"  Value at math index: {x_math[math_idx]}")
    print(f"  Subcategory features: {x_math[16:]}")


def test_subcategory_learning():
    """
    TEST 6: SUBCATEGORY-SPECIFIC LEARNING
    =====================================
    
    Demonstrates that the model can learn different behaviors for
    different subcategories within the same category.
    """
    print_header("TEST 6: SUBCATEGORY-SPECIFIC LEARNING")
    
    n_features = get_feature_count(len(CATEGORIES))
    model = MultiFeatureLinUCB(n_features=n_features, categories=CATEGORIES, alpha=0.1)
    
    # Add subcategories
    model.add_subcategory("sport", "football")
    model.add_subcategory("sport", "swimming")
    
    print(f"Model setup with subcategories:")
    print(f"  n_features: {model.n_features}")
    print(f"  subcategories: {model.get_all_subcategories()}")
    
    # Train: Football tasks have HIGH reward (user is good at football)
    print_subheader("Training: Football tasks (HIGH reward)")
    for i in range(20):
        x = model.extract_features_with_subcategory(
            motivation=3,
            duration=60,
            difficulty=3,
            delta_hours=48,
            category="sport",
            subcategory="football"
        )
        model.update(x, reward=0.9)  # High reward for football
    
    # Train: Swimming tasks have LOW reward (user struggles with swimming)
    print_subheader("Training: Swimming tasks (LOW reward)")
    for i in range(20):
        x = model.extract_features_with_subcategory(
            motivation=3,
            duration=60,
            difficulty=3,
            delta_hours=48,
            category="sport",
            subcategory="swimming"
        )
        model.update(x, reward=0.2)  # Low reward for swimming
    
    # Compare predictions
    print_subheader("Predictions after training")
    
    x_football = model.extract_features_with_subcategory(
        motivation=3, duration=60, difficulty=3, delta_hours=48,
        category="sport", subcategory="football"
    )
    score_football = model.predict_score(x_football)
    cat_football = model.predict_category(x_football)
    
    x_swimming = model.extract_features_with_subcategory(
        motivation=3, duration=60, difficulty=3, delta_hours=48,
        category="sport", subcategory="swimming"
    )
    score_swimming = model.predict_score(x_swimming)
    cat_swimming = model.predict_category(x_swimming)
    
    print(f"  Football prediction: score={score_football:.4f}, category={cat_football}")
    print(f"  Swimming prediction: score={score_swimming:.4f}, category={cat_swimming}")
    
    # Football should have higher score than swimming
    assert score_football > score_swimming, "Football should have higher score than swimming"
    print("\n  Verified: Football has higher score than swimming!")
    
    # Check learned weights
    print_subheader("Learned Subcategory Weights")
    weights = model.get_subcategory_weights_map()
    for category, subs in weights.items():
        for sub, weight in subs.items():
            print(f"  {category}/{sub}: {weight:.4f}")


def test_subcategory_info_methods():
    """
    TEST 7: SUBCATEGORY INFO METHODS
    ================================
    
    Demonstrates the subcategory information retrieval methods.
    """
    print_header("TEST 7: SUBCATEGORY INFO METHODS")
    
    n_features = get_feature_count(len(CATEGORIES))
    model = MultiFeatureLinUCB(n_features=n_features, categories=CATEGORIES, alpha=0.1)
    
    # Add subcategories
    model.add_subcategory("sport", "football")
    model.add_subcategory("sport", "basketball")
    model.add_subcategory("study", "math")
    model.add_subcategory("study", "english")
    model.add_subcategory("work", "meetings")
    
    # Train some data
    for i in range(10):
        x = model.extract_features_with_subcategory(
            motivation=4, duration=30, difficulty=2, delta_hours=24,
            category="sport", subcategory="football"
        )
        model.update(x, reward=0.85)
    
    print_subheader("get_total_subcategories()")
    print(f"  Total: {model.get_total_subcategories()}")
    
    print_subheader("get_subcategories(category)")
    for cat in CATEGORIES:
        subs = model.get_subcategories(cat)
        if subs:
            print(f"  {cat}: {subs}")
    
    print_subheader("get_all_subcategories()")
    all_subs = model.get_all_subcategories()
    for cat, subs in all_subs.items():
        print(f"  {cat}: {subs}")
    
    print_subheader("has_subcategory(category, subcategory)")
    print(f"  has_subcategory('sport', 'football'): {model.has_subcategory('sport', 'football')}")
    print(f"  has_subcategory('sport', 'tennis'): {model.has_subcategory('sport', 'tennis')}")
    print(f"  has_subcategory('study', 'math'): {model.has_subcategory('study', 'math')}")
    
    print_subheader("get_subcategory_feature_index(category, subcategory)")
    print(f"  sport/football index: {model.get_subcategory_feature_index('sport', 'football')}")
    print(f"  sport/basketball index: {model.get_subcategory_feature_index('sport', 'basketball')}")
    print(f"  study/math index: {model.get_subcategory_feature_index('study', 'math')}")
    print(f"  sport/tennis (invalid): {model.get_subcategory_feature_index('sport', 'tennis')}")
    
    print_subheader("get_subcategory_weight(category, subcategory)")
    print(f"  sport/football weight: {model.get_subcategory_weight('sport', 'football')}")
    print(f"  sport/basketball weight: {model.get_subcategory_weight('sport', 'basketball')}")
    
    print_subheader("get_subcategory_info(category, subcategory)")
    info = model.get_subcategory_info("sport", "football")
    print(f"  sport/football info: {info}")
    
    info = model.get_subcategory_info("sport", "tennis")  # Non-existent
    print(f"  sport/tennis info (non-existent): {info}")


def test_subcategory_with_interactions():
    """
    TEST 8: SUBCATEGORIES WITH INTERACTION FEATURES
    ===============================================
    
    Tests that subcategories work correctly when interaction features are enabled.
    """
    print_header("TEST 8: SUBCATEGORIES WITH INTERACTION FEATURES")
    
    # Model with interactions
    n_features = get_feature_count(len(CATEGORIES), use_interactions=True)
    model = MultiFeatureLinUCB(n_features=n_features, categories=CATEGORIES, alpha=0.1)
    
    print(f"Model with interactions:")
    print(f"  n_features: {model.n_features}")
    
    # Add subcategories
    model.add_subcategory("sport", "football")
    model.add_subcategory("sport", "basketball")
    
    print(f"\nAfter adding subcategories:")
    print(f"  n_features: {model.n_features}")
    
    # Extract features with subcategory and interactions
    x = model.extract_features_with_subcategory(
        motivation=4,
        duration=45,
        difficulty=3,
        delta_hours=30,
        category="sport",
        subcategory="football",
        use_interactions=True
    )
    
    print(f"\nFeature vector with subcategory and interactions:")
    print(f"  Length: {len(x)}")
    print(f"  Expected: {model.n_features}")
    
    # Note: The feature vector from extract_features_with_subcategory 
    # uses the model's n_features which includes dynamically added subcategories
    # But the interactions are calculated based on categories only
    
    # Verify prediction works
    score = model.predict_score(x)
    print(f"  Prediction score: {score:.4f}")


def test_standalone_subcategory_functions():
    """
    TEST 9: STANDALONE SUBCATEGORY FUNCTIONS
    ========================================
    
    Tests the standalone helper functions for subcategory feature extraction.
    """
    print_header("TEST 9: STANDALONE SUBCATEGORY FUNCTIONS")
    
    subcategory_map = {
        "sport": ["football", "basketball", "swimming"],
        "study": ["math", "english"],
        "work": ["meetings"]
    }
    
    print("Subcategory map:")
    for cat, subs in subcategory_map.items():
        print(f"  {cat}: {subs}")
    
    print_subheader("extract_subcategory_features()")
    
    # With valid subcategory
    features = extract_subcategory_features("sport", "football", subcategory_map)
    print(f"  sport/football: {features}")
    
    features = extract_subcategory_features("sport", "basketball", subcategory_map)
    print(f"  sport/basketball: {features}")
    
    features = extract_subcategory_features("study", "math", subcategory_map)
    print(f"  study/math: {features}")
    
    # Without subcategory (None)
    features = extract_subcategory_features("sport", None, subcategory_map)
    print(f"  sport/None (no subcategory): {features}")
    
    # Invalid subcategory
    features = extract_subcategory_features("sport", "tennis", subcategory_map)
    print(f"  sport/tennis (invalid): {features}")
    
    print_subheader("get_subcategory_global_index()")
    
    # Indices should be in sorted category order
    print(f"  sport/football index: {get_subcategory_global_index('sport', 'football', subcategory_map)}")
    print(f"  sport/basketball index: {get_subcategory_global_index('sport', 'basketball', subcategory_map)}")
    print(f"  sport/swimming index: {get_subcategory_global_index('sport', 'swimming', subcategory_map)}")
    print(f"  study/math index: {get_subcategory_global_index('study', 'math', subcategory_map)}")
    print(f"  study/english index: {get_subcategory_global_index('study', 'english', subcategory_map)}")
    print(f"  work/meetings index: {get_subcategory_global_index('work', 'meetings', subcategory_map)}")
    print(f"  invalid index: {get_subcategory_global_index('sport', 'invalid', subcategory_map)}")


def test_subcategory_persistence_after_training():
    """
    TEST 10: SUBCATEGORY WEIGHT PERSISTENCE AFTER TRAINING
    ======================================================
    
    Tests that subcategory weights are properly maintained
    after multiple training iterations.
    """
    print_header("TEST 10: SUBCATEGORY WEIGHT PERSISTENCE")
    
    n_features = get_feature_count(len(CATEGORIES))
    model = MultiFeatureLinUCB(n_features=n_features, categories=CATEGORIES, alpha=0.1)
    
    # Add subcategories
    model.add_subcategory("sport", "football")
    model.add_subcategory("sport", "basketball")
    
    print("Training with mixed rewards for different subcategories...")
    
    # Train football with high reward
    for i in range(50):
        x = model.extract_features_with_subcategory(
            motivation=4, duration=30, difficulty=2, delta_hours=48,
            category="sport", subcategory="football"
        )
        model.update(x, reward=0.95)
    
    # Train basketball with medium reward
    for i in range(50):
        x = model.extract_features_with_subcategory(
            motivation=4, duration=30, difficulty=2, delta_hours=48,
            category="sport", subcategory="basketball"
        )
        model.update(x, reward=0.5)
    
    print_subheader("Final Subcategory Weights")
    weights = model.get_subcategory_weights_map()
    for cat, subs in weights.items():
        for sub, weight in subs.items():
            bar = "*" * int(abs(weight) * 20)
            sign = "+" if weight >= 0 else "-"
            print(f"  {cat}/{sub}: {sign}{weight:.4f}  {bar}")
    
    # Football should have higher weight
    football_weight = model.get_subcategory_weight("sport", "football")
    basketball_weight = model.get_subcategory_weight("sport", "basketball")
    
    print(f"\nFootball weight: {football_weight:.4f}")
    print(f"Basketball weight: {basketball_weight:.4f}")
    
    assert football_weight > basketball_weight, "Football should have higher weight"
    print("\nVerified: Subcategory weights reflect training rewards!")


def run_all_tests():
    """Run all subcategory tests."""
    print("\n" + "=" * 80)
    print("SUBCATEGORY LEARNING TEST SUITE")
    print("=" * 80)
    
    test_add_subcategories()
    test_duplicate_subcategory()
    test_invalid_category_subcategory()
    test_remove_subcategories()
    test_feature_extraction_with_subcategory()
    test_subcategory_learning()
    test_subcategory_info_methods()
    test_subcategory_with_interactions()
    test_standalone_subcategory_functions()
    test_subcategory_persistence_after_training()
    
    print("\n" + "=" * 80)
    print("ALL SUBCATEGORY TESTS PASSED!")
    print("=" * 80 + "\n")


if __name__ == "__main__":
    run_all_tests()
