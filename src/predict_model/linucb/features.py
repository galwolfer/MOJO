"""
Feature Extraction Module
=========================

This module provides functions for extracting and encoding task features
into a numerical vector suitable for the LinUCB model.

Feature Components
------------------
1. **Motivation** (1 feature): Normalized to [0, 1] from rating 1-5
2. **Duration** (2 features): Shortness and longness (complementary)
3. **Difficulty** (3 features): One-hot encoded [easy, medium, hard]
4. **Pressure** (4 features): One-hot encoded based on deadline proximity
5. **Category** (N features): One-hot encoded task categories
6. **Subcategory** (M features): One-hot encoded subcategories (optional)
7. **Interactions** (optional): Category × difficulty/pressure cross-terms

Example
-------
>>> from src.predict_model.linucb import extract_features
>>> 
>>> x = extract_features(
...     motivation=4,
...     duration=45,
...     difficulty=3,
...     delta_hours=30,
...     category="study",
...     categories=["sport", "study", "work"],
... )
>>> print(x.shape)  # (13,) = 10 base + 3 categories
"""

from typing import Dict, List, Optional, Sequence

import numpy as np

from .constants import (
    MOTIVATION_MIN,
    MOTIVATION_MAX,
    DIFFICULTY_MIN,
    DIFFICULTY_MAX,
    PRESSURE_NO_THRESHOLD,
    PRESSURE_MILD_THRESHOLD,
    PRESSURE_STRONG_THRESHOLD,
    NUM_DIFFICULTY_FEATURES,
    NUM_PRESSURE_FEATURES,
    BASE_FEATURE_COUNT,
    DEFAULT_MAX_DURATION,
)


# =============================================================================
# Individual Feature Extractors
# =============================================================================

def extract_motivation_feature(motivation: float) -> List[float]:
    """Normalize a motivation rating (1-5) to the range [0, 1].

    Parameters
    ----------
    motivation : float
        The motivation level as reported by the user (expected range 1-5).

    Returns
    -------
    List[float]
        A single-element list containing the normalized motivation.

    Examples
    --------
    >>> extract_motivation_feature(1)
    [0.0]
    >>> extract_motivation_feature(5)
    [1.0]
    >>> extract_motivation_feature(3)
    [0.5]
    """
    mot = float(motivation)
    mot = max(MOTIVATION_MIN, min(MOTIVATION_MAX, mot))
    norm = (mot - MOTIVATION_MIN) / (MOTIVATION_MAX - MOTIVATION_MIN)
    return [norm]


def extract_duration_features(
    duration: float,
    max_duration: float = DEFAULT_MAX_DURATION,
) -> List[float]:
    """Extract duration features: shortness and longness.

    Duration is normalized by max_duration, then split into two
    complementary features. This encoding ensures the feature values
    are never zero, which helps with learning stability.

    Parameters
    ----------
    duration : float
        The task duration (same units as max_duration, typically minutes).
    max_duration : float, optional
        The duration corresponding to norm=1.0. Must be positive.
        Default is 120.0 minutes.

    Returns
    -------
    List[float]
        A list of two values: [shortness, longness].

    Raises
    ------
    ValueError
        If max_duration is not positive.

    Examples
    --------
    >>> extract_duration_features(0, 120)    # Very short
    [1.0, 0.0]
    >>> extract_duration_features(120, 120)  # Maximum length
    [0.0, 1.0]
    >>> extract_duration_features(60, 120)   # Half duration
    [0.5, 0.5]
    """
    if max_duration <= 0:
        raise ValueError("max_duration must be positive")

    dur = max(0.0, min(float(duration), max_duration))
    duration_norm = dur / max_duration

    x_short = 1.0 - duration_norm
    x_long = duration_norm
    return [x_short, x_long]


def extract_difficulty_features(difficulty: int) -> List[float]:
    """One-hot encode a difficulty level into three categories.

    Difficulty mapping:
        - 1-2 → easy   [1, 0, 0]
        - 3   → medium [0, 1, 0]
        - 4-5 → hard   [0, 0, 1]

    Parameters
    ----------
    difficulty : int
        The difficulty rating (1-5).

    Returns
    -------
    List[float]
        A one-hot encoded list of length 3: [easy, medium, hard].

    Examples
    --------
    >>> extract_difficulty_features(1)
    [1.0, 0.0, 0.0]
    >>> extract_difficulty_features(3)
    [0.0, 1.0, 0.0]
    >>> extract_difficulty_features(5)
    [0.0, 0.0, 1.0]
    """
    diff = max(DIFFICULTY_MIN, min(DIFFICULTY_MAX, int(difficulty)))

    if diff <= 2:
        return [1.0, 0.0, 0.0]  # easy
    elif diff == 3:
        return [0.0, 1.0, 0.0]  # medium
    else:
        return [0.0, 0.0, 1.0]  # hard


def extract_pressure_features(delta_hours: float) -> List[float]:
    """One-hot encode the time pressure level based on deadline proximity.

    Pressure levels:
        - > 72 hours  → no pressure    [1, 0, 0, 0]
        - 24-72 hours → mild pressure  [0, 1, 0, 0]
        - 6-24 hours  → strong pressure [0, 0, 1, 0]
        - ≤ 6 hours   → urgent         [0, 0, 0, 1]

    Parameters
    ----------
    delta_hours : float
        The time until deadline in hours. Negative values are treated
        as urgent.

    Returns
    -------
    List[float]
        A one-hot encoded list of length 4: [no, mild, strong, urgent].

    Examples
    --------
    >>> extract_pressure_features(100)  # Plenty of time
    [1.0, 0.0, 0.0, 0.0]
    >>> extract_pressure_features(48)   # Mild pressure
    [0.0, 1.0, 0.0, 0.0]
    >>> extract_pressure_features(12)   # Strong pressure
    [0.0, 0.0, 1.0, 0.0]
    >>> extract_pressure_features(2)    # Urgent
    [0.0, 0.0, 0.0, 1.0]
    """
    h = float(delta_hours)

    if h > PRESSURE_NO_THRESHOLD:
        return [1.0, 0.0, 0.0, 0.0]
    elif h > PRESSURE_MILD_THRESHOLD:
        return [0.0, 1.0, 0.0, 0.0]
    elif h > PRESSURE_STRONG_THRESHOLD:
        return [0.0, 0.0, 1.0, 0.0]
    else:
        return [0.0, 0.0, 0.0, 1.0]


def extract_category_features(
    category: str,
    categories: Sequence[str],
    excluded_categories: Optional[Sequence[str]] = None,
) -> List[float]:
    """One-hot encode the task category.

    Parameters
    ----------
    category : str
        The category name of the current task.
    categories : Sequence[str]
        The list of all possible category names.
    excluded_categories : Sequence[str], optional
        Categories to exclude from learning. If the category is in this
        list, returns all zeros so the model won't learn from it.

    Returns
    -------
    List[float]
        A one-hot encoded list of length len(categories).
        All zeros if the category is excluded.

    Raises
    ------
    ValueError
        If the category is not in the list of known categories.

    Examples
    --------
    >>> extract_category_features("study", ["sport", "study", "work"])
    [0.0, 1.0, 0.0]
    >>> extract_category_features("other", ["sport", "other"], excluded_categories=["other"])
    [0.0, 0.0]  # Excluded category returns zeros
    """
    vec = [0.0] * len(categories)
    if not categories:
        return vec

    try:
        idx = categories.index(category)
    except ValueError:
        raise ValueError(
            f"Unknown category '{category}'. "
            f"Valid categories are: {', '.join(categories)}"
        )

    # If category is excluded, return zeros (no learning for this category)
    if excluded_categories and category in excluded_categories:
        return vec

    vec[idx] = 1.0
    return vec


def extract_subcategory_features(
    category: str,
    subcategory: Optional[str],
    subcategory_map: Dict[str, List[str]],
) -> List[float]:
    """One-hot encode the subcategory.

    Subcategories are indexed globally across all categories in sorted
    category order to ensure consistent feature positions.

    Parameters
    ----------
    category : str
        The main category name.
    subcategory : Optional[str]
        The subcategory name, or None if not specified.
    subcategory_map : Dict[str, List[str]]
        A mapping from category names to lists of subcategory names.

    Returns
    -------
    List[float]
        A one-hot encoded vector. All zeros if subcategory is None
        or not found.

    Examples
    --------
    >>> subcat_map = {"sport": ["football", "tennis"], "study": ["math"]}
    >>> extract_subcategory_features("sport", "tennis", subcat_map)
    [0.0, 1.0, 0.0]  # [football, tennis, math]
    """
    total_subcategories = sum(len(subs) for subs in subcategory_map.values())
    vec = [0.0] * total_subcategories

    if not subcategory or not subcategory_map:
        return vec

    if category not in subcategory_map:
        return vec

    if subcategory not in subcategory_map[category]:
        return vec

    # Calculate global index (categories are sorted for consistency)
    global_idx = 0
    for cat in sorted(subcategory_map.keys()):
        if cat == category:
            sub_idx = subcategory_map[cat].index(subcategory)
            global_idx += sub_idx
            break
        else:
            global_idx += len(subcategory_map[cat])

    vec[global_idx] = 1.0
    return vec


# =============================================================================
# Interaction Feature Extractors
# =============================================================================

def extract_category_difficulty_interactions(
    category: str,
    difficulty: int,
    categories: Sequence[str],
) -> List[float]:
    """Create interaction features between category and difficulty.

    This enables the model to learn category-specific difficulty effects,
    e.g., "work is harder for easy tasks but easier for hard tasks".

    Parameters
    ----------
    category : str
        The task category.
    difficulty : int
        Difficulty rating (1-5).
    categories : Sequence[str]
        The list of valid categories.

    Returns
    -------
    List[float]
        A one-hot encoded list of length len(categories) * 3.
        Only one element is 1.0 (the specific category-difficulty combo).

    Raises
    ------
    ValueError
        If the category is not in the list of known categories.
    """
    n_cats = len(categories)
    n_diffs = NUM_DIFFICULTY_FEATURES
    vec = [0.0] * (n_cats * n_diffs)

    if not categories:
        return vec

    try:
        cat_idx = categories.index(category)
    except ValueError:
        raise ValueError(
            f"Unknown category '{category}'. "
            f"Valid categories are: {', '.join(categories)}"
        )

    # Map difficulty to index
    diff = max(DIFFICULTY_MIN, min(DIFFICULTY_MAX, int(difficulty)))
    if diff <= 2:
        diff_idx = 0  # easy
    elif diff == 3:
        diff_idx = 1  # medium
    else:
        diff_idx = 2  # hard

    vec[cat_idx * n_diffs + diff_idx] = 1.0
    return vec


def extract_category_pressure_interactions(
    category: str,
    delta_hours: float,
    categories: Sequence[str],
) -> List[float]:
    """Create interaction features between category and time pressure.

    This enables the model to learn category-specific pressure effects,
    e.g., "work tasks are harder normally but easier under urgent pressure".

    Parameters
    ----------
    category : str
        The task category.
    delta_hours : float
        Hours remaining until deadline.
    categories : Sequence[str]
        The list of valid categories.

    Returns
    -------
    List[float]
        A one-hot encoded list of length len(categories) * 4.
        Only one element is 1.0 (the specific category-pressure combo).

    Raises
    ------
    ValueError
        If the category is not in the list of known categories.
    """
    n_cats = len(categories)
    n_pressures = NUM_PRESSURE_FEATURES
    vec = [0.0] * (n_cats * n_pressures)

    if not categories:
        return vec

    try:
        cat_idx = categories.index(category)
    except ValueError:
        raise ValueError(
            f"Unknown category '{category}'. "
            f"Valid categories are: {', '.join(categories)}"
        )

    # Map delta_hours to pressure index
    h = float(delta_hours)
    if h > PRESSURE_NO_THRESHOLD:
        press_idx = 0
    elif h > PRESSURE_MILD_THRESHOLD:
        press_idx = 1
    elif h > PRESSURE_STRONG_THRESHOLD:
        press_idx = 2
    else:
        press_idx = 3

    vec[cat_idx * n_pressures + press_idx] = 1.0
    return vec


# =============================================================================
# Utility Functions
# =============================================================================

def get_feature_count(
    num_categories: int,
    use_interactions: bool = False,
    num_subcategories: int = 0,
) -> int:
    """Calculate the total number of features for a given configuration.

    Parameters
    ----------
    num_categories : int
        The number of task categories.
    use_interactions : bool, optional
        Whether to include interaction features. Default is False.
    num_subcategories : int, optional
        Total number of subcategories across all categories. Default is 0.

    Returns
    -------
    int
        Total feature count.

    Examples
    --------
    >>> get_feature_count(6)  # 6 categories, no interactions
    16
    >>> get_feature_count(6, use_interactions=True)
    58
    >>> get_feature_count(6, num_subcategories=3)
    19
    """
    base = BASE_FEATURE_COUNT + num_categories + num_subcategories

    if use_interactions:
        # Category × Difficulty + Category × Pressure
        interactions = (
            num_categories * NUM_DIFFICULTY_FEATURES
            + num_categories * NUM_PRESSURE_FEATURES
        )
        return base + interactions

    return base


def get_subcategory_global_index(
    category: str,
    subcategory: str,
    subcategory_map: Dict[str, List[str]],
) -> int:
    """Get the global feature index for a subcategory.

    Parameters
    ----------
    category : str
        The main category name.
    subcategory : str
        The subcategory name.
    subcategory_map : Dict[str, List[str]]
        A mapping from category names to lists of subcategory names.

    Returns
    -------
    int
        The global index for the subcategory, or -1 if not found.
    """
    if category not in subcategory_map:
        return -1
    if subcategory not in subcategory_map[category]:
        return -1

    global_idx = 0
    for cat in sorted(subcategory_map.keys()):
        if cat == category:
            sub_idx = subcategory_map[cat].index(subcategory)
            return global_idx + sub_idx
        global_idx += len(subcategory_map[cat])

    return -1


# =============================================================================
# Main Feature Extraction Function
# =============================================================================

def extract_features(
    motivation: float,
    duration: float,
    difficulty: int,
    delta_hours: float,
    category: str,
    categories: Sequence[str],
    max_duration: float = DEFAULT_MAX_DURATION,
    use_interactions: bool = False,
    subcategory: Optional[str] = None,
    subcategory_map: Optional[Dict[str, List[str]]] = None,
    excluded_categories: Optional[Sequence[str]] = None,
) -> np.ndarray:
    """Assemble all feature components into a single numpy vector.

    This is the main feature extraction function that combines all
    individual feature extractors into a complete feature vector
    suitable for the LinUCB model.

    Parameters
    ----------
    motivation : float
        User's motivation rating (1-5).
    duration : float
        Duration of the task (same units as max_duration).
    difficulty : int
        Difficulty rating (1-5).
    delta_hours : float
        Hours remaining until the task's deadline.
    category : str
        The task category.
    categories : Sequence[str]
        The list of valid categories for one-hot encoding.
    max_duration : float, optional
        Maximum duration for normalization. Default is 120.0 minutes.
    use_interactions : bool, optional
        Whether to include category×difficulty and category×pressure
        interaction features. Default is False.
    subcategory : Optional[str], optional
        The subcategory name within the main category. Default is None.
    subcategory_map : Optional[Dict[str, List[str]]], optional
        A mapping from category names to lists of subcategory names.
        Default is None.
    excluded_categories : Optional[Sequence[str]], optional
        Categories to exclude from learning. If the task's category is
        in this list, the category feature will be all zeros.
        Default is None.

    Returns
    -------
    numpy.ndarray
        A 1D array representing the complete feature vector for the task.

    Examples
    --------
    >>> categories = ["sport", "study", "work"]
    >>> x = extract_features(
    ...     motivation=4,
    ...     duration=45,
    ...     difficulty=3,
    ...     delta_hours=30,
    ...     category="study",
    ...     categories=categories,
    ... )
    >>> print(x.shape)
    (13,)
    """
    features: List[float] = []

    # Base features (10 total)
    features.extend(extract_motivation_feature(motivation))
    features.extend(extract_duration_features(duration, max_duration))
    features.extend(extract_difficulty_features(difficulty))
    features.extend(extract_pressure_features(delta_hours))

    # Category features (excluded categories get zeros)
    features.extend(extract_category_features(category, categories, excluded_categories))

    # Subcategory features (if provided)
    if subcategory_map:
        features.extend(
            extract_subcategory_features(category, subcategory, subcategory_map)
        )

    # Interaction features (optional)
    if use_interactions:
        features.extend(
            extract_category_difficulty_interactions(category, difficulty, categories)
        )
        features.extend(
            extract_category_pressure_interactions(category, delta_hours, categories)
        )

    return np.array(features, dtype=np.float64)
