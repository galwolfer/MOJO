"""
Constants and Configuration
===========================

This module defines constants used throughout the LinUCB package.
Centralizing these values ensures consistency and makes the codebase
easier to maintain and modify.

Feature Vector Layout
---------------------
The feature vector is structured as follows:

    Index   | Feature           | Description
    --------|-------------------|------------------------------------------
    0       | Motivation        | Normalized motivation (0-1)
    1-2     | Duration          | [shortness, longness]
    3-5     | Difficulty        | One-hot [easy, medium, hard]
    6-9     | Pressure          | One-hot [no, mild, strong, urgent]
    10+     | Categories        | One-hot encoding of task categories
    ...     | Subcategories     | One-hot encoding (dynamic)
    ...     | Interactions      | Category × difficulty/pressure (optional)
"""

from typing import Tuple

# =============================================================================
# Feature Indices
# =============================================================================

MOTIVATION_INDEX: int = 0
"""Index of the motivation feature in the feature vector."""

DURATION_START_INDEX: int = 1
"""Starting index of duration features (shortness, longness)."""

DIFFICULTY_START_INDEX: int = 3
"""Starting index of difficulty features (easy, medium, hard)."""

PRESSURE_START_INDEX: int = 6
"""Starting index of pressure features (no, mild, strong, urgent)."""

CATEGORY_START_INDEX: int = 10
"""Starting index of category features (after base features)."""


# =============================================================================
# Feature Counts
# =============================================================================

NUM_MOTIVATION_FEATURES: int = 1
"""Number of motivation features."""

NUM_DURATION_FEATURES: int = 2
"""Number of duration features (shortness and longness)."""

NUM_DIFFICULTY_FEATURES: int = 3
"""Number of difficulty levels (easy, medium, hard)."""

NUM_PRESSURE_FEATURES: int = 4
"""Number of pressure levels (no, mild, strong, urgent)."""

BASE_FEATURE_COUNT: int = (
    NUM_MOTIVATION_FEATURES
    + NUM_DURATION_FEATURES
    + NUM_DIFFICULTY_FEATURES
    + NUM_PRESSURE_FEATURES
)
"""Total base features before categories: 1 + 2 + 3 + 4 = 10."""


# =============================================================================
# Difficulty Mapping
# =============================================================================

DIFFICULTY_EASY_RANGE: Tuple[int, int] = (1, 2)
"""Difficulty ratings 1-2 map to 'easy'."""

DIFFICULTY_MEDIUM_VALUE: int = 3
"""Difficulty rating 3 maps to 'medium'."""

DIFFICULTY_HARD_RANGE: Tuple[int, int] = (4, 5)
"""Difficulty ratings 4-5 map to 'hard'."""


# =============================================================================
# Pressure Thresholds (hours until deadline)
# =============================================================================

PRESSURE_NO_THRESHOLD: float = 72.0
"""> 72 hours: no pressure."""

PRESSURE_MILD_THRESHOLD: float = 48.0
"""48-72 hours: mild pressure."""

PRESSURE_STRONG_THRESHOLD: float = 24.0
"""24-48 hours: strong pressure."""

# ≤ 24 hours: urgent (no constant needed, it's the else case)


# =============================================================================
# Model Defaults
# =============================================================================

DEFAULT_THRESHOLDS: Tuple[float, float, float, float] = (0.85, 0.65, 0.45, 0.25)
"""
Default score thresholds for category prediction.

Mapping:
    score >= 0.85 → category 1 (best)
    score >= 0.65 → category 2
    score >= 0.45 → category 3
    score >= 0.25 → category 4
    score <  0.25 → category 5 (worst)
"""

DEFAULT_ALPHA: float = 0.1
"""Default exploration parameter for UCB."""

DEFAULT_MAX_DURATION: float = 120.0
"""Default maximum task duration in minutes for normalization."""


# =============================================================================
# Prior Defaults (for create_with_priors)
# =============================================================================

DEFAULT_MOTIVATION_WEIGHT: float = 1.0
"""Default weight for motivation feature in priors."""

DEFAULT_DIFFICULTY_WEIGHTS: Tuple[float, float, float] = (0.3, 0.0, -0.3)
"""Default weights for (easy, medium, hard) difficulty in priors."""

DEFAULT_PRIOR_STRENGTH: float = 5.0
"""Default prior strength (equivalent observations)."""

DEFAULT_LEARN_RATE: float = 0.5
"""Default learning rate for updates."""


# =============================================================================
# Motivation Bounds
# =============================================================================

MOTIVATION_MIN: float = 1.0
"""Minimum motivation rating."""

MOTIVATION_MAX: float = 5.0
"""Maximum motivation rating."""

DIFFICULTY_MIN: int = 1
"""Minimum difficulty rating."""

DIFFICULTY_MAX: int = 5
"""Maximum difficulty rating."""
