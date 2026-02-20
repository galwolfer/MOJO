"""CSP scheduler: variable generation, domain building and backtracking search.

Provides `schedule_tasks_csp` as the main entrypoint and helper functions for
variable/domain generation and the backtracking search.
"""
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Tuple, Optional
import random
import json
import os
import sys

from .constraints import satisfies_hard_constraints, compute_soft_score, respects_deadline
from .heuristics import select_variable_mrv, order_values_lcv, forward_check

DEFAULT_WORKING_HOURS = {"startHour": 9, "startMinute": 0, "endHour": 18, "endMinute": 0}
DEFAULT_DAILY_CAP_MINUTES = 240
SLOT_GRANULARITY_MINUTES = 10
MAX_BACKTRACK_ITERATIONS = 10000

def log_debug(msg: str):
    # Debug logging disabled in production - kept as no-op so calls remain safe
    return None


def start_of_day(dt: datetime) -> datetime:
    # Normalize a datetime to midnight of the same day, preserving timezone
    tz = dt.tzinfo if dt.tzinfo else timezone.utc
    return datetime(dt.year, dt.month, dt.day, tzinfo=tz)


def add_days(dt: datetime, days: int) -> datetime:
    # Add a number of whole days to a datetime
    return dt + timedelta(days=days)


def add_minutes(dt: datetime, minutes: int) -> datetime:
    # Add minutes to a datetime
    return dt + timedelta(minutes=minutes)


def parse_datetime(value) -> datetime:
    """Parse a datetime from string or return as-is if already datetime."""
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        # Handle ISO strings with Z suffix (with or without milliseconds)
        if value.endswith('Z'):
            value = value[:-1] + '+00:00'
        
        # Try common formats with strptime (more reliable than fromisoformat for Python 3.9)
        for fmt in [
            "%Y-%m-%dT%H:%M:%S.%f%z",  # 2026-02-22T00:00:00.000+00:00
            "%Y-%m-%dT%H:%M:%S%z",      # 2026-02-22T00:00:00+00:00
            "%Y-%m-%dT%H:%M:%S.%f",     # 2026-02-22T00:00:00.000
            "%Y-%m-%dT%H:%M:%S",        # 2026-02-22T00:00:00
            "%Y-%m-%d"                  # 2026-02-22
        ]:
            try:
                dt = datetime.strptime(value, fmt)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt
            except ValueError:
                continue
        
        # Last resort: try fromisoformat
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            pass
    
    raise ValueError(f"Cannot parse datetime from: {value}")


def normalize_busy_blocks(busy_blocks_by_date: Dict) -> Dict:
    """Convert busy block start/end values from strings to datetime objects."""
    normalized = {}
    for date_key, blocks in busy_blocks_by_date.items():
        normalized_blocks = []
        for block in blocks:
            try:
                normalized_block = {
                    "start": parse_datetime(block["start"]),
                    "end": parse_datetime(block["end"]),
                }
                normalized_blocks.append(normalized_block)
            except (KeyError, ValueError) as e:
                # Skip malformed blocks
                continue
        normalized[date_key] = normalized_blocks
    return normalized


def build_working_window(day: datetime, working_hours: Dict) -> Dict:
    # Build start/end datetimes for the given day according to working hours
    # Preserve timezone from input day
    tz = day.tzinfo if day.tzinfo else timezone.utc
    start = datetime(day.year, day.month, day.day, working_hours.get("startHour", 9), working_hours.get("startMinute", 0), tzinfo=tz)
    end = datetime(day.year, day.month, day.day, working_hours.get("endHour", 18), working_hours.get("endMinute", 0), tzinfo=tz)
    return {"start": start, "end": end}


def schedule_tasks_csp(tasks: List[dict], options: Dict = None) -> Dict:
    log_debug("=== SCHEDULER STARTED ===")
    log_debug(f"Number of tasks: {len(tasks)}")
    
    options = options or {}
    busy_blocks_by_date_raw = options.get("busyBlocksByDate", {})
    # Normalize busy blocks to ensure start/end are datetime objects
    busy_blocks_by_date = normalize_busy_blocks(busy_blocks_by_date_raw)
    working_hours = options.get("workingHours", DEFAULT_WORKING_HOURS)
    planning_horizon_days = options.get("planningHorizonDays", 14)
    daily_cap_minutes = options.get("dailyCapMinutes", DEFAULT_DAILY_CAP_MINUTES)
    gap_minutes = int(options.get("gapMinutes", 10))

    today = start_of_day(datetime.now(timezone.utc))
    horizon_end = add_days(today, planning_horizon_days)
    
    log_debug(f"Today: {today}")
    log_debug(f"Horizon end: {horizon_end}")

    # Controlled randomness: set rng when randomize enabled (for deterministic ties)
    randomize = options.get("randomize", False)
    seed = options.get("seed", None)
    rng: Optional[random.Random] = None
    if randomize:
        rng = random.Random(seed) if seed is not None else random.Random()

    # Distribution strategy affects how leaky tasks are split into chunks
    distribution_strategy = options.get("distributionStrategy", "balanced")
    variables = generate_variables(tasks, horizon_end, rng=rng, distribution_strategy=distribution_strategy)

    if not variables:
        return {"plan": [], "unscheduled": []}

    variable_domains = {}
    variables_with_domains = []
    variables_without_domains = []

    for variable in variables:
        domain = generate_domain(variable, today, horizon_end, busy_blocks_by_date, working_hours)
        if domain:
            variable_domains[variable["id"]] = domain
            variables_with_domains.append(variable)
        else:
            variables_without_domains.append(variable)

    result = backtrack_search(variables_with_domains, variable_domains, busy_blocks_by_date, working_hours, daily_cap_minutes, today, rng, gap_minutes)

    plan = []
    unscheduled = []

    assigned_var_ids = set(a["variableId"] for a in result["assignments"]) if result else set()

    for assignment in result.get("assignments", []):
        slot = assignment["slot"]
        # Extract chunk index from variable ID (e.g., "abc_chunk_2" → 2)
        chunk_index = 0
        var_id = assignment.get("variableId", "")
        if "_chunk_" in var_id:
            try:
                chunk_index = int(var_id.split("_chunk_")[1])
            except:
                chunk_index = 0
        plan.append({
            "taskId": assignment["taskId"],
            "title": assignment.get("title"),
            "date": slot["start"].date().isoformat(),
            "start": slot["start"],
            "end": slot["end"],
            "minutes": slot.get("minutes"),
            "subtaskIndex": chunk_index + 1,  # 1-indexed for Node
        })

    # Sort plan by start time to ensure chronological order
    plan.sort(key=lambda p: p["start"])

    # ── POST-SCHEDULE VALIDATION: reject overlapping sessions ────────
    clean_plan = []
    for entry in plan:
        overlaps = False
        for existing in clean_plan:
            if not (entry["end"] <= existing["start"] or existing["end"] <= entry["start"]):
                log_debug(f"OVERLAP DETECTED — dropping: {entry['title']} {entry['start']}-{entry['end']}")
                overlaps = True
                break
        if not overlaps:
            clean_plan.append(entry)
    plan = clean_plan

    unscheduled_by_task = {}
    for variable in variables_without_domains:
        task_id = str(variable["taskId"])
        if task_id not in unscheduled_by_task:
            unscheduled_by_task[task_id] = {"taskId": variable["taskId"], "title": variable.get("title"), "remainingMinutes": 0}
        unscheduled_by_task[task_id]["remainingMinutes"] += variable["chunkMinutes"]

    for variable in variables_with_domains:
        if variable["id"] not in assigned_var_ids:
            task_id = str(variable["taskId"])
            if task_id not in unscheduled_by_task:
                unscheduled_by_task[task_id] = {"taskId": variable["taskId"], "title": variable.get("title"), "remainingMinutes": 0}
            unscheduled_by_task[task_id]["remainingMinutes"] += variable["chunkMinutes"]

    unscheduled.extend(unscheduled_by_task.values())

    log_debug(f"=== SCHEDULER COMPLETED ===")
    log_debug(f"Total planned: {len(plan)}")
    log_debug(f"Total unscheduled: {len(unscheduled)}")
    
    return {"plan": plan, "unscheduled": unscheduled}


def generate_variables(tasks: List[dict], horizon_end: datetime, rng: Optional[random.Random] = None, distribution_strategy: str = "balanced") -> List[dict]:
    # Convert tasks into chunk variables used by the CSP
    variables = []
    # Use UTC timezone-aware datetime to avoid comparison errors
    now = datetime.now(timezone.utc)

    log_debug(f"\n========== GENERATE_VARIABLES: Processing {len(tasks)} tasks ==========")

    for task in tasks:
        log_debug(f"\nProcessing task: {task.get('taskname')} (ID: {task.get('_id')})")
        log_debug(f"  taskType: {task.get('taskType')}")
        log_debug(f"  estimatedDuration: {task.get('estimatedDuration')} min")
        log_debug(f"  chunkCount: {task.get('chunkCount')}")
        
        total_minutes = task.get("estimatedDuration", 0) or 0
        if total_minutes <= 0:
            log_debug(f"  Skipping task {task.get('taskname')}: no duration")
            continue

        task_type = task.get("taskType") or ("in_parts" if task.get("canSplit") else "perfect")

        deadline = None
        if task.get("dueDate"):
            try:
                # Use parse_datetime helper which handles 'Z' suffix
                deadline = parse_datetime(task["dueDate"]) if isinstance(task["dueDate"], str) else task["dueDate"]
                # normalize to end of day
                deadline = deadline.replace(hour=23, minute=59, second=59, microsecond=999999)

                # Normalize deadline to UTC timezone-aware datetime for consistent comparisons
                if isinstance(deadline, datetime):
                    if deadline.tzinfo is None:
                        # assume naive deadlines are in UTC
                        deadline = deadline.replace(tzinfo=timezone.utc)
                    else:
                        # convert any timezone-aware deadline to UTC
                        deadline = deadline.astimezone(timezone.utc)
                
                log_debug(f"Task '{task.get('taskname')}' deadline set to: {deadline}")
            except Exception as e:
                log_debug(f"Error parsing deadline: {e}")
                deadline = horizon_end
        else:
            deadline = horizon_end
            log_debug(f"Task '{task.get('taskname')}' has no dueDate, using horizon_end: {horizon_end}")

        if deadline < now:
            deadline = horizon_end

        chunks = []

        # Check if task has explicit subtasks with durations
        subtasks = task.get("subTasks") or task.get("subtasks") or []
        log_debug(f"  Found {len(subtasks)} subtasks")
        if subtasks and len(subtasks) > 0:
            # Use subtask durations directly
            for idx, subtask in enumerate(subtasks):
                # Get duration from subtask (could be "minutes", "estimatedMinutes", or "duration")
                duration = subtask.get("minutes") or subtask.get("estimatedMinutes") or subtask.get("duration") or 0
                log_debug(f"    SubTask[{idx}] index={subtask.get('index')}, minutes={duration}, title=\"{subtask.get('title', 'N/A')}\"")
                if duration > 0:
                    chunks.append(duration)
        
        log_debug(f"  Chunks from subtasks: {chunks}")
        
        # Only calculate chunks if no explicit subtasks with durations
        if not chunks:
            if task_type == "leaky":
                # Leaky splitting: choose a chunk count and distribute STEPs
                # according to the chosen `distribution_strategy` and optional `rng`.
                import math

                STEP = 10
                # Handle None/null values: use minChunk if available, otherwise 60
                min_chunk = task.get("minMinutes") or task.get("minChunk") or 60
                max_chunk = task.get("maxMinutes") or task.get("maxChunk") or min_chunk
                rounded_min = math.ceil(min_chunk / STEP) * STEP
                rounded_max = (max_chunk // STEP) * STEP
                rounded_total = (total_minutes // STEP) * STEP

                if rounded_min > rounded_max or rounded_total <= 0:
                    # Fallback to single chunk
                    chunks.append(max(rounded_total, 0))
                else:
                    # feasible number of chunks
                    min_count = (rounded_total + rounded_max - 1) // rounded_max  # ceil(total/max)
                    max_count = rounded_total // rounded_min  # floor(total/min)

                    if min_count > max_count:
                        # can't satisfy bounds, fallback
                        chunks.append(rounded_total)
                    else:
                        # pick chunk_count close to average chunk size
                        avg = (rounded_min + rounded_max) / 2.0
                        ideal = max(1, int(round(rounded_total / avg)))
                        count = max(min_count, min(max_count, ideal))

                        # base size per chunk (multiple of STEP)
                        base = (rounded_total // count) // STEP * STEP
                        if base < rounded_min:
                            base = rounded_min
                        remaining = rounded_total - base * count

                        # allocate remaining STEPs across chunks with weights according to strategy
                        steps = remaining // STEP
                        if distribution_strategy == "increasing":
                            # bias toward larger chunks later
                            weights = [ (i + 1) ** 2 for i in range(count) ]
                        elif distribution_strategy == "decreasing":
                            # bias toward larger chunks earlier
                            weights = [ (count - i) ** 2 for i in range(count) ]
                        else:
                            # balanced linear weights
                            weights = [ i + 1 for i in range(count) ]
                        total_w = sum(weights)
                        extra_steps = [ (steps * w) // total_w for w in weights ]
                        assigned = sum(extra_steps)
                        leftover = steps - assigned
                        # assign leftover steps using weighted random (if rng) or deterministic bias
                        if rng:
                            # randomized leftover assignment weighted by the chosen weights
                            while leftover > 0:
                                idx = rng.choices(range(count), weights=weights, k=1)[0]
                                extra_steps[idx] += 1
                                leftover -= 1
                        else:
                            # deterministic leftover assignment: bias larger later chunks
                            idx = count - 1
                            while leftover > 0:
                                extra_steps[idx] += 1
                                leftover -= 1
                                idx -= 1
                                if idx < 0:
                                    idx = count - 1

                        chunks = [ base + s * STEP for s in extra_steps ]

                        # enforce upper bound and redistribute any overflow
                        overflow = 0
                        for i in range(count):
                            if chunks[i] > rounded_max:
                                overflow += chunks[i] - rounded_max
                                chunks[i] = rounded_max

                        if overflow > 0:
                            # try to redistribute overflow to chunks below max
                            for i in range(count):
                                can = rounded_max - chunks[i]
                                give = min(can, overflow)
                                if give > 0:
                                    chunks[i] += give
                                    overflow -= give
                                if overflow <= 0:
                                    break

                        # final cleanup: ensure all multiples of STEP and >0
                        chunks = [ (c // STEP) * STEP for c in chunks if c > 0 ]

            elif task_type == "perfect" or not task.get("canSplit"):
                chunks.append(total_minutes)
            elif task_type == "in_parts" and task.get("chunkCount"):
                chunk_size = -(-total_minutes // task["chunkCount"])  # ceil
                remaining = total_minutes
                while remaining > 0:
                    size = min(chunk_size, remaining)
                    chunks.append(size)
                    remaining -= size
            else:
                chunk_size = task.get("minChunk", 30)
                remaining = total_minutes
                while remaining > 0:
                    size = min(chunk_size, remaining)
                    chunks.append(size)
                    remaining -= size

        log_debug(f"  Final chunks for task '{task.get('taskname')}': {chunks}")

        for i, c in enumerate(chunks):
            var_id = f"{task.get('_id')}_chunk_{i}"
            variables.append({
                "id": var_id,
                "taskId": task.get("_id"),
                "title": task.get("taskname") or task.get("title") or "(untitled)",
                "chunkIndex": i,
                "chunkMinutes": c,
                "totalChunks": len(chunks),
                "deadline": deadline,
                "priorityScore": task.get("priorityScore", 0),
                "canSplit": task.get("canSplit", False),
                "taskType": task_type,
            })
            log_debug(f"  Created variable {var_id} for task {task.get('taskname')}, deadline: {deadline}")

    variables.sort(key=lambda a: (a["deadline"], -a.get("priorityScore", 0)))
    return variables


def generate_domain(variable: dict, today: datetime, horizon_end: datetime, busy_blocks_by_date: Dict, working_hours: Dict) -> List[dict]:
    # Build available time slots (domain) for a variable's chunk size
    slots = []
    deadline = variable["deadline"] if variable["deadline"] < horizon_end else horizon_end
    chunk_minutes = variable["chunkMinutes"]
    now = datetime.now(timezone.utc)
    
    log_debug(f"=== DOMAIN GENERATION ===")
    log_debug(f"Variable ID: {variable['id']}")
    log_debug(f"Chunk size: {chunk_minutes} minutes")
    log_debug(f"Deadline (from variable): {variable['deadline']}")
    log_debug(f"Horizon end: {horizon_end}")
    log_debug(f"Final deadline used: {deadline}")
    log_debug(f"Today: {today}")
    log_debug(f"Now: {now}")

    current_day = start_of_day(today)
    while current_day <= deadline:
        date_key = current_day.date().isoformat()
        working_window = build_working_window(current_day, working_hours)
        busy_blocks = busy_blocks_by_date.get(date_key, [])
        
        # Parse busy blocks if they contain ISO strings instead of datetime objects
        parsed_busy_blocks = []
        for b in busy_blocks:
            parsed_block = {}
            for key, val in b.items():
                if key in ["start", "end"] and isinstance(val, str):
                    # Parse ISO string to datetime
                    parsed_block[key] = datetime.fromisoformat(val.replace('Z', '+00:00'))
                else:
                    parsed_block[key] = val
            parsed_busy_blocks.append(parsed_block)

        slot_start = working_window["start"]
        while slot_start < working_window["end"]:
            slot_end = add_minutes(slot_start, chunk_minutes)
            if slot_end > working_window["end"]:
                break
            if slot_start < now:
                slot_start = add_minutes(slot_start, SLOT_GRANULARITY_MINUTES)
                continue

            candidate = {"start": slot_start, "end": slot_end, "minutes": chunk_minutes, "dateKey": date_key}
            
            # Check deadline constraint: slot must end before or at the deadline
            deadline_check = respects_deadline(candidate, deadline)
            if not deadline_check:
                log_debug(f"REJECTED: {slot_start} -> {slot_end} (after deadline {deadline})")
            else:
                log_debug(f"ACCEPTED: {slot_start} -> {slot_end} (before deadline {deadline})")
            
            if not deadline_check:
                slot_start = add_minutes(slot_start, SLOT_GRANULARITY_MINUTES)
                continue
            
            overlaps_with_busy = any(not (candidate["end"] <= b["start"] or candidate["start"] >= b["end"]) for b in parsed_busy_blocks)
            if not overlaps_with_busy:
                slots.append(candidate)

            slot_start = add_minutes(slot_start, SLOT_GRANULARITY_MINUTES)

        current_day = add_days(current_day, 1)

    log_debug(f"Total slots generated: {len(slots)}")
    log_debug(f"=== END DOMAIN GENERATION ===\n")
    return slots


def backtrack_search(variables: List[dict], variable_domains: Dict[str, List[dict]], busy_blocks_by_date: Dict, working_hours: Dict, daily_cap_minutes: int, today: datetime, rng: Optional[random.Random] = None, gap_minutes: int = 10):
    # Backtracking CSP search with forward checking and soft scoring
    assignments = []
    assigned_slots = []
    iterations = 0
    domains = {k: list(v) for k, v in variable_domains.items()}
    
    # Parse all busy blocks upfront to convert ISO strings to datetime objects
    parsed_busy_blocks_by_date = {}
    for date_key, blocks in busy_blocks_by_date.items():
        parsed_blocks = []
        for b in blocks:
            parsed_block = {}
            for key, val in b.items():
                if key in ["start", "end"] and isinstance(val, str):
                    # Parse ISO string to datetime
                    parsed_block[key] = datetime.fromisoformat(val.replace('Z', '+00:00'))
                else:
                    parsed_block[key] = val
            parsed_blocks.append(parsed_block)
        parsed_busy_blocks_by_date[date_key] = parsed_blocks

    def backtrack():
        nonlocal iterations, domains
        iterations += 1
        if iterations > MAX_BACKTRACK_ITERATIONS:
            return True

        assigned_ids = set(a["variableId"] for a in assignments)
        unassigned = [ {"variable": v, "domain": domains.get(v["id"], [])} for v in variables if v["id"] not in assigned_ids]

        if not unassigned:
            return True

        selected = select_variable_mrv(unassigned, rng)
        if not selected or not selected.get("domain"):
            log_debug(f"[BACKTRACK] No selectable variable found. Unassigned count: {len(unassigned)}")
            if unassigned:
                log_debug(f"[BACKTRACK] First unassigned var: {unassigned[0]['variable'].get('id')}, domain size: {len(unassigned[0].get('domain', []))}")
            return False

        variable = selected["variable"]
        log_debug(f"[BACKTRACK] Selected variable: {variable.get('id')}, domain size: {len(selected.get('domain', []))}")

        # Get chunk index and reference date for earliness scoring
        chunk_index = variable.get("chunkIndex", 0)
        reference_date = today.date() if chunk_index is not None else None

        ordered = order_values_lcv(selected["domain"], lambda slot: compute_soft_score(candidate_slot={**slot, "minutes": variable["chunkMinutes"]}, task_id=variable["taskId"], existing_assignments=assigned_slots, daily_cap_minutes=daily_cap_minutes, chunk_index=chunk_index, reference_date=reference_date), rng)

        slots_tried = 0
        slots_passed_hard = 0
        for slot in ordered:
            slots_tried += 1
            candidate_slot = {"start": slot["start"], "end": slot["end"], "minutes": variable["chunkMinutes"], "dateKey": slot.get("dateKey"), "taskId": variable["taskId"], "variableId": variable["id"]}
            working_window = build_working_window(slot["start"], working_hours)
            busy_blocks = parsed_busy_blocks_by_date.get(slot.get("dateKey"), [])

            if not satisfies_hard_constraints(candidate_slot=candidate_slot, existing_assignments=assigned_slots, busy_blocks_for_day=busy_blocks, working_window=working_window, deadline=variable.get("deadline"), variable_id=variable["id"], min_gap_minutes=gap_minutes):
                continue

            slots_passed_hard += 1
            assignment = {"variableId": variable["id"], "taskId": variable["taskId"], "title": variable.get("title"), "slot": candidate_slot}
            assignments.append(assignment)
            assigned_slots.append(candidate_slot)
            
            log_debug(f"[BACKTRACK] ✅ Assigned {variable.get('id')} to slot: {candidate_slot['start']} → {candidate_slot['end']} ({candidate_slot['minutes']} min)")

            pruned = forward_check(candidate_slot, domains, variable["id"])
            if pruned is not None:
                saved = domains
                domains = pruned
                if backtrack():
                    return True
                domains = saved
            else:
                log_debug(f"[BACKTRACK] Forward check failed (returned None) for {variable.get('id')} at slot {slot['start']}")

            assignments.pop()
            assigned_slots.pop()

        log_debug(f"[BACKTRACK] Variable {variable.get('id')}: tried {slots_tried} slots, {slots_passed_hard} passed hard constraints")

        return False

    backtrack()
    
    log_debug(f"\n=== FINAL SOLUTION ===")
    log_debug(f"Total assignments: {len(assignments)}")
    for assignment in assignments:
        log_debug(f"  {assignment['variableId']} ({assignment.get('title', 'N/A')}): {assignment['slot']['start']} -> {assignment['slot']['end']}")
    log_debug(f"=== END FINAL SOLUTION ===\n")
    
    return {"assignments": assignments, "iterations": iterations}


def plan_tasks_csp(tasks: List[dict], options: Dict = None):
    return schedule_tasks_csp(tasks, options)
