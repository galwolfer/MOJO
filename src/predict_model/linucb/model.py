"""
LinUCB Model Implementation
===========================

This module contains the main MultiFeatureLinUCB class that implements
the Linear Upper Confidence Bound algorithm for contextual bandits.

The model learns to predict task completion success based on features
like motivation, difficulty, time pressure, and task category. It
supports online learning, dynamic subcategory management, and
configurable priors.

Example
-------
>>> from src.predict_model.linucb import MultiFeatureLinUCB
>>>
>>> # Create with priors (recommended)
>>> model = MultiFeatureLinUCB.create_with_priors(
...     categories=["sport", "study", "work"],
...     motivation_weight=1.0,
...     difficulty_weights=(0.3, 0.0, -0.3),
... )
>>>
>>> # Extract features and make predictions
>>> x = model.extract_features_with_subcategory(
...     motivation=4, duration=45, difficulty=3,
...     delta_hours=30, category="study",
... )
>>> score = model.predict_score(x)
>>> category = model.predict_category(x)
>>>
>>> # Update with observed reward
>>> model.update(x, reward=0.8)
"""

from __future__ import annotations

import copy
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence, Tuple

import numpy as np

from .constants import (
    BASE_FEATURE_COUNT,
    CATEGORY_START_INDEX,
    DEFAULT_ALPHA,
    DEFAULT_DIFFICULTY_WEIGHTS,
    DEFAULT_LEARN_RATE,
    DEFAULT_MAX_DURATION,
    DEFAULT_MOTIVATION_WEIGHT,
    DEFAULT_PRIOR_STRENGTH,
    DEFAULT_THRESHOLDS,
    DIFFICULTY_START_INDEX,
    MOTIVATION_INDEX,
)
from .features import extract_features, get_feature_count


@dataclass
class MultiFeatureLinUCB:
    """LinUCB model for multi-feature contextual bandits.

    This class implements the core LinUCB algorithm for a feature vector
    of arbitrary length. The model maintains:

    - ``A``: Covariance matrix (d × d)
    - ``A_inv``: Inverse of A for efficient computation
    - ``b``: Reward-weighted feature accumulator (d,)
    - ``theta``: Learned weights (d,)

    Predictions are made using the UCB formula:
        score = θᵀx + α√(xᵀA⁻¹x)

    Parameters
    ----------
    n_features : int
        The length of the feature vector.
    alpha : float, optional
        Exploration parameter controlling UCB bonus magnitude.
        Default is 0.1.
    thresholds : Sequence[float], optional
        Score thresholds for category prediction (must be 4 values,
        non-increasing). Default is [0.85, 0.65, 0.45, 0.25].
    init_theta : Sequence[float], optional
        Initial weight vector. If None, starts at zero.
    categories : Sequence[str], optional
        List of task category names for reference.
    subcategory_map : Dict[str, List[str]], optional
        Mapping from categories to their subcategories.
    prior_strength : float, optional
        Strength of Bayesian prior (if init_theta provided).
        Default is 0.0.
    learn_rate : float, optional
        Learning rate for updates (0-1]. Default is 1.0.

    Attributes
    ----------
    A : numpy.ndarray
        Covariance matrix (d × d).
    A_inv : numpy.ndarray
        Inverse of A.
    b : numpy.ndarray
        Reward-weighted feature accumulator.
    theta : numpy.ndarray
        Current weight vector.

    See Also
    --------
    create_with_priors : Factory method for creating models with priors.
    """

    # Required parameters
    n_features: int

    # Optional parameters with defaults
    alpha: float = DEFAULT_ALPHA
    thresholds: Sequence[float] = field(default_factory=lambda: list(DEFAULT_THRESHOLDS))
    init_theta: Optional[Sequence[float]] = None
    categories: Optional[Sequence[str]] = None
    subcategory_map: Dict[str, List[str]] = field(default_factory=dict)
    prior_strength: float = 0.0
    learn_rate: float = 1.0

    # Internal state (initialized in __post_init__)
    A: np.ndarray = field(init=False, repr=False)
    A_inv: np.ndarray = field(init=False, repr=False)
    b: np.ndarray = field(init=False, repr=False)
    theta: np.ndarray = field(init=False, repr=False)

    def __post_init__(self) -> None:
        """Initialize model matrices and validate parameters."""
        self._validate_thresholds()
        self._initialize_matrices()

    def _validate_thresholds(self) -> None:
        """Validate threshold values."""
        if len(self.thresholds) != 4:
            raise ValueError("thresholds must contain exactly four values")
        if sorted(self.thresholds, reverse=True) != list(self.thresholds):
            raise ValueError("thresholds must be in non-increasing order")

    def _initialize_matrices(self) -> None:
        """Initialize A, A_inv, b, and theta matrices."""
        n = self.n_features

        # Default initialization
        self.A = np.eye(n, dtype=np.float64)
        self.A_inv = np.eye(n, dtype=np.float64)
        self.b = np.zeros(n, dtype=np.float64)

        if self.init_theta is None:
            self.theta = np.zeros(n, dtype=np.float64)
        else:
            if len(self.init_theta) != n:
                raise ValueError(
                    f"init_theta length ({len(self.init_theta)}) "
                    f"must match n_features ({n})"
                )

            theta0 = np.array(self.init_theta, dtype=np.float64)

            if self.prior_strength > 0.0:
                # Encode prior: A₀ = λI, b₀ = λθ₀, θ = θ₀
                lam = float(self.prior_strength)
                self.A = lam * np.eye(n, dtype=np.float64)
                self.A_inv = (1.0 / lam) * np.eye(n, dtype=np.float64)
                self.b = lam * theta0
                self.theta = theta0.copy()
            else:
                self.theta = theta0.copy()

    # =========================================================================
    # Factory Methods
    # =========================================================================

    @classmethod
    def create_with_priors(
        cls,
        categories: Sequence[str],
        motivation_weight: float = DEFAULT_MOTIVATION_WEIGHT,
        difficulty_weights: Tuple[float, float, float] = DEFAULT_DIFFICULTY_WEIGHTS,
        alpha: float = DEFAULT_ALPHA,
        prior_strength: float = DEFAULT_PRIOR_STRENGTH,
        learn_rate: float = DEFAULT_LEARN_RATE,
        thresholds: Optional[Sequence[float]] = None,
        use_interactions: bool = False,
        subcategory_map: Optional[Dict[str, List[str]]] = None,
    ) -> MultiFeatureLinUCB:
        """Create a model with motivation and difficulty priors pre-configured.

        This factory method provides a convenient way to initialize a LinUCB
        model with sensible priors that encode domain knowledge:

        - High motivation → better task completion
        - Easy tasks → better completion
        - Hard tasks → worse completion

        Parameters
        ----------
        categories : Sequence[str]
            The list of task category names.
        motivation_weight : float, optional
            Weight for the motivation feature. Default is 1.0.
        difficulty_weights : Tuple[float, float, float], optional
            Weights for (easy, medium, hard) difficulty levels.
            Default is (0.3, 0.0, -0.3).
        alpha : float, optional
            Exploration parameter for UCB. Default is 0.1.
        prior_strength : float, optional
            How strongly the prior beliefs are held. Default is 5.0.
        learn_rate : float, optional
            Learning rate for updates (0-1]. Default is 0.5.
        thresholds : Sequence[float], optional
            Score thresholds for category prediction. Default is
            [0.85, 0.65, 0.45, 0.25].
        use_interactions : bool, optional
            Whether to include interaction features. Default is False.
        subcategory_map : Dict[str, List[str]], optional
            Initial subcategory mapping. Default is None.

        Returns
        -------
        MultiFeatureLinUCB
            A configured model instance with priors set.

        Examples
        --------
        >>> model = MultiFeatureLinUCB.create_with_priors(
        ...     categories=["sport", "study", "work"],
        ...     motivation_weight=1.0,
        ...     difficulty_weights=(0.3, 0.0, -0.3),
        ...     prior_strength=5.0,
        ... )
        """
        if thresholds is None:
            thresholds = list(DEFAULT_THRESHOLDS)

        if subcategory_map is None:
            subcategory_map = {}

        # Calculate feature count
        num_subcategories = sum(len(subs) for subs in subcategory_map.values())
        n_features = get_feature_count(
            num_categories=len(categories),
            use_interactions=use_interactions,
            num_subcategories=num_subcategories,
        )

        # Build init_theta with priors
        init_theta = np.zeros(n_features, dtype=np.float64)

        # Set motivation prior (index 0)
        init_theta[MOTIVATION_INDEX] = motivation_weight

        # Set difficulty priors (indices 3, 4, 5)
        easy_weight, medium_weight, hard_weight = difficulty_weights
        init_theta[DIFFICULTY_START_INDEX] = easy_weight
        init_theta[DIFFICULTY_START_INDEX + 1] = medium_weight
        init_theta[DIFFICULTY_START_INDEX + 2] = hard_weight

        return cls(
            n_features=n_features,
            alpha=alpha,
            thresholds=thresholds,
            init_theta=init_theta,
            categories=list(categories),
            subcategory_map=subcategory_map,
            prior_strength=prior_strength,
            learn_rate=learn_rate,
        )

    # =========================================================================
    # Prediction Methods
    # =========================================================================

    def predict_score(self, x: np.ndarray) -> float:
        """Compute the UCB score for a feature vector.

        The score combines the linear estimate (θᵀx) with an exploration
        bonus (α√(xᵀA⁻¹x)).

        Parameters
        ----------
        x : numpy.ndarray
            Feature vector of shape (n_features,).

        Returns
        -------
        float
            The predicted score.

        Raises
        ------
        ValueError
            If feature vector length doesn't match model.
        """
        self._validate_feature_vector(x)

        mu = float(np.dot(self.theta, x))
        ucb_variance = float(np.dot(x, np.dot(self.A_inv, x)))
        bonus = self.alpha * np.sqrt(max(0.0, ucb_variance))

        return mu + bonus

    def predict_category(self, x: np.ndarray) -> int:
        """Predict the ordinal category (1-5) for a feature vector.

        Categories map to completion quality:
            1 = Excellent (completed early/on time)
            2 = Good
            3 = Acceptable
            4 = Poor
            5 = Failed (not completed)

        Parameters
        ----------
        x : numpy.ndarray
            Feature vector of shape (n_features,).

        Returns
        -------
        int
            Category index in the range [1, 5].
        """
        score = self.predict_score(x)

        for idx, threshold in enumerate(self.thresholds):
            if score >= threshold:
                return idx + 1

        return len(self.thresholds) + 1

    # =========================================================================
    # Update Methods
    # =========================================================================

    def update(self, x: np.ndarray, reward: float) -> None:
        """Update the model with a new observation.

        Uses the Sherman-Morrison formula for efficient rank-1 updates
        to avoid full matrix inversion.

        Parameters
        ----------
        x : numpy.ndarray
            Feature vector of shape (n_features,).
        reward : float
            Observed reward in [0, 1], representing task completion quality.

        Raises
        ------
        ValueError
            If feature vector length doesn't match model.
        """
        self._validate_feature_vector(x)

        x_col = x.reshape(-1, 1)  # Column vector
        eta = float(self.learn_rate)

        # Sherman-Morrison update for A_inv
        # A_inv ← A_inv - η(A_inv x xᵀ A_inv) / (1 + η xᵀ A_inv x)
        Ax = np.dot(self.A_inv, x_col)
        denom = 1.0 + eta * float(np.dot(x_col.T, Ax).ravel()[0])
        self.A_inv = self.A_inv - (eta * np.dot(Ax, Ax.T) / denom)

        # Update b and theta
        self.b += eta * reward * x
        self.theta = np.dot(self.A_inv, self.b)

    # =========================================================================
    # Feature Extraction Convenience Method
    # =========================================================================

    def extract_features_with_subcategory(
        self,
        motivation: float,
        duration: float,
        difficulty: int,
        delta_hours: float,
        category: str,
        max_duration: float = DEFAULT_MAX_DURATION,
        use_interactions: bool = False,
        subcategory: Optional[str] = None,
    ) -> np.ndarray:
        """Extract features using the model's categories and subcategory_map.

        Convenience method that uses the model's internal categories
        and subcategory_map for feature extraction.

        Parameters
        ----------
        motivation : float
            User's motivation rating (1-5).
        duration : float
            Duration of the task in minutes.
        difficulty : int
            Difficulty rating (1-5).
        delta_hours : float
            Hours remaining until deadline.
        category : str
            The task category.
        max_duration : float, optional
            Maximum duration for normalization. Default is 120.0.
        use_interactions : bool, optional
            Whether to include interaction features. Default is False.
        subcategory : Optional[str], optional
            The subcategory name. Default is None.

        Returns
        -------
        numpy.ndarray
            The feature vector for this task.

        Raises
        ------
        ValueError
            If categories are not set.
        """
        if self.categories is None:
            raise ValueError("Categories not set during initialization")

        return extract_features(
            motivation=motivation,
            duration=duration,
            difficulty=difficulty,
            delta_hours=delta_hours,
            category=category,
            categories=self.categories,
            max_duration=max_duration,
            use_interactions=use_interactions,
            subcategory=subcategory,
            subcategory_map=self.subcategory_map if self.subcategory_map else None,
        )

    # =========================================================================
    # Category Information Methods
    # =========================================================================

    def get_category_feature_index(self, category: str) -> int:
        """Get the feature index for a specific category.

        Parameters
        ----------
        category : str
            The category name to look up.

        Returns
        -------
        int
            The feature index, or -1 if not found.

        Raises
        ------
        ValueError
            If categories are not set.
        """
        if self.categories is None:
            raise ValueError("Categories not set during initialization")

        try:
            cat_idx = self.categories.index(category)
            return CATEGORY_START_INDEX + cat_idx
        except ValueError:
            return -1

    def get_category_weight(self, category: str) -> Optional[float]:
        """Get the learned weight for a specific category.

        Parameters
        ----------
        category : str
            The category name.

        Returns
        -------
        Optional[float]
            The learned weight, or None if not found.

        Raises
        ------
        ValueError
            If categories are not set.
        """
        if self.categories is None:
            raise ValueError("Categories not set during initialization")

        feature_idx = self.get_category_feature_index(category)
        if feature_idx == -1:
            return None

        return float(self.theta[feature_idx])

    def get_category_weights_map(self) -> Dict[str, float]:
        """Get a mapping of all categories to their learned weights.

        Returns
        -------
        Dict[str, float]
            Dictionary mapping category names to weights.
        """
        if self.categories is None:
            return {}

        return {
            category: self.get_category_weight(category)
            for category in self.categories
        }

    def get_category_info(self, category: str) -> Dict[str, Any]:
        """Get comprehensive information about a specific category.

        Parameters
        ----------
        category : str
            The category name.

        Returns
        -------
        Dict[str, Any]
            Dictionary with keys: name, found, feature_index, weight.
        """
        if self.categories is None:
            return {
                "name": category,
                "found": False,
                "feature_index": None,
                "weight": None,
            }

        feature_idx = self.get_category_feature_index(category)
        if feature_idx == -1:
            return {
                "name": category,
                "found": False,
                "feature_index": None,
                "weight": None,
            }

        return {
            "name": category,
            "found": True,
            "feature_index": feature_idx,
            "weight": float(self.theta[feature_idx]),
        }

    # =========================================================================
    # Subcategory Management
    # =========================================================================

    def get_total_subcategories(self) -> int:
        """Get the total number of subcategories across all categories."""
        return sum(len(subs) for subs in self.subcategory_map.values())

    def get_subcategories(self, category: str) -> List[str]:
        """Get the list of subcategories for a specific category."""
        return list(self.subcategory_map.get(category, []))

    def get_all_subcategories(self) -> Dict[str, List[str]]:
        """Get a deep copy of the entire subcategory map."""
        return copy.deepcopy(self.subcategory_map)

    def has_subcategory(self, category: str, subcategory: str) -> bool:
        """Check if a subcategory exists under a category."""
        if category not in self.subcategory_map:
            return False
        return subcategory in self.subcategory_map[category]

    def add_subcategory(
        self,
        category: str,
        subcategory: str,
    ) -> Tuple[bool, str]:
        """Add a new subcategory under a main category.

        This expands the model's feature space by adding a new dimension
        to all matrices.

        Parameters
        ----------
        category : str
            The main category name (must exist in self.categories).
        subcategory : str
            The new subcategory name to add.

        Returns
        -------
        Tuple[bool, str]
            (success, message) tuple.
        """
        # Validate category
        if self.categories is not None and category not in self.categories:
            return (False, f"Category '{category}' is not a valid category")

        # Check for duplicates
        if category in self.subcategory_map:
            if subcategory in self.subcategory_map[category]:
                return (
                    False,
                    f"Subcategory '{subcategory}' already exists under '{category}'",
                )

        # Calculate insertion index
        insert_idx = self._calculate_subcategory_insert_index(category)

        # Initialize category in map if needed
        if category not in self.subcategory_map:
            self.subcategory_map[category] = []

        # Expand matrices
        self._expand_feature_space(insert_idx)

        # Add subcategory to map
        self.subcategory_map[category].append(subcategory)

        return (True, f"Subcategory '{subcategory}' added under '{category}'")

    def remove_subcategory(
        self,
        category: str,
        subcategory: str,
    ) -> Tuple[bool, str]:
        """Remove a subcategory from under a main category.

        This shrinks the model's feature space by removing a dimension
        from all matrices.

        Parameters
        ----------
        category : str
            The main category name.
        subcategory : str
            The subcategory name to remove.

        Returns
        -------
        Tuple[bool, str]
            (success, message) tuple.
        """
        if category not in self.subcategory_map:
            return (False, f"Category '{category}' has no subcategories")

        if subcategory not in self.subcategory_map[category]:
            return (
                False,
                f"Subcategory '{subcategory}' does not exist under '{category}'",
            )

        # Find feature index to remove
        remove_idx = self.get_subcategory_feature_index(category, subcategory)

        # Shrink matrices
        self._shrink_feature_space(remove_idx)

        # Remove from map
        self.subcategory_map[category].remove(subcategory)

        # Clean up empty entries
        if len(self.subcategory_map[category]) == 0:
            del self.subcategory_map[category]

        return (True, f"Subcategory '{subcategory}' removed from '{category}'")

    def get_subcategory_feature_index(
        self,
        category: str,
        subcategory: str,
    ) -> int:
        """Get the feature index for a specific subcategory.

        Returns
        -------
        int
            The feature index, or -1 if not found.
        """
        if not self.has_subcategory(category, subcategory):
            return -1

        base_offset = BASE_FEATURE_COUNT + (
            len(self.categories) if self.categories else 0
        )

        idx = base_offset
        for cat in sorted(self.subcategory_map.keys()):
            if cat == category:
                sub_idx = self.subcategory_map[cat].index(subcategory)
                return idx + sub_idx
            idx += len(self.subcategory_map[cat])

        return -1

    def get_subcategory_weight(
        self,
        category: str,
        subcategory: str,
    ) -> Optional[float]:
        """Get the learned weight for a specific subcategory."""
        feature_idx = self.get_subcategory_feature_index(category, subcategory)
        if feature_idx == -1:
            return None
        return float(self.theta[feature_idx])

    def get_subcategory_weights_map(self) -> Dict[str, Dict[str, float]]:
        """Get a mapping of all subcategories to their learned weights.

        Returns
        -------
        Dict[str, Dict[str, float]]
            Nested dict: {category: {subcategory: weight}}.
        """
        result: Dict[str, Dict[str, float]] = {}

        for category, subcategories in self.subcategory_map.items():
            result[category] = {}
            for subcategory in subcategories:
                weight = self.get_subcategory_weight(category, subcategory)
                if weight is not None:
                    result[category][subcategory] = weight

        return result

    def get_subcategory_info(
        self,
        category: str,
        subcategory: str,
    ) -> Dict[str, Any]:
        """Get comprehensive information about a specific subcategory."""
        if not self.has_subcategory(category, subcategory):
            return {
                "category": category,
                "subcategory": subcategory,
                "found": False,
                "feature_index": None,
                "weight": None,
            }

        feature_idx = self.get_subcategory_feature_index(category, subcategory)
        return {
            "category": category,
            "subcategory": subcategory,
            "found": True,
            "feature_index": feature_idx,
            "weight": float(self.theta[feature_idx]),
        }

    # =========================================================================
    # Private Helper Methods
    # =========================================================================

    def _validate_feature_vector(self, x: np.ndarray) -> None:
        """Validate that a feature vector has the correct shape."""
        if x.shape[0] != self.n_features:
            raise ValueError(
                f"Feature vector length ({x.shape[0]}) "
                f"does not match model ({self.n_features})"
            )

    def _calculate_subcategory_insert_index(self, category: str) -> int:
        """Calculate where to insert a new subcategory feature."""
        base_offset = BASE_FEATURE_COUNT + (
            len(self.categories) if self.categories else 0
        )

        insert_idx = base_offset
        existing_cats = sorted(self.subcategory_map.keys())

        for cat in existing_cats:
            if cat == category:
                insert_idx += len(self.subcategory_map[cat])
                break
            elif cat > category:
                break
            else:
                insert_idx += len(self.subcategory_map[cat])

        return insert_idx

    def _expand_feature_space(self, insert_idx: int) -> None:
        """Expand feature space by inserting a new dimension."""
        # Expand A matrix
        new_A = np.insert(self.A, insert_idx, 0, axis=0)
        new_A = np.insert(new_A, insert_idx, 0, axis=1)
        new_A[insert_idx, insert_idx] = 1.0
        self.A = new_A

        # Expand A_inv matrix
        new_A_inv = np.insert(self.A_inv, insert_idx, 0, axis=0)
        new_A_inv = np.insert(new_A_inv, insert_idx, 0, axis=1)
        new_A_inv[insert_idx, insert_idx] = 1.0
        self.A_inv = new_A_inv

        # Expand vectors
        self.b = np.insert(self.b, insert_idx, 0)
        self.theta = np.insert(self.theta, insert_idx, 0)

        self.n_features += 1

    def _shrink_feature_space(self, remove_idx: int) -> None:
        """Shrink feature space by removing a dimension."""
        self.A = np.delete(np.delete(self.A, remove_idx, axis=0), remove_idx, axis=1)
        self.A_inv = np.delete(
            np.delete(self.A_inv, remove_idx, axis=0), remove_idx, axis=1
        )
        self.b = np.delete(self.b, remove_idx)
        self.theta = np.delete(self.theta, remove_idx)

        self.n_features -= 1
