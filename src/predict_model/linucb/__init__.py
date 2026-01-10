"""
LinUCB Contextual Bandit Package
================================

A multi-feature LinUCB implementation for task completion prediction.

This package provides:
- Feature extraction utilities for task attributes
- A configurable LinUCB model with support for priors
- Dynamic subcategory management

Quick Start
-----------
>>> from src.predict_model.linucb import MultiFeatureLinUCB, extract_features
>>>
>>> # Create model with sensible priors (recommended)
>>> model = MultiFeatureLinUCB.create_with_priors(
...     categories=["sport", "study", "work", "home", "health", "habits"],
...     motivation_weight=1.0,
...     difficulty_weights=(0.3, 0.0, -0.3),
... )
>>>
>>> # Extract features and predict
>>> x = model.extract_features_with_subcategory(
...     motivation=4, duration=45, difficulty=3,
...     delta_hours=30, category="study"
... )
>>> predicted_category = model.predict_category(x)

See Also
--------
- :mod:`.model` : The main LinUCB model class
- :mod:`.features` : Feature extraction utilities
- :mod:`.constants` : Configuration constants
"""

from .model import MultiFeatureLinUCB
from .features import (
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
)
from .constants import (
    # Feature indices
    MOTIVATION_INDEX,
    DURATION_START_INDEX,
    DIFFICULTY_START_INDEX,
    PRESSURE_START_INDEX,
    CATEGORY_START_INDEX,
    # Feature counts
    NUM_MOTIVATION_FEATURES,
    NUM_DURATION_FEATURES,
    NUM_DIFFICULTY_FEATURES,
    NUM_PRESSURE_FEATURES,
    BASE_FEATURE_COUNT,
    # Default thresholds
    DEFAULT_THRESHOLDS,
    # Pressure thresholds (hours)
    PRESSURE_NO_THRESHOLD,
    PRESSURE_MILD_THRESHOLD,
    PRESSURE_STRONG_THRESHOLD,
)

__all__ = [
    # Model
    "MultiFeatureLinUCB",
    # Feature extraction
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
    # Constants
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

__version__ = "1.0.0"
