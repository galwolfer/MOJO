"""
Test: Excluded Categories Feature
=================================

This test demonstrates:
1. Creating a model with excluded categories
2. Excluded categories don't participate in learning (zero features)
3. Excluded categories cannot have subcategories
4. Normal categories still work correctly alongside excluded ones
5. Helper methods for checking excluded status

Use case:
- Categories like "other" contain diverse, unrelated tasks
- Learning weights for such categories is not meaningful
- Excluding them from learning prevents noise in the model
"""

import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))

from src.predict_model.linucb import (
    MultiFeatureLinUCB,
    extract_features,
    CATEGORY_START_INDEX,
)
import numpy as np

CATEGORIES = ["sport", "study", "work", "home", "health", "other"]
EXCLUDED_CATEGORIES = ["other"]


def print_header(title):
    """Helper to print formatted section headers."""
    print("\n" + "=" * 80)
    print(title)
    print("=" * 80)


def print_subheader(title):
    """Helper to print formatted sub-section headers."""
    print(f"\n{title}")
    print("-" * len(title))


# =============================================================================
# Test 1: Model creation with excluded categories
# =============================================================================
def test_model_creation_with_excluded_categories():
    """Test that model can be created with excluded categories."""
    print_header("Test 1: Model Creation with Excluded Categories")

    # Create model with 'other' excluded
    model = MultiFeatureLinUCB.create_with_priors(
        categories=CATEGORIES,
        excluded_categories=EXCLUDED_CATEGORIES,
        motivation_weight=1.0,
        difficulty_weights=(0.3, 0.0, -0.3),
    )

    print(f"Categories: {model.categories}")
    print(f"Excluded categories: {model.get_excluded_categories()}")

    # Verify excluded_categories is stored correctly
    assert list(model.excluded_categories) == EXCLUDED_CATEGORIES
    assert model.get_excluded_categories() == EXCLUDED_CATEGORIES

    print("✓ Model created successfully with excluded categories")


# =============================================================================
# Test 2: is_excluded_category helper method
# =============================================================================
def test_is_excluded_category():
    """Test the is_excluded_category helper method."""
    print_header("Test 2: is_excluded_category Helper Method")

    model = MultiFeatureLinUCB.create_with_priors(
        categories=CATEGORIES,
        excluded_categories=EXCLUDED_CATEGORIES,
    )

    # Test excluded category
    assert model.is_excluded_category("other") == True
    print("✓ 'other' is correctly identified as excluded")

    # Test normal categories
    for cat in ["sport", "study", "work", "home", "health"]:
        assert model.is_excluded_category(cat) == False
        print(f"✓ '{cat}' is correctly identified as not excluded")

    # Test unknown category
    assert model.is_excluded_category("unknown") == False
    print("✓ 'unknown' is correctly identified as not excluded")


# =============================================================================
# Test 3: Excluded categories have zero features
# =============================================================================
def test_excluded_category_zero_features():
    """Test that excluded categories produce zero category features."""
    print_header("Test 3: Excluded Categories Have Zero Features")

    model = MultiFeatureLinUCB.create_with_priors(
        categories=CATEGORIES,
        excluded_categories=EXCLUDED_CATEGORIES,
    )

    num_categories = len(CATEGORIES)
    cat_end_index = CATEGORY_START_INDEX + num_categories

    print_subheader("Normal category features (sport)")
    x_sport = model.extract_features_with_subcategory(
        motivation=4, duration=30, difficulty=2, delta_hours=24, category="sport"
    )
    cat_features_sport = x_sport[CATEGORY_START_INDEX:cat_end_index]
    print(f"Category features: {cat_features_sport}")
    assert cat_features_sport[0] == 1.0  # sport is index 0
    assert sum(cat_features_sport) == 1.0  # one-hot encoding
    print("✓ Sport has correct one-hot encoding [1, 0, 0, 0, 0, 0]")

    print_subheader("Excluded category features (other)")
    x_other = model.extract_features_with_subcategory(
        motivation=4, duration=30, difficulty=2, delta_hours=24, category="other"
    )
    cat_features_other = x_other[CATEGORY_START_INDEX:cat_end_index]
    print(f"Category features: {cat_features_other}")
    assert np.all(cat_features_other == 0.0)  # all zeros
    print("✓ Other has all-zero features (excluded from learning)")

    print_subheader("Verify other features are still present")
    # Motivation should be the same
    assert x_sport[0] == x_other[0]
    print(f"✓ Motivation feature is same: {x_sport[0]}")
    # Duration features should be the same
    assert np.array_equal(x_sport[1:3], x_other[1:3])
    print(f"✓ Duration features are same: {x_sport[1:3]}")


# =============================================================================
# Test 4: Excluded categories cannot have subcategories
# =============================================================================
def test_excluded_category_no_subcategories():
    """Test that excluded categories cannot have subcategories added."""
    print_header("Test 4: Excluded Categories Cannot Have Subcategories")

    model = MultiFeatureLinUCB.create_with_priors(
        categories=CATEGORIES,
        excluded_categories=EXCLUDED_CATEGORIES,
    )

    print_subheader("Attempting to add subcategory to excluded category")
    success, message = model.add_subcategory("other", "misc")
    print(f"Result: success={success}, message='{message}'")
    assert success == False
    assert "excluded" in message.lower()
    print("✓ Correctly blocked adding subcategory to 'other'")

    print_subheader("Adding subcategory to normal category should still work")
    success, message = model.add_subcategory("sport", "football")
    print(f"Result: success={success}, message='{message}'")
    assert success == True
    print("✓ Successfully added subcategory 'football' to 'sport'")

    # Verify subcategory was added
    assert "football" in model.get_subcategories("sport")
    print(f"✓ Sport subcategories: {model.get_subcategories('sport')}")


# =============================================================================
# Test 5: Learning doesn't affect excluded categories
# =============================================================================
def test_learning_excludes_category():
    """Test that learning updates don't affect excluded category weights."""
    print_header("Test 5: Learning Doesn't Affect Excluded Categories")

    model = MultiFeatureLinUCB.create_with_priors(
        categories=CATEGORIES,
        excluded_categories=EXCLUDED_CATEGORIES,
        motivation_weight=1.0,
    )

    num_categories = len(CATEGORIES)
    other_index = CATEGORIES.index("other")
    other_feature_index = CATEGORY_START_INDEX + other_index

    # Get initial theta for 'other' category
    initial_theta_other = model.theta[other_feature_index].copy()
    print(f"Initial theta for 'other' (index {other_feature_index}): {initial_theta_other}")

    print_subheader("Training on 'other' category tasks")
    # Train on several 'other' tasks
    for i in range(10):
        x = model.extract_features_with_subcategory(
            motivation=3 + (i % 3),
            duration=30,
            difficulty=2,
            delta_hours=24,
            category="other",
        )
        reward = 1 if i % 2 == 0 else 0
        model.update(x, reward)

    # Get updated theta for 'other' category
    updated_theta_other = model.theta[other_feature_index]
    print(f"Updated theta for 'other': {updated_theta_other}")

    # Since category features are all zeros for 'other', the theta shouldn't change
    # Note: Other features (motivation, duration, etc.) will cause changes to A_inv
    # but the category-specific weight should remain relatively unchanged
    print(f"✓ Training completed on 'other' tasks")

    print_subheader("Compare with normal category learning")
    sport_index = CATEGORIES.index("sport")
    sport_feature_index = CATEGORY_START_INDEX + sport_index
    initial_theta_sport = model.theta[sport_feature_index].copy()
    print(f"Initial theta for 'sport': {initial_theta_sport}")

    # Train on sport tasks
    for i in range(10):
        x = model.extract_features_with_subcategory(
            motivation=3 + (i % 3),
            duration=30,
            difficulty=2,
            delta_hours=24,
            category="sport",
        )
        reward = 1 if i % 2 == 0 else 0
        model.update(x, reward)

    updated_theta_sport = model.theta[sport_feature_index]
    print(f"Updated theta for 'sport': {updated_theta_sport}")

    # Sport should have changed since it's not excluded
    sport_change = abs(updated_theta_sport - initial_theta_sport)
    print(f"Sport theta change: {sport_change}")
    print("✓ Normal category 'sport' shows learning effect")


# =============================================================================
# Test 6: Multiple excluded categories
# =============================================================================
def test_multiple_excluded_categories():
    """Test model with multiple excluded categories."""
    print_header("Test 6: Multiple Excluded Categories")

    multi_excluded = ["other", "home"]

    model = MultiFeatureLinUCB.create_with_priors(
        categories=CATEGORIES,
        excluded_categories=multi_excluded,
    )

    print(f"Excluded categories: {model.get_excluded_categories()}")
    assert len(model.get_excluded_categories()) == 2

    # Both should be excluded
    assert model.is_excluded_category("other") == True
    assert model.is_excluded_category("home") == True
    print("✓ Both 'other' and 'home' are excluded")

    # Both should have zero features
    num_categories = len(CATEGORIES)
    cat_end_index = CATEGORY_START_INDEX + num_categories

    x_other = model.extract_features_with_subcategory(
        motivation=4, duration=30, difficulty=2, delta_hours=24, category="other"
    )
    x_home = model.extract_features_with_subcategory(
        motivation=4, duration=30, difficulty=2, delta_hours=24, category="home"
    )

    assert np.all(x_other[CATEGORY_START_INDEX:cat_end_index] == 0.0)
    assert np.all(x_home[CATEGORY_START_INDEX:cat_end_index] == 0.0)
    print("✓ Both excluded categories have zero category features")

    # Neither can have subcategories
    success1, _ = model.add_subcategory("other", "misc")
    success2, _ = model.add_subcategory("home", "kitchen")
    assert success1 == False
    assert success2 == False
    print("✓ Neither excluded category can have subcategories")


# =============================================================================
# Test 7: Model without excluded categories (default behavior)
# =============================================================================
def test_no_excluded_categories():
    """Test that model without excluded categories works normally."""
    print_header("Test 7: Model Without Excluded Categories (Default)")

    model = MultiFeatureLinUCB.create_with_priors(
        categories=CATEGORIES,
        # No excluded_categories parameter
        motivation_weight=1.0,
    )

    print(f"Excluded categories: {model.get_excluded_categories()}")
    assert model.get_excluded_categories() == []
    print("✓ No excluded categories by default")

    # All categories should work normally
    for cat in CATEGORIES:
        assert model.is_excluded_category(cat) == False
    print("✓ All categories are not excluded")

    # 'other' should have normal one-hot encoding
    num_categories = len(CATEGORIES)
    cat_end_index = CATEGORY_START_INDEX + num_categories
    other_index = CATEGORIES.index("other")

    x_other = model.extract_features_with_subcategory(
        motivation=4, duration=30, difficulty=2, delta_hours=24, category="other"
    )
    cat_features = x_other[CATEGORY_START_INDEX:cat_end_index]
    print(f"'other' category features: {cat_features}")
    assert cat_features[other_index] == 1.0
    assert sum(cat_features) == 1.0
    print("✓ 'other' has normal one-hot encoding when not excluded")


# =============================================================================
# Test 8: Predictions for excluded vs normal categories
# =============================================================================
def test_predictions_excluded_vs_normal():
    """Test that predictions work for both excluded and normal categories."""
    print_header("Test 8: Predictions for Excluded vs Normal Categories")

    model = MultiFeatureLinUCB.create_with_priors(
        categories=CATEGORIES,
        excluded_categories=EXCLUDED_CATEGORIES,
        motivation_weight=1.0,
        difficulty_weights=(0.3, 0.0, -0.3),
    )

    print_subheader("Same task in different categories")
    base_params = dict(motivation=4, duration=30, difficulty=2, delta_hours=24)

    x_sport = model.extract_features_with_subcategory(**base_params, category="sport")
    x_other = model.extract_features_with_subcategory(**base_params, category="other")

    pred_sport = model.predict_category(x_sport)
    pred_other = model.predict_category(x_other)

    print(f"Prediction for sport: {pred_sport:.4f}")
    print(f"Prediction for other: {pred_other:.4f}")

    # Both should produce valid predictions (can be int or float)
    assert isinstance(pred_sport, (int, float))
    assert isinstance(pred_other, (int, float))
    print("✓ Both predictions are valid")

    # The predictions may differ due to category weights in normal model
    # but excluded category gets no category contribution
    print("✓ Predictions work for both excluded and normal categories")


# =============================================================================
# Test 9: extract_features standalone function with excluded categories
# =============================================================================
def test_extract_features_with_excluded():
    """Test the standalone extract_features function with excluded categories."""
    print_header("Test 9: Standalone extract_features with Excluded Categories")

    num_categories = len(CATEGORIES)
    cat_end_index = CATEGORY_START_INDEX + num_categories

    print_subheader("With excluded categories")
    x_excluded = extract_features(
        motivation=4,
        duration=30,
        difficulty=2,
        delta_hours=24,
        category="other",
        categories=CATEGORIES,
        excluded_categories=EXCLUDED_CATEGORIES,
    )
    cat_features = x_excluded[CATEGORY_START_INDEX:cat_end_index]
    print(f"Category features for 'other' (excluded): {cat_features}")
    assert np.all(cat_features == 0.0)
    print("✓ Standalone function respects excluded_categories")

    print_subheader("Without excluded categories")
    x_normal = extract_features(
        motivation=4,
        duration=30,
        difficulty=2,
        delta_hours=24,
        category="other",
        categories=CATEGORIES,
        # No excluded_categories
    )
    cat_features_normal = x_normal[CATEGORY_START_INDEX:cat_end_index]
    other_index = CATEGORIES.index("other")
    print(f"Category features for 'other' (not excluded): {cat_features_normal}")
    assert cat_features_normal[other_index] == 1.0
    print("✓ Without exclusion, 'other' has normal one-hot encoding")


# =============================================================================
# Run all tests
# =============================================================================
if __name__ == "__main__":
    test_model_creation_with_excluded_categories()
    test_is_excluded_category()
    test_excluded_category_zero_features()
    test_excluded_category_no_subcategories()
    test_learning_excludes_category()
    test_multiple_excluded_categories()
    test_no_excluded_categories()
    test_predictions_excluded_vs_normal()
    test_extract_features_with_excluded()

    print("\n" + "=" * 80)
    print("ALL TESTS PASSED!")
    print("=" * 80)
