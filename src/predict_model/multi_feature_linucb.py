"""
Backward Compatibility Shim
===========================

This module re-exports all symbols from the new ``linucb`` package
for backward compatibility with existing code that imports from
``multi_feature_linucb``.

.. deprecated::
    Import directly from ``src.predict_model.linucb`` instead.

Example (old way - still works):
    >>> from src.predict_model.multi_feature_linucb import MultiFeatureLinUCB

Example (new way - preferred):
    >>> from src.predict_model.linucb import MultiFeatureLinUCB
"""

import warnings

# Issue a deprecation warning (optional - uncomment to enable)
# warnings.warn(
#     "Importing from 'multi_feature_linucb' is deprecated. "
#     "Use 'from src.predict_model.linucb import ...' instead.",
#     DeprecationWarning,
#     stacklevel=2,
# )

# Re-export everything from the new package
from .linucb import (
    # Model
    MultiFeatureLinUCB,
    # Feature extraction functions
    extract_features,
    extract_motivation_feature,
    extract_duration_features,
    extract_difficulty_features,
    extract_pressure_features,
    extract_category_features,
    extract_subcategory_features,
    extract_category_difficulty_interactions,
    extract_category_pressure_interactions,
    get_feature_count,
    # Constants
    MOTIVATION_INDEX,
    DURATION_START_INDEX,
    DIFFICULTY_START_INDEX,
    PRESSURE_START_INDEX,
    CATEGORY_START_INDEX,
    NUM_MOTIVATION_FEATURES,
    NUM_DURATION_FEATURES,
    NUM_DIFFICULTY_FEATURES,
    NUM_PRESSURE_FEATURES,
    BASE_FEATURE_COUNT,
    DEFAULT_THRESHOLDS,
    PRESSURE_NO_THRESHOLD,
    PRESSURE_MILD_THRESHOLD,
    PRESSURE_STRONG_THRESHOLD,
)

# Also export helper functions that some tests may use
from .linucb.features import get_subcategory_global_index

__all__ = [
    "MultiFeatureLinUCB",
    "extract_features",
    "extract_motivation_feature",
    "extract_duration_features",
    "extract_difficulty_features",
    "extract_pressure_features",
    "extract_category_features",
    "extract_subcategory_features",
    "extract_category_difficulty_interactions",
    "extract_category_pressure_interactions",
    "get_feature_count",
    "get_subcategory_global_index",
    "MOTIVATION_INDEX",
    "DURATION_START_INDEX",
    "DIFFICULTY_START_INDEX",
    "PRESSURE_START_INDEX",
    "CATEGORY_START_INDEX",
    "NUM_MOTIVATION_FEATURES",
    "NUM_DURATION_FEATURES",
    "NUM_DIFFICULTY_FEATURES",
    "NUM_PRESSURE_FEATURES",
    "BASE_FEATURE_COUNT",
    "DEFAULT_THRESHOLDS",
    "PRESSURE_NO_THRESHOLD",
    "PRESSURE_MILD_THRESHOLD",
    "PRESSURE_STRONG_THRESHOLD",
]
