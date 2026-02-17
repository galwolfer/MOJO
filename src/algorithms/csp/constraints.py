# CSP constraints: hard and soft constraint helpers used by the scheduler
from datetime import datetime
from typing import List, Optional
import sys


def log_debug(message):
    print(message, file=sys.stderr, flush=True)


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
def satisfies_hard_constraints(*, candidate_slot: dict, existing_assignments: List[dict], busy_blocks_for_day: List[dict], working_window: dict, deadline: Optional[datetime], variable_id: Optional[str] = None) -> bool:
    if not within_working_hours(candidate_slot, working_window):
        return False

    if not respects_deadline(candidate_slot, deadline):
        return False

    if not respects_busy_blocks(candidate_slot, busy_blocks_for_day):
        return False

    # STRICT ORDERING CONSTRAINT: For chunks, ensure ALL previous chunks are assigned 
    # AND this chunk starts after the last previous chunk ends
    if variable_id and "_chunk_" in variable_id:
        parts = variable_id.split("_chunk_")
        if len(parts) == 2:
            task_id = parts[0]
            try:
                chunk_num = int(parts[1])
            except:
                chunk_num = 0
            
            # For chunk N, ALL previous chunks (0 to N-1) MUST be assigned
            # AND this chunk must start after the previous chunk ends
            for prev_chunk_num in range(chunk_num):
                prev_chunk_id = f"{task_id}_chunk_{prev_chunk_num}"
                prev_assignment = next((a for a in existing_assignments if a.get("variableId") == prev_chunk_id), None)
                
                # HARD CONSTRAINT: Previous chunk MUST be assigned (no gaps in sequence)
                if prev_assignment is None:
                    return False
                
                # HARD CONSTRAINT: This chunk MUST start after previous chunk ends
                # This ensures strict chronological ordering: chunk_0 date < chunk_1 date < chunk_2 date
                prev_end = prev_assignment["end"]
                curr_start = candidate_slot["start"]
                if prev_end > curr_start:
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
def compute_soft_score(*, candidate_slot: dict, task_id, existing_assignments: List[dict], daily_cap_minutes: int = 240, chunk_index: int = 0, reference_date = None) -> int:
    date_key = candidate_slot["start"].date().isoformat()

    minutes_on_day = candidate_slot.get("minutes", 0)
    same_task_on_day = 0
    total_sessions_on_day = 0
    latest_same_task_end = None

    for assignment in existing_assignments:
        if assignment["start"].date().isoformat() == date_key:
            minutes_on_day += assignment.get("minutes", 0)
            total_sessions_on_day += 1
            if str(assignment.get("taskId")) == str(task_id):
                same_task_on_day += 1
                # Track the latest end time of same-task sessions on this day
                if latest_same_task_end is None or assignment["end"] > latest_same_task_end:
                    latest_same_task_end = assignment["end"]

    # ── DAY LOAD PENALTY (dominant) ──────────────────────────────────
    # Strongly penalize adding more sessions to an already-loaded day.
    # Grows quadratically so each additional session on the same day
    # becomes increasingly expensive — regardless of which task.
    day_load_penalty = total_sessions_on_day * total_sessions_on_day * 500

    # ── SAME-TASK CLUSTERING PENALTY ─────────────────────────────────
    # Extra penalty for putting multiple parts of the SAME task on the
    # same day. Stacks on top of the day-load penalty.
    cluster_penalty = same_task_on_day * same_task_on_day * 300

    # ── GROUPING PENALTY (anti-interleaving) ─────────────────────────
    # When a task already has sessions on this day, strongly prefer the
    # slot closest to the last same-task session. This prevents other
    # tasks from being interleaved between parts of the same task.
    # Without this, Part 2 at 12:10 and Part 3 at 14:00 with another
    # task wedged at 13:20 creates confusing visual overlaps in the UI.
    grouping_penalty = 0
    if latest_same_task_end is not None:
        gap_minutes = (candidate_slot["start"] - latest_same_task_end).total_seconds() / 60
        # Penalty grows with the gap — a 10-min gap is fine (score 0),
        # but a 60-min gap means something got interleaved (score 2500)
        excess_gap = max(0, gap_minutes - 15)  # 15 min grace for mandatory gap
        grouping_penalty = int(excess_gap * 50)

    # ── DAILY CAP PENALTY ────────────────────────────────────────────
    cap_penalty = daily_cap_penalty(minutes_on_day, daily_cap_minutes) * 10

    # ── MILD EARLINESS PREFERENCE ────────────────────────────────────
    # Small nudge toward earlier dates so the scheduler doesn't push
    # everything to the last possible day. Deliberately weak so it never
    # overrides the spreading penalties above.
    earliness_penalty = 0
    if reference_date is not None:
        days_from_ref = (candidate_slot["start"].date() - reference_date).days
        earliness_penalty = max(0, days_from_ref) * 5

    return day_load_penalty + cluster_penalty + grouping_penalty + cap_penalty + earliness_penalty
