"""
Multi-Feature LinUCB Model
==========================

This module implements a configurable version of the LinUCB algorithm
for contextual bandits using multiple features.  It is designed to fit
the specification described in the planning phase where each task
consists of several interpretable features:

  - **Motivation**: the user's stated desire to complete a task (1–5),
    normalised to [0, 1].
  - **Duration (shortness/longness)**: the length of the task
    encoded as two complementary features (`x_short`, `x_long`)
    so that short tasks have high `x_short` and long tasks have high
    `x_long`.  This prevents the update from disappearing when the
    feature value would have been zero.
  - **Difficulty**: discretised into three categories (easy,
    medium, hard) and encoded as one-hot.  This allows the model to
    learn separate weights for each difficulty category without
    implying an artificial ordinal relationship.
  - **Time Pressure**: based solely on the remaining time until
    deadline (`delta_hours`) rather than task duration.  Four
    buckets are used: no pressure, mild pressure, strong pressure
    and urgent, encoded as a one-hot vector.
  - **Task Category**: one-hot encoding for the domain of the
    task (e.g. sport, study, work).  This allows the model to
    capture user-specific tendencies per domain.
  - **Interaction Features** (optional): cross-product terms between
    category and other features (difficulty, pressure).  This enables
    learning category-specific exceptions, e.g., "work is generally bad
    but good under urgent pressure".  Without interactions, a category
    has a single global weight that applies to all feature combinations.

The model can be initialised with an arbitrary list of categories
and default parameters controlling exploration and classification
thresholds.  Feature extraction is handled by standalone helper
functions which compute the correct vector of inputs given
task-specific information.

Example usage:

    from multi_feature_linucb import MultiFeatureLinUCB, extract_features

    # define categories for tasks (must align with actual values used
    # elsewhere in your application)
    categories = ["sport", "study", "work", "home", "health", "habits"]

    # create a model with appropriate number of features
    model = MultiFeatureLinUCB(num_motivation_features=1,
                               num_duration_features=2,
                               num_difficulty_features=3,
                               num_pressure_features=4,
                               num_category_features=len(categories),
                               alpha=0.1)

    # extract feature vector for a new task
    x = extract_features(motivation=4,               # user motivation 1..5
                         duration=45,               # task length in minutes
                         difficulty=3,              # difficulty rating 1..5
                         delta_hours=30,            # hours until deadline
                         category="study",         # task category
                         categories=categories,     # known categories
                         max_duration=120)          # max duration for normalisation

    # predict and update the model after observing behaviour
    predicted_category = model.predict_category(x)
    # ... wait for user to complete task ...
    observed_reward = 0.5  # e.g. user completed slightly late
    model.update(x, reward=observed_reward)

The LinUCB model learns online from each task.  Each reward
reinforces or discourages the current association between the task
features and the user's performance.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Sequence
import numpy as np


def extract_motivation_feature(motivation: float) -> List[float]:
    """Normalise a motivation rating (1–5) to the range [0, 1].

    Parameters
    ----------
    motivation : float
        The motivation level as reported by the user (expected range 1–5).

    Returns
    -------
    List[float]
        A single-element list containing the normalised motivation.
    """
    # Ensure value is within bounds
    mot = float(motivation)
    if mot < 1.0:
        mot = 1.0
    elif mot > 5.0:
        mot = 5.0
    # normalise: 1 -> 0.0, 5 -> 1.0
    norm = (mot - 1.0) / 4.0
    return [norm]


def extract_duration_features(duration: float, max_duration: float) -> List[float]:
    """Return duration features: shortness and longness.

    Duration is normalised by max_duration, then split into two features
    representing how short and how long the task is.  Short tasks
    produce high shortness and low longness, and vice versa.

    Parameters
    ----------
    duration : float
        The task duration (same units as max_duration, typically minutes).
    max_duration : float
        The duration corresponding to norm=1.0 (e.g. maximum expected
        task length).  Must be positive.

    Returns
    -------
    List[float]
        A list of two values: [shortness, longness].
    """
    if max_duration <= 0:
        raise ValueError("max_duration must be positive")
    # clamp duration to [0, max_duration]
    dur = max(0.0, float(duration))
    if dur > max_duration:
        dur = max_duration
    duration_norm = dur / max_duration
    # compute complementary features
    x_short = 1.0 - duration_norm
    x_long = duration_norm
    return [x_short, x_long]


def extract_difficulty_features(difficulty: int) -> List[float]:
    """One-hot encode a difficulty level into three categories.

    Difficulty is expected to be in the range 1–5.  Values 1–2 map to
    'easy', 3 maps to 'medium', and 4–5 map to 'hard'.

    Parameters
    ----------
    difficulty : int
        The difficulty rating (1–5).

    Returns
    -------
    List[float]
        A one-hot encoded list of length 3: [easy, medium, hard].
    """
    diff = int(difficulty)
    if diff < 1:
        diff = 1
    if diff > 5:
        diff = 5
    if diff <= 2:
        return [1.0, 0.0, 0.0]
    elif diff == 3:
        return [0.0, 1.0, 0.0]
    else:
        return [0.0, 0.0, 1.0]


def extract_pressure_features(delta_hours: float) -> List[float]:
    """One-hot encode the time pressure level.

    Based on hours remaining until the deadline (delta_hours), classify
    into one of four buckets:

    - >72 hours: no pressure
    - 24–72 hours: mild pressure
    - 6–24 hours: strong pressure
    - ≤6 hours: urgent

    Parameters
    ----------
    delta_hours : float
        The time until deadline in hours.  Negative values are treated
        as urgent.

    Returns
    -------
    List[float]
        A one-hot encoded list of length 4: [no, mild, strong, urgent].
    """
    h = float(delta_hours)
    # negative or extremely small values count as urgent
    if h > 72.0:
        return [1.0, 0.0, 0.0, 0.0]
    elif h > 24.0:
        return [0.0, 1.0, 0.0, 0.0]
    elif h > 6.0:
        return [0.0, 0.0, 1.0, 0.0]
    else:
        return [0.0, 0.0, 0.0, 1.0]


def extract_category_features(category: str, categories: Sequence[str]) -> List[float]:
    """One-hot encode the task category based on a list of known categories.

    Parameters
    ----------
    category : str
        The category name of the current task.
    categories : Sequence[str]
        The list of all possible category names used to build the model.

    Returns
    -------
    List[float]
        A one-hot encoded list of length len(categories).
        
    Raises
    ------
    ValueError
        If the provided category is not in the list of known categories.
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
    vec[idx] = 1.0
    return vec


def extract_category_difficulty_interactions(
    category: str, difficulty: int, categories: Sequence[str]
) -> List[float]:
    """Create interaction features between category and difficulty.

    This enables the model to learn category-specific difficulty effects,
    e.g., "work is bad for easy tasks but good for hard tasks".

    Parameters
    ----------
    category : str
        The task category.
    difficulty : int
        Difficulty rating (1–5).
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
        If the provided category is not in the list of known categories.
    """
    n_cats = len(categories)
    n_diffs = 3  # easy, medium, hard
    vec = [0.0] * (n_cats * n_diffs)
    if not categories:
        return vec

    # Get category index
    try:
        cat_idx = categories.index(category)
    except ValueError:
        raise ValueError(
            f"Unknown category '{category}'. "
            f"Valid categories are: {', '.join(categories)}"
        )

    # Get difficulty index (same logic as extract_difficulty_features)
    diff = int(difficulty)
    if diff < 1:
        diff = 1
    if diff > 5:
        diff = 5
    if diff <= 2:
        diff_idx = 0  # easy
    elif diff == 3:
        diff_idx = 1  # medium
    else:
        diff_idx = 2  # hard

    # Set the interaction feature
    vec[cat_idx * n_diffs + diff_idx] = 1.0
    return vec


def extract_category_pressure_interactions(
    category: str, delta_hours: float, categories: Sequence[str]
) -> List[float]:
    """Create interaction features between category and time pressure.

    This enables the model to learn category-specific pressure effects,
    e.g., "work is bad normally but good under urgent pressure".

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
        If the provided category is not in the list of known categories.
    """
    n_cats = len(categories)
    n_pressures = 4  # no, mild, strong, urgent
    vec = [0.0] * (n_cats * n_pressures)
    if not categories:
        return vec

    # Get category index
    try:
        cat_idx = categories.index(category)
    except ValueError:
        raise ValueError(
            f"Unknown category '{category}'. "
            f"Valid categories are: {', '.join(categories)}"
        )

    # Get pressure index (same logic as extract_pressure_features)
    h = float(delta_hours)
    if h > 72.0:
        press_idx = 0  # no pressure
    elif h > 24.0:
        press_idx = 1  # mild
    elif h > 6.0:
        press_idx = 2  # strong
    else:
        press_idx = 3  # urgent

    # Set the interaction feature
    vec[cat_idx * n_pressures + press_idx] = 1.0
    return vec


def get_feature_count(num_categories: int, use_interactions: bool = False) -> int:
    """Calculate the total number of features for a given configuration.

    Parameters
    ----------
    num_categories : int
        The number of task categories.
    use_interactions : bool, optional
        Whether to include interaction features. Default is False.

    Returns
    -------
    int
        Total feature count:
        - Base: 1 (motivation) + 2 (duration) + 3 (difficulty) + 4 (pressure)
                + num_categories = 10 + num_categories
        - With interactions: base + num_categories*3 (cat×diff)
                            + num_categories*4 (cat×pressure)
    """
    base_features = 1 + 2 + 3 + 4 + num_categories  # 10 + num_categories
    if use_interactions:
        interaction_features = num_categories * 3 + num_categories * 4  # cat×diff + cat×pressure
        return base_features + interaction_features
    return base_features


def extract_features(
    motivation: float,
    duration: float,
    difficulty: int,
    delta_hours: float,
    category: str,
    categories: Sequence[str],
    max_duration: float = 120.0,
    use_interactions: bool = False,
) -> np.ndarray:
    """Assemble all feature components into a single numpy vector.

    Parameters
    ----------
    motivation : float
        User's motivation rating (1–5).
    duration : float
        Duration of the task (same units as max_duration).
    difficulty : int
        Difficulty rating (1–5).
    delta_hours : float
        Hours remaining until the task's deadline.
    category : str
        The task category.
    categories : Sequence[str]
        The list of valid categories for one-hot encoding.
    max_duration : float, optional
        The maximum duration used for normalising the duration feature.
        Default is 120.0 minutes.
    use_interactions : bool, optional
        Whether to include category×difficulty and category×pressure
        interaction features. This enables the model to learn
        category-specific exceptions (e.g., "work is bad except for
        hard+urgent tasks"). Default is False.

    Returns
    -------
    numpy.ndarray
        A 1D array representing the complete feature vector for the task.
        Length is 10 + len(categories) without interactions, or
        10 + len(categories) + 7*len(categories) with interactions.
    """
    features = []
    # Motivation (1 feature)
    features.extend(extract_motivation_feature(motivation))
    # Duration as shortness and longness (2 features)
    features.extend(extract_duration_features(duration, max_duration))
    # Difficulty one-hot (3 features)
    features.extend(extract_difficulty_features(difficulty))
    # Pressure one-hot (4 features)
    features.extend(extract_pressure_features(delta_hours))
    # Category one-hot (len(categories) features)
    features.extend(extract_category_features(category, categories))

    # Optional interaction features for category-specific learning
    if use_interactions:
        # Category × Difficulty interactions (len(categories) * 3 features)
        features.extend(
            extract_category_difficulty_interactions(category, difficulty, categories)
        )
        # Category × Pressure interactions (len(categories) * 4 features)
        features.extend(
            extract_category_pressure_interactions(category, delta_hours, categories)
        )

    return np.array(features, dtype=float)


@dataclass
class MultiFeatureLinUCB:
    """LinUCB model for multiple features with configurable dimensions.

    This class implements the core LinUCB algorithm for a feature vector
    of arbitrary length.  The model maintains a covariance matrix
    ``A``, a reward-weighted feature accumulator ``b`` and computes
    ``theta`` from their inverse.  Predictions are made via the
    usual formula and categorised using supplied thresholds.

    Parameters
    ----------
    n_features : int
        The length of the feature vector.  This must equal the total
        number of features produced by ``extract_features``.
    alpha : float, optional
        Exploration parameter controlling the magnitude of the UCB bonus.
        Defaults to 0.1.
    thresholds : Sequence[float], optional
        A non-increasing sequence of threshold values in [0, 1] used to
        map the score to one of five ordinal categories.  If None,
        defaults to [0.85, 0.65, 0.45, 0.25].  The mapping is:

          score >= thresholds[0] → category 1
          score >= thresholds[1] → category 2
          score >= thresholds[2] → category 3
          score >= thresholds[3] → category 4
          else → category 5
    init_theta : Sequence[float], optional
        An optional initial guess for the weight vector ``theta``.  Must
        have length n_features.  If not supplied, the model starts with
        theta = 0.
    categories : Sequence[str], optional
        The list of task category names used for feature encoding.
        Saved for reference to identify which category index corresponds
        to which category name. Default is None.
    """

    n_features: int
    alpha: float = 0.1
    thresholds: Sequence[float] = field(
        default_factory=lambda: [0.85, 0.65, 0.45, 0.25]
    )
    init_theta: Sequence[float] = None
    categories: Sequence[str] = None
    # Strength of the Bayesian prior encoded by init_theta.
    # If > 0, we initialise A=λI, A_inv=(1/λ)I and b=λ·init_theta so that
    # theta starts at init_theta and decays smoothly as data arrives.
    prior_strength: float = 0.0
    # Scales the magnitude of each incremental update to b.
    # A value in (0,1] reduces abrupt changes; default 1.0 preserves original behaviour.
    learn_rate: float = 1.0
    A: np.ndarray = field(init=False)
    b: np.ndarray = field(init=False)
    theta: np.ndarray = field(init=False)
    A_inv: np.ndarray = field(init=False)

    def __post_init__(self) -> None:
        # Validate thresholds
        if len(self.thresholds) != 4:
            raise ValueError("thresholds must contain exactly four values")
        if sorted(self.thresholds, reverse=True) != list(self.thresholds):
            raise ValueError("thresholds must be in non-increasing order")
        # Initialize matrices
        self.A = np.eye(self.n_features)
        self.A_inv = np.eye(self.n_features)
        # Initialise b and theta
        self.b = np.zeros(self.n_features)
        if self.init_theta is None:
            self.theta = np.zeros(self.n_features)
        else:
            if len(self.init_theta) != self.n_features:
                raise ValueError("init_theta length must match number of features")
            theta0 = np.array(self.init_theta, dtype=float)
            if self.prior_strength > 0.0:
                # Encode prior: A0=λI, b0=λ·theta0, theta=theta0
                lam = float(self.prior_strength)
                self.A = lam * np.eye(self.n_features)
                self.A_inv = (1.0 / lam) * np.eye(self.n_features)
                self.b = lam * theta0
                self.theta = theta0
            else:
                # No prior; keep identity A and zero b
                self.theta = theta0

    def predict_score(self, x: np.ndarray) -> float:
        """Compute the UCB score for a given feature vector.

        Parameters
        ----------
        x : numpy.ndarray
            Feature vector of shape (n_features,).

        Returns
        -------
        float
            The predicted score combining linear estimate and exploration
            bonus.
        """
        if x.shape[0] != self.n_features:
            raise ValueError("Feature vector length does not match model")
        # Mean estimate
        mu = float(np.dot(self.theta, x))
        # Exploration bonus
        # Compute x^T A_inv x efficiently
        # (A_inv is kept up-to-date in update)
        ucb_variance = float(np.dot(x, np.dot(self.A_inv, x)))
        bonus = self.alpha * np.sqrt(max(0.0, ucb_variance))
        return mu + bonus

    def predict_category(self, x: np.ndarray) -> int:
        """Predict the ordinal category (1–5) for a given feature vector.

        Parameters
        ----------
        x : numpy.ndarray
            Feature vector of shape (n_features,).

        Returns
        -------
        int
            Category index in the range [1, 5], where 1 is the best
            performance (completed quickly) and 5 is failure to complete.
        """
        score = self.predict_score(x)
        # Determine category based on thresholds
        for idx, t in enumerate(self.thresholds):
            if score >= t:
                return idx + 1
        return len(self.thresholds) + 1

    def update(self, x: np.ndarray, reward: float) -> None:
        """Update the model with a new observation.

        Parameters
        ----------
        x : numpy.ndarray
            Feature vector of shape (n_features,).
        reward : float
            Observed reward in [0, 1], representing how well the
            user completed the task.
        """
        if x.shape[0] != self.n_features:
            raise ValueError("Feature vector length does not match model")
        # Update A and A_inv using Sherman-Morrison formula to avoid full inversion
        # A ← A + x x^T
        x = x.reshape(-1, 1)  # column vector
        # Compute A_inv update (Sherman-Morrison):
        # A_inv ← A_inv - (A_inv x x^T A_inv) / (1 + x^T A_inv x)
        # Compute denominator safely as scalar, scaling the rank-one update by learn_rate (eta)
        eta = float(self.learn_rate)
        denom_val = np.dot(x.T, np.dot(self.A_inv, x))
        denom = 1.0 + eta * float(denom_val.ravel()[0])
        Ax = np.dot(self.A_inv, x)
        self.A_inv = self.A_inv - (eta * np.dot(Ax, Ax.T) / denom)
        # Update b
        self.b += eta * reward * x.ravel()
        # Update theta
        self.theta = np.dot(self.A_inv, self.b)

    def get_category_feature_index(self, category: str) -> int:
        """Get the feature index for a specific category.

        The category feature index is located after the base features
        (1 motivation + 2 duration + 3 difficulty + 4 pressure = 10).

        Parameters
        ----------
        category : str
            The category name to look up.

        Returns
        -------
        int
            The feature index corresponding to the category, or -1 if
            category is not found or categories are not set.

        Raises
        ------
        ValueError
            If categories have not been set during initialization.
        """
        if self.categories is None:
            raise ValueError("Categories not set during initialization")
        try:
            cat_idx = self.categories.index(category)
            # Feature index = base features (10) + category index
            return 10 + cat_idx
        except ValueError:
            return -1

    def get_category_weight(self, category: str) -> float:
        """Get the learned weight for a specific category.

        This returns the theta value (learned weight) that corresponds
        to the given category feature.

        Parameters
        ----------
        category : str
            The category name to look up.

        Returns
        -------
        float
            The learned weight for this category, or None if category
            is not found or categories are not set.

        Raises
        ------
        ValueError
            If categories have not been set during initialization.
        """
        if self.categories is None:
            raise ValueError("Categories not set during initialization")
        feature_idx = self.get_category_feature_index(category)
        if feature_idx == -1:
            return None
        return float(self.theta[feature_idx])

    def get_category_weights_map(self) -> Dict[str, float]:
        """Get a mapping of all category names to their learned weights.

        Returns
        -------
        Dict[str, float]
            A dictionary mapping each category name to its learned weight
            in theta. Empty dict if categories are not set.

        Example
        -------
        >>> model = MultiFeatureLinUCB(n_features=13, 
        ...                            categories=["work", "study", "health"])
        >>> weights = model.get_category_weights_map()
        >>> print(weights)  # {'work': 0.45, 'study': 0.32, 'health': -0.12}
        """
        if self.categories is None:
            return {}
        return {
            category: self.get_category_weight(category)
            for category in self.categories
        }

    def get_category_info(self, category: str) -> Dict[str, any]:
        """Get comprehensive information about a specific category.

        Parameters
        ----------
        category : str
            The category name to look up.

        Returns
        -------
        Dict[str, any]
            A dictionary containing:
            - 'name': the category name
            - 'feature_index': the index in the feature vector
            - 'weight': the learned weight (theta value)
            - 'found': whether the category exists

        Example
        -------
        >>> info = model.get_category_info("work")
        >>> print(info)
        >>> # {'name': 'work', 'feature_index': 10, 'weight': 0.45, 'found': True}
        """
        if self.categories is None:
            return {"name": category, "found": False, "feature_index": None, "weight": None}
        
        feature_idx = self.get_category_feature_index(category)
        if feature_idx == -1:
            return {"name": category, "found": False, "feature_index": None, "weight": None}
        
        return {
            "name": category,
            "found": True,
            "feature_index": feature_idx,
            "weight": float(self.theta[feature_idx])
        }
