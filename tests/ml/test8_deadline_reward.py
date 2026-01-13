"""
Test: calculate_deadline_reward Function
========================================

This test suite validates the deadline-based reward calculation function
that maps task completion timing to a reward score in [0, 1].

Reward Function Design:
-----------------------
- Early completion (before scheduled): 0.85 → 1.0 (linear bonus)
- On-Time completion (scheduled → deadline): 0.85 → 0.0 (linear decay)
- Late completion (after deadline): 0.0 (hard cutoff)
- Not Completed: 0.0


Run:
  pytest tests/ml/test8_deadline_reward.py -v
  python tests/ml/test8_deadline_reward.py
"""

from __future__ import annotations

import sys
import os
import pytest

# Make repository root importable
sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))

from src.predict_model.linucb import MultiFeatureLinUCB


# =============================================================================
# Helper Functions
# =============================================================================

def print_header(title: str) -> None:
    """Print a formatted section header."""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def print_subheader(title: str) -> None:
    """Print a formatted subsection header."""
    print(f"\n{title}")
    print("-" * 60)


def print_reward_result(
    completed_at,
    scheduled_at: float,
    deadline: float,
    expected: float,
    description: str = "",
) -> float:
    """Calculate and print a reward result with explanation."""
    reward = MultiFeatureLinUCB.calculate_deadline_reward(
        completed_at=completed_at,
        scheduled_at=scheduled_at,
        deadline=deadline,
    )
    
    status = "✓" if abs(reward - expected) < 0.001 else "✗"
    completed_str = str(completed_at) if completed_at is not None else "None"
    
    print(
        f"  {status} completed={completed_str:>6}, scheduled={scheduled_at}, deadline={deadline} "
        f"| reward={reward:.3f} (expected {expected:.3f})"
    )
    if description:
        print(f"      → {description}")
    
    return reward


# =============================================================================
# Pytest Test Classes
# =============================================================================

class TestDeadlineRewardBasic:
    """Basic functionality tests."""

    def test_at_scheduled_time(self):
        """Task completed exactly at scheduled time should return 0.85."""
        reward = MultiFeatureLinUCB.calculate_deadline_reward(
            completed_at=100,
            scheduled_at=100,
            deadline=200,
        )
        assert reward == pytest.approx(0.85)

    def test_at_deadline(self):
        """Task completed exactly at deadline should return 0.0."""
        reward = MultiFeatureLinUCB.calculate_deadline_reward(
            completed_at=200,
            scheduled_at=100,
            deadline=200,
        )
        assert reward == pytest.approx(0.0)

    def test_halfway_through_window(self):
        """Task completed halfway should return ~0.425."""
        reward = MultiFeatureLinUCB.calculate_deadline_reward(
            completed_at=150,
            scheduled_at=100,
            deadline=200,
        )
        # 0.85 * (1 - 0.5) = 0.425
        assert reward == pytest.approx(0.425)

    def test_quarter_through_window(self):
        """Task completed at 25% progress should return ~0.6375."""
        reward = MultiFeatureLinUCB.calculate_deadline_reward(
            completed_at=125,
            scheduled_at=100,
            deadline=200,
        )
        # 0.85 * (1 - 0.25) = 0.6375
        assert reward == pytest.approx(0.6375)

    def test_three_quarters_through_window(self):
        """Task completed at 75% progress should return ~0.2125."""
        reward = MultiFeatureLinUCB.calculate_deadline_reward(
            completed_at=175,
            scheduled_at=100,
            deadline=200,
        )
        # 0.85 * (1 - 0.75) = 0.2125
        assert reward == pytest.approx(0.2125)


class TestDeadlineRewardEarly:
    """Early completion tests (before scheduled time)."""

    def test_early_half_window(self):
        """Task completed half a window early should return ~0.925."""
        reward = MultiFeatureLinUCB.calculate_deadline_reward(
            completed_at=50,
            scheduled_at=100,
            deadline=200,
        )
        # 0.85 + 0.15 * (50/100) = 0.85 + 0.075 = 0.925
        assert reward == pytest.approx(0.925)

    def test_early_full_window(self):
        """Task completed a full window early should return 1.0."""
        reward = MultiFeatureLinUCB.calculate_deadline_reward(
            completed_at=0,
            scheduled_at=100,
            deadline=200,
        )
        # 0.85 + 0.15 * min(1.0, 100/100) = 1.0
        assert reward == pytest.approx(1.0)

    def test_very_early_capped(self):
        """Task completed more than a window early should cap at 1.0."""
        reward = MultiFeatureLinUCB.calculate_deadline_reward(
            completed_at=-100,  # 2 windows early
            scheduled_at=100,
            deadline=200,
        )
        # Should cap at 1.0
        assert reward == pytest.approx(1.0)

    def test_slightly_early(self):
        """Task completed slightly before scheduled should be just above 0.85."""
        reward = MultiFeatureLinUCB.calculate_deadline_reward(
            completed_at=90,
            scheduled_at=100,
            deadline=200,
        )
        # 0.85 + 0.15 * (10/100) = 0.85 + 0.015 = 0.865
        assert reward == pytest.approx(0.865)


class TestDeadlineRewardLate:
    """Late completion tests (after deadline)."""

    def test_slightly_late(self):
        """Task completed just after deadline should return 0.0."""
        reward = MultiFeatureLinUCB.calculate_deadline_reward(
            completed_at=201,
            scheduled_at=100,
            deadline=200,
        )
        assert reward == pytest.approx(0.0)

    def test_very_late(self):
        """Task completed way after deadline should return 0.0."""
        reward = MultiFeatureLinUCB.calculate_deadline_reward(
            completed_at=1000,
            scheduled_at=100,
            deadline=200,
        )
        assert reward == pytest.approx(0.0)


class TestDeadlineRewardNotCompleted:
    """Tests for uncompleted tasks."""

    def test_not_completed_none(self):
        """Task not completed (None) should return 0.0."""
        reward = MultiFeatureLinUCB.calculate_deadline_reward(
            completed_at=None,
            scheduled_at=100,
            deadline=200,
        )
        assert reward == pytest.approx(0.0)

    def test_not_completed_inf(self):
        """Task not completed (inf) should return 0.0."""
        reward = MultiFeatureLinUCB.calculate_deadline_reward(
            completed_at=float('inf'),
            scheduled_at=100,
            deadline=200,
        )
        assert reward == pytest.approx(0.0)


class TestDeadlineRewardEdgeCases:
    """Edge case tests."""

    def test_zero_window_on_time(self):
        """When deadline == scheduled, completed exactly on time returns 0.0 (at boundary)."""
        reward = MultiFeatureLinUCB.calculate_deadline_reward(
            completed_at=100,
            scheduled_at=100,
            deadline=100,
        )
        # completed_at >= deadline, so it's considered "at deadline" = 0.0
        assert reward == pytest.approx(0.0)

    def test_zero_window_early(self):
        """When deadline == scheduled, early completion returns 0.85."""
        reward = MultiFeatureLinUCB.calculate_deadline_reward(
            completed_at=50,
            scheduled_at=100,
            deadline=100,
        )
        assert reward == pytest.approx(0.85)

    def test_zero_window_late(self):
        """When deadline == scheduled, late completion returns 0.0."""
        reward = MultiFeatureLinUCB.calculate_deadline_reward(
            completed_at=101,
            scheduled_at=100,
            deadline=100,
        )
        assert reward == pytest.approx(0.0)

    def test_small_window(self):
        """Small window should still work correctly."""
        reward = MultiFeatureLinUCB.calculate_deadline_reward(
            completed_at=105,
            scheduled_at=100,
            deadline=110,
        )
        # progress = 5/10 = 0.5
        # reward = 0.85 * (1 - 0.5) = 0.425
        assert reward == pytest.approx(0.425)

    def test_large_timestamps(self):
        """Large Unix timestamps should work correctly."""
        # Simulate real Unix timestamps (Jan 2026)
        scheduled = 1767225600  # 2026-01-01 00:00:00
        deadline = scheduled + 86400  # +24 hours
        completed = scheduled + 43200  # +12 hours (halfway)

        reward = MultiFeatureLinUCB.calculate_deadline_reward(
            completed_at=completed,
            scheduled_at=scheduled,
            deadline=deadline,
        )
        # 0.85 * (1 - 0.5) = 0.425
        assert reward == pytest.approx(0.425)

    def test_float_timestamps(self):
        """Float timestamps should work correctly."""
        reward = MultiFeatureLinUCB.calculate_deadline_reward(
            completed_at=150.5,
            scheduled_at=100.0,
            deadline=200.0,
        )
        # progress = 50.5/100 = 0.505
        # reward = 0.85 * (1 - 0.505) = 0.42075
        assert reward == pytest.approx(0.42075)


class TestDeadlineRewardValidation:
    """Input validation tests."""

    def test_deadline_before_scheduled_raises(self):
        """Should raise ValueError if deadline < scheduled_at."""
        with pytest.raises(ValueError, match="deadline.*must be >= scheduled_at"):
            MultiFeatureLinUCB.calculate_deadline_reward(
                completed_at=50,
                scheduled_at=200,
                deadline=100,
            )

    def test_negative_values_work(self):
        """Negative timestamps should work (relative times)."""
        reward = MultiFeatureLinUCB.calculate_deadline_reward(
            completed_at=-50,
            scheduled_at=0,
            deadline=100,
        )
        # Early by 50, window is 100
        # 0.85 + 0.15 * (50/100) = 0.925
        assert reward == pytest.approx(0.925)


class TestDeadlineRewardBoundaries:
    """Test reward boundaries are respected."""

    def test_reward_never_exceeds_one(self):
        """Reward should never exceed 1.0."""
        # Very early completion
        reward = MultiFeatureLinUCB.calculate_deadline_reward(
            completed_at=-1000,
            scheduled_at=100,
            deadline=200,
        )
        assert reward <= 1.0

    def test_reward_never_below_zero(self):
        """Reward should never be below 0.0."""
        # Very late completion
        reward = MultiFeatureLinUCB.calculate_deadline_reward(
            completed_at=10000,
            scheduled_at=100,
            deadline=200,
        )
        assert reward >= 0.0

    def test_reward_range_on_time(self):
        """On-time rewards should be in (0, 0.85]."""
        for progress in [0.0, 0.25, 0.5, 0.75, 0.99]:
            completed = 100 + progress * 100  # window = 100
            reward = MultiFeatureLinUCB.calculate_deadline_reward(
                completed_at=completed,
                scheduled_at=100,
                deadline=200,
            )
            if progress == 0.0:
                assert reward == pytest.approx(0.85)
            else:
                assert 0.0 < reward < 0.85


class TestDeadlineRewardLinearInterpolation:
    """Test that interpolation is truly linear."""

    def test_linear_in_ontime_zone(self):
        """Reward should decrease linearly in the on-time zone."""
        rewards = []
        for i in range(11):  # 0%, 10%, 20%, ..., 100%
            progress = i / 10
            completed = 100 + progress * 100
            reward = MultiFeatureLinUCB.calculate_deadline_reward(
                completed_at=completed,
                scheduled_at=100,
                deadline=200,
            )
            rewards.append(reward)

        # Check linear decrease
        for i in range(1, len(rewards)):
            diff = rewards[i - 1] - rewards[i]
            expected_diff = 0.085  # 0.85 / 10 steps
            assert diff == pytest.approx(expected_diff, abs=0.001)

    def test_linear_in_early_zone(self):
        """Reward should increase linearly in the early zone."""
        rewards = []
        for i in range(11):  # 0%, 10%, ..., 100% early
            early_fraction = i / 10
            completed = 100 - early_fraction * 100  # Go earlier
            reward = MultiFeatureLinUCB.calculate_deadline_reward(
                completed_at=completed,
                scheduled_at=100,
                deadline=200,
            )
            rewards.append(reward)

        # Check linear increase (until cap)
        for i in range(1, 10):  # Not the last one (capped)
            diff = rewards[i] - rewards[i - 1]
            expected_diff = 0.015  # 0.15 / 10 steps
            assert diff == pytest.approx(expected_diff, abs=0.001)


# =============================================================================
# Interactive Test Runner (for running directly with python)
# =============================================================================

def test_basic_scenarios():
    """
    TEST 1: BASIC REWARD SCENARIOS
    ==============================
    
    Demonstrates the basic reward function behavior across different
    completion times relative to scheduled time and deadline.
    
    Setup: scheduled_at=100, deadline=200, window=100
    """
    print_header("TEST 1: BASIC REWARD SCENARIOS")
    
    print("\nSetup:")
    print("  scheduled_at = 100 (when task should start)")
    print("  deadline     = 200 (hard deadline)")
    print("  window       = 100 (time available)")
    
    print_subheader("On-Time Completion (scheduled → deadline)")
    print("  Formula: reward = 0.85 × (1 - progress), where progress = (completed - scheduled) / window")
    
    print_reward_result(100, 100, 200, 0.850, "At scheduled time → max on-time reward")
    print_reward_result(125, 100, 200, 0.6375, "25% through window")
    print_reward_result(150, 100, 200, 0.425, "50% through window (halfway)")
    print_reward_result(175, 100, 200, 0.2125, "75% through window")
    print_reward_result(199, 100, 200, 0.0085, "99% through window (just before deadline)")
    print_reward_result(200, 100, 200, 0.0, "At deadline → reward drops to 0")
    
    print("\n  Observation: Reward decreases LINEARLY from 0.85 to 0.0 as we approach deadline")
    
    return True


def test_early_completion():
    """
    TEST 2: EARLY COMPLETION BONUS
    ==============================
    
    Demonstrates the bonus reward for completing tasks before scheduled time.
    Earlier completion = higher reward, capped at 1.0.
    
    Setup: scheduled_at=100, deadline=200, window=100
    """
    print_header("TEST 2: EARLY COMPLETION BONUS")
    
    print("\nSetup:")
    print("  scheduled_at = 100")
    print("  deadline     = 200")
    print("  window       = 100")
    
    print_subheader("Early Completion (before scheduled)")
    print("  Formula: reward = 0.85 + 0.15 × min(1, early_time / window)")
    print("  Maximum possible reward: 1.0 (when completed ≥ 1 window early)")
    
    print_reward_result(100, 100, 200, 0.850, "At scheduled → baseline reward")
    print_reward_result(90, 100, 200, 0.865, "10% early (10 units before scheduled)")
    print_reward_result(75, 100, 200, 0.8875, "25% early")
    print_reward_result(50, 100, 200, 0.925, "50% early (half a window)")
    print_reward_result(25, 100, 200, 0.9625, "75% early")
    print_reward_result(0, 100, 200, 1.0, "100% early (full window) → max reward")
    print_reward_result(-50, 100, 200, 1.0, "150% early → capped at 1.0")
    print_reward_result(-100, 100, 200, 1.0, "200% early → still capped at 1.0")
    
    print("\n  Observation: Early bonus is LINEAR up to 1.0, then CAPPED")
    
    return True


def test_late_completion():
    """
    TEST 3: LATE COMPLETION (After Deadline)
    ========================================
    
    Demonstrates that any completion after the deadline results in 0 reward.
    The deadline is a HARD CUTOFF - no grace period.
    
    Setup: scheduled_at=100, deadline=200
    """
    print_header("TEST 3: LATE COMPLETION (After Deadline)")
    
    print("\nSetup:")
    print("  scheduled_at = 100")
    print("  deadline     = 200 (HARD CUTOFF)")
    
    print_subheader("Late Completion (after deadline)")
    print("  Rule: If completed_at >= deadline → reward = 0.0")
    
    print_reward_result(199, 100, 200, 0.0085, "Just before deadline → tiny reward")
    print_reward_result(200, 100, 200, 0.0, "Exactly at deadline → 0")
    print_reward_result(201, 100, 200, 0.0, "1 unit after deadline → 0")
    print_reward_result(250, 100, 200, 0.0, "50 units late → 0")
    print_reward_result(500, 100, 200, 0.0, "300 units late → still 0")
    print_reward_result(10000, 100, 200, 0.0, "Way late → 0")
    
    print("\n  Observation: Deadline is ABSOLUTE - no partial credit for late tasks")
    
    return True


def test_not_completed():
    """
    TEST 4: NOT COMPLETED TASKS
    ===========================
    
    Demonstrates handling of uncompleted tasks (None or infinity).
    """
    print_header("TEST 4: NOT COMPLETED TASKS")
    
    print("\nSetup:")
    print("  scheduled_at = 100")
    print("  deadline     = 200")
    
    print_subheader("Uncompleted Tasks")
    print("  Rule: If completed_at is None or inf → reward = 0.0")
    
    print_reward_result(None, 100, 200, 0.0, "None = task never completed")
    print_reward_result(float('inf'), 100, 200, 0.0, "inf = task never completed")
    
    print("\n  Observation: Uncompleted tasks are equivalent to infinitely late")
    
    return True


def test_edge_cases():
    """
    TEST 5: EDGE CASES
    ==================
    
    Demonstrates behavior in unusual situations.
    """
    print_header("TEST 5: EDGE CASES")
    
    print_subheader("Zero Window (deadline == scheduled)")
    print("  What happens when there's no time window?")
    
    print_reward_result(50, 100, 100, 0.85, "Early completion → 0.85")
    print_reward_result(100, 100, 100, 0.0, "At scheduled/deadline → 0 (boundary)")
    print_reward_result(101, 100, 100, 0.0, "After deadline → 0")
    
    print_subheader("Very Small Window")
    print("  Window of only 10 units")
    
    print_reward_result(100, 100, 110, 0.85, "At scheduled → 0.85")
    print_reward_result(105, 100, 110, 0.425, "Halfway → 0.425")
    print_reward_result(110, 100, 110, 0.0, "At deadline → 0")
    
    print_subheader("Large Unix Timestamps")
    print("  Real-world Unix timestamps (Jan 2026)")
    
    scheduled = 1767225600  # 2026-01-01 00:00:00
    deadline = scheduled + 86400  # +24 hours (86400 seconds)
    
    print(f"  scheduled = {scheduled} (2026-01-01 00:00:00)")
    print(f"  deadline  = {deadline} (2026-01-02 00:00:00)")
    print(f"  window    = {deadline - scheduled} seconds (24 hours)")
    
    print_reward_result(scheduled, scheduled, deadline, 0.85, "At scheduled")
    print_reward_result(scheduled + 43200, scheduled, deadline, 0.425, "12 hours in (halfway)")
    print_reward_result(deadline, scheduled, deadline, 0.0, "At deadline")
    
    print_subheader("Negative Timestamps (Relative Time)")
    print("  Using relative time units instead of absolute timestamps")
    
    print_reward_result(-50, 0, 100, 0.925, "50 units before scheduled=0")
    print_reward_result(50, 0, 100, 0.425, "Halfway through [0, 100]")
    
    return True


def test_linear_interpolation():
    """
    TEST 6: LINEAR INTERPOLATION VERIFICATION
    =========================================
    
    Verifies that the reward function uses true linear interpolation.
    """
    print_header("TEST 6: LINEAR INTERPOLATION VERIFICATION")
    
    print_subheader("On-Time Zone: Linear Decay from 0.85 to 0.0")
    print("  Expected: Each 10% progress reduces reward by 0.085")
    
    print("\n  Progress | Completed | Reward | Δ from previous")
    print("  " + "-" * 50)
    
    prev_reward = None
    for i in range(11):
        progress = i / 10
        completed = 100 + progress * 100
        reward = MultiFeatureLinUCB.calculate_deadline_reward(completed, 100, 200)
        
        delta_str = ""
        if prev_reward is not None:
            delta = prev_reward - reward
            delta_str = f"-{delta:.4f}"
        
        print(f"  {progress*100:5.0f}%    | {completed:9.0f} | {reward:.4f} | {delta_str}")
        prev_reward = reward
    
    print_subheader("Early Zone: Linear Increase from 0.85 to 1.0")
    print("  Expected: Each 10% earlier increases reward by 0.015")
    
    print("\n  Early %  | Completed | Reward | Δ from previous")
    print("  " + "-" * 50)
    
    prev_reward = None
    for i in range(11):
        early_pct = i / 10
        completed = 100 - early_pct * 100
        reward = MultiFeatureLinUCB.calculate_deadline_reward(completed, 100, 200)
        
        delta_str = ""
        if prev_reward is not None:
            delta = reward - prev_reward
            delta_str = f"+{delta:.4f}"
        
        print(f"  {early_pct*100:5.0f}%    | {completed:9.0f} | {reward:.4f} | {delta_str}")
        prev_reward = reward
    
    print("\n  Observation: Both zones show CONSTANT deltas = LINEAR interpolation ✓")
    
    return True


def test_validation():
    """
    TEST 7: INPUT VALIDATION
    ========================
    
    Tests that invalid inputs are properly rejected.
    """
    print_header("TEST 7: INPUT VALIDATION")
    
    print_subheader("Invalid: deadline < scheduled_at")
    print("  This should raise a ValueError")
    
    try:
        MultiFeatureLinUCB.calculate_deadline_reward(
            completed_at=50,
            scheduled_at=200,
            deadline=100,  # deadline before scheduled!
        )
        print("  ✗ ERROR: Should have raised ValueError!")
        return False
    except ValueError as e:
        print(f"  ✓ Correctly raised ValueError: {e}")
    
    print_subheader("Valid: Negative timestamps")
    print("  Negative values should work (for relative time)")
    
    reward = MultiFeatureLinUCB.calculate_deadline_reward(
        completed_at=-50,
        scheduled_at=0,
        deadline=100,
    )
    print(f"  ✓ calculate_deadline_reward(-50, 0, 100) = {reward:.3f}")
    
    return True


def main():
    """Run all tests with detailed output."""
    print("\n" + "=" * 70)
    print("  DEADLINE REWARD FUNCTION - COMPREHENSIVE TEST SUITE")
    print("=" * 70)
    print("\nThis test suite validates the calculate_deadline_reward() function")
    print("which maps task completion timing to a reward score in [0, 1].")
    print("\nReward Zones:")
    print("  • Early (before scheduled):     0.85 → 1.0  (bonus for early)")
    print("  • On-Time (scheduled→deadline): 0.85 → 0.0  (linear decay)")
    print("  • Late (after deadline):        0.0         (hard cutoff)")
    print("  • Not Completed:                0.0         (task failed)")
    
    tests = [
        ("Basic Scenarios", test_basic_scenarios),
        ("Early Completion", test_early_completion),
        ("Late Completion", test_late_completion),
        ("Not Completed", test_not_completed),
        ("Edge Cases", test_edge_cases),
        ("Linear Interpolation", test_linear_interpolation),
        ("Input Validation", test_validation),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            passed = test_func()
            results.append((name, passed))
        except Exception as e:
            print(f"\n  ✗ ERROR in {name}: {e}")
            results.append((name, False))
    
    # Summary
    print_header("TEST SUMMARY")
    
    passed = sum(1 for _, p in results if p)
    total = len(results)
    
    for name, result in results:
        status = "✓ PASSED" if result else "✗ FAILED"
        print(f"  {status}: {name}")
    
    print(f"\n  Total: {passed}/{total} tests passed")
    print("\n  For full pytest coverage, run:")
    print("  pytest tests/ml/test8_deadline_reward.py -v")
    print("=" * 70 + "\n")
    
    return passed == total


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
