# CSP constraints: hard and soft constraint helpers used by the scheduler
from datetime import datetime
from typing import List, Optional


# Return True when two time slots do not overlap
def no_overlap(a: dict, b: dict) -> bool:
    return a["end"] <= b["start"] or b["end"] <= a["start"]


# Ensure a session does not conflict with any busy block
def respects_busy_blocks(session: dict, busy_blocks: List[dict]) -> bool:
    for block in busy_blocks:
        if not (session["end"] <= block["start"] or session["start"] >= block["end"]):
            return False
    return True


# Check that a session finishes before the given deadline
def respects_deadline(session: dict, deadline: Optional[datetime]) -> bool:
    if deadline is None:
        return True
    return session["end"] <= deadline


# Check that a session lies entirely inside the working window
def within_working_hours(session: dict, working_window: dict) -> bool:
    return session["start"] >= working_window["start"] and session["end"] <= working_window["end"]


# Penalty for exceeding daily scheduling cap (minutes over cap)
def daily_cap_penalty(scheduled_minutes_on_day: int, cap_minutes: int) -> int:
    if scheduled_minutes_on_day <= cap_minutes:
        return 0
    return scheduled_minutes_on_day - cap_minutes


# Penalty increasing with number of sessions for the same task on a day
def spread_penalty(same_task_sessions_on_day: int) -> int:
    return same_task_sessions_on_day * same_task_sessions_on_day


# Aggregate hard-constraint checks to decide if a candidate slot is valid
def satisfies_hard_constraints(*, candidate_slot: dict, existing_assignments: List[dict], busy_blocks_for_day: List[dict], working_window: dict, deadline: Optional[datetime]) -> bool:
    if not within_working_hours(candidate_slot, working_window):
        return False

    if not respects_deadline(candidate_slot, deadline):
        return False

    if not respects_busy_blocks(candidate_slot, busy_blocks_for_day):
        return False

    # minimum gap between sessions to avoid back-to-back scheduling
    MIN_SESSION_GAP_MINUTES = 10
    from datetime import timedelta

    gap_td = timedelta(minutes=MIN_SESSION_GAP_MINUTES)

    for assignment in existing_assignments:
        overlaps = not no_overlap(candidate_slot, assignment)
        if overlaps:
            return False

        ends_too_close = abs((candidate_slot["start"] - assignment["end"]).total_seconds()) < gap_td.total_seconds()
        starts_too_close = abs((assignment["start"] - candidate_slot["end"]).total_seconds()) < gap_td.total_seconds()
        if ends_too_close or starts_too_close:
            return False

    return True


# Compute a soft score for a candidate slot (lower is better)
def compute_soft_score(*, candidate_slot: dict, task_id, existing_assignments: List[dict], daily_cap_minutes: int = 240) -> int:
    date_key = candidate_slot["start"].date().isoformat()

    minutes_on_day = candidate_slot.get("minutes", 0)
    same_task_on_day = 0
    total_sessions_on_day = 0

    for assignment in existing_assignments:
        if assignment["start"].date().isoformat() == date_key:
            minutes_on_day += assignment.get("minutes", 0)
            total_sessions_on_day += 1
            if str(assignment.get("taskId")) == str(task_id):
                same_task_on_day += 1

    # combine penalties: daily cap, task clustering, and overall day load
    cap_penalty = daily_cap_penalty(minutes_on_day, daily_cap_minutes)
    cluster_penalty = spread_penalty(same_task_on_day)
    day_load_penalty = total_sessions_on_day * total_sessions_on_day * 15

    return cap_penalty * 2 + cluster_penalty * 10 + day_load_penalty
