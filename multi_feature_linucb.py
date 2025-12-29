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
        A one-hot encoded list of length len(categories).  If the
        provided category is not in the list, the last element is used
        to represent "other".
    """
    vec = [0.0] * len(categories)
    if not categories:
        return vec
    try:
        idx = categories.index(category)
    except ValueError:
        # unknown category → map to last
        idx = len(categories) - 1
    vec[idx] = 1.0
    return vec


def extract_features(
    motivation: float,
    duration: float,
    difficulty: int,
    delta_hours: float,
    category: str,
    categories: Sequence[str],
    max_duration: float = 120.0,
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

    Returns
    -------
    numpy.ndarray
        A 1D array representing the complete feature vector for the task.
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
    """

    n_features: int
    alpha: float = 0.1
    thresholds: Sequence[float] = field(
        default_factory=lambda: [0.85, 0.65, 0.45, 0.25]
    )
    init_theta: Sequence[float] = None
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
