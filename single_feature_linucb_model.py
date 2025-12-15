"""
Single Feature LinUCB Model
===========================

This module implements a minimal version of the LinUCB algorithm for a
contextual bandit with a single feature. The feature represents a
user's motivation level for a specific task category (integer values
from 1 to 5). Higher motivation should increase the probability the
user will complete the task quickly. The model learns a single weight
``theta`` that scales this (normalized) feature and applies an upper
confidence bound (UCB) bonus to encourage exploration. The resulting
score is mapped into one of five ordinal categories indicating how
quickly the user is likely to complete a new task:

    1   completed very quickly
    2   completed on time
    3   slightly late
    4   significantly late
    5   did not complete

The class provided here allows users to update the model with a new
observation (feature value and reward) and to predict the completion
category for subsequent tasks. This implementation is deliberately
simple to act as a baseline or MVP for a larger system. Future versions
could extend it to multiple features and use a full matrix inversion
for the confidence term.

Example Usage
-------------

    >>> model = SingleFeatureLinUCB(alpha=0.1)
    >>> motivation_level = 5  # int between 1 and 5 (5 means highly motivated)
    >>> category = model.predict_category(motivation_level)
    >>> # Assume the user completed the task quickly (reward 1.0)
    >>> model.update(motivation_level, reward=1.0)

The model can be called repeatedly with new observations to refine its
prediction accuracy. The thresholds used to map a continuous UCB score
to categories can be adjusted through the ``thresholds`` attribute.
"""

from dataclasses import dataclass, field
from typing import List


@dataclass
class SingleFeatureLinUCB:
    """A minimal LinUCB model with one feature and a single weight.

    Parameters
    ----------
    alpha : float, optional
        Exploration parameter controlling the magnitude of the UCB
        bonus. Larger values encourage more exploration by increasing
        the confidence interval. Defaults to 0.1.
    theta : float, optional
        Initial estimate for the weight multiplying the feature. This
        value is updated over time as the model observes rewards.
        Defaults to 0.5.
    A : float, optional
        Initial value for the feature covariance matrix. In the
        single-feature case this is a scalar (1x1 matrix). Setting
        ``A`` greater than one can be used to inject a weak prior. The
        default is 1.0.
    thresholds : List[float], optional
        A list of four descending threshold values used to map the
        continuous UCB score into one of five ordinal categories.
        Defaults to [0.85, 0.65, 0.45, 0.25].

    Notes
    -----
        - The model expects feature values ``x`` as integers between 1 and 5,
            representing the user's motivation level for a given category. The
            implementation normalizes this to [0, 1] internally so that higher
            motivation produces higher predicted scores.
    - Rewards should also lie between 0 and 1, where higher rewards
      represent faster completion.
    - This implementation keeps ``A`` and ``b`` as scalars since only
      one feature is used; it recalculates the inverse of ``A`` at
      every update (trivial in this case).
    - The mapping from score to category uses the following rule:

      ``score >= thresholds[0] -> category 1``
      ``score >= thresholds[1] -> category 2``
      ``score >= thresholds[2] -> category 3``
      ``score >= thresholds[3] -> category 4``
      ``else -> category 5``
    """

    alpha: float = 0.1
    theta: float = 0.5
    A: float = 1.0
    thresholds: List[float] = field(default_factory=lambda: [0.85, 0.65, 0.45, 0.25])
    b: float = 0.0

    def __post_init__(self) -> None:
        # Initialize the inverse of A (since A is scalar, A_inv is simply 1/A)
        if self.A <= 0:
            raise ValueError("A must be positive for a valid covariance matrix.")
        self.A_inv: float = 1.0 / self.A

    def predict_score(self, x: float) -> float:
        """Compute the UCB score for a given motivation level.

        Parameters
        ----------
        x : float
            The motivation level as an integer between 1 and 5. Internally
            this is normalized to the range [0, 1] where 1 -> 0.0 and 5 -> 1.0.

        Returns
        -------
        float
            The UCB score combining the current weight estimate and
            exploration bonus. Higher motivation produces higher scores.
        """
        # Validate and normalize motivation level (1..5 -> 0..1)
        try:
            mot = float(x)
        except Exception:
            raise ValueError("Motivation level must be a number between 1 and 5.")
        if not (1.0 <= mot <= 5.0):
            raise ValueError("Motivation level must be between 1 and 5.")
        norm_x = (mot - 1.0) / 4.0

        # Compute the mean reward estimate using the normalized feature
        mean_reward = self.theta * norm_x
        # Exploration bonus scales with the normalized feature magnitude
        exploration_bonus = self.alpha * norm_x * (self.A_inv ** 0.5)
        return mean_reward + exploration_bonus

    def predict_category(self, x: float) -> int:
        """Predict an ordinal completion category for a given feature value.

        The categories are numbered 1–5, where 1 represents
        "completed very quickly" and 5 represents "not completed at all".

        Parameters
        ----------
        x : float
            The motivation level as an integer between 1 and 5.

        Returns
        -------
        int
            An integer in the range [1, 5] representing the predicted
            completion category.
        """
        score = self.predict_score(x)
        # Determine the category based on the thresholds
        for idx, threshold in enumerate(self.thresholds):
            if score >= threshold:
                return idx + 1
        # If no threshold is met, return the last category
        return len(self.thresholds) + 1

    def update(self, x: float, reward: float) -> None:
        """Update the model parameters with a new observation.

        Parameters
        ----------
        x : float
            The motivation level used for the prediction (1..5). Internally
            this is normalized to [0,1] before updating the model.
        reward : float
            The observed reward in the range [0, 1], where higher values
            represent faster completion.

        Notes
        -----
        This method uses the standard LinUCB update rule for the linear
        weight estimate. Because the feature vector has dimension 1, the
        covariance matrix ``A`` is updated by adding ``(norm_x)**2``, and
        the vector ``b`` is updated by adding ``reward * norm_x``. The
        new weight ``theta`` is computed as ``b / A``.
        """
        # Validate and normalize motivation level (1..5 -> 0..1)
        try:
            mot = float(x)
        except Exception:
            raise ValueError("Motivation level must be a number between 1 and 5.")
        if not (1.0 <= mot <= 5.0):
            raise ValueError("Motivation level must be between 1 and 5.")
        norm_x = (mot - 1.0) / 4.0

        # Update A (scalar) and its inverse using normalized feature
        self.A += norm_x ** 2
        self.A_inv = 1.0 / self.A
        # Update b (scalar)
        self.b += reward * norm_x
        # Compute theta: for 1D case, theta = b / A
        self.theta = self.A_inv * self.b

    def set_thresholds(self, thresholds: List[float]) -> None:
        """Update the threshold values used to map scores to categories.

        Parameters
        ----------
        thresholds : List[float]
            A list of four ascending values between 0 and 1.

        Raises
        ------
        ValueError
            If the provided thresholds are not strictly descending or
            not of length four.
        """
        if len(thresholds) != 4:
            raise ValueError("Thresholds must be a list of four values.")
        if sorted(thresholds, reverse=True) != thresholds:
            raise ValueError("Thresholds must be in descending order.")
        self.thresholds = thresholds.copy()

    def reset(self) -> None:
        """Reset the model to its initial state.

        This sets ``A`` back to its initial value, clears ``b`` and
        recalculates ``theta``. Useful for testing or starting a new
        user profile.
        """
        initial_A = 1.0
        self.A = initial_A
        self.A_inv = 1.0 / initial_A
        self.b = 0.0
        self.theta = 0.5
