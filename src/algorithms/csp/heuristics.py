# CSP heuristics: MRV, LCV, forward checking, and arc-consistency utilities
from typing import List, Dict, Optional, Tuple
import random
from datetime import datetime


def select_variable_mrv(unassigned_variables: List[Dict], rng: Optional[random.Random] = None) -> Optional[Dict]:
    # Select variable with Minimum Remaining Values (smallest domain)
    if not unassigned_variables:
        return None

    # ORDERING CONSTRAINT: Only consider chunks whose previous chunks are already assigned
    # Filter out chunks that can't be scheduled yet due to ordering
    selectable = []
    for entry in unassigned_variables:
        var = entry.get("variable", {})
        var_id = var.get("id", "")
        
        # Check if this is a chunk variable
        if "_chunk_" in var_id:
            parts = var_id.split("_chunk_")
            if len(parts) == 2:
                task_id = parts[0]
                try:
                    chunk_num = int(parts[1])
                except:
                    chunk_num = 0
                
                # For chunk N, check if all chunks 0..N-1 are already assigned
                # We do this by checking if they're in the unassigned list
                can_select = True
                for prev_chunk in range(chunk_num):
                    prev_chunk_id = f"{task_id}_chunk_{prev_chunk}"
                    # If previous chunk is still unassigned, can't select this one yet
                    if any(e.get("variable", {}).get("id") == prev_chunk_id for e in unassigned_variables):
                        can_select = False
                        break
                
                if can_select:
                    selectable.append(entry)
            else:
                selectable.append(entry)
        else:
            selectable.append(entry)
    
    if not selectable:
        return None

    # CRITICAL FIX: Among selectable variables, prioritize by CHUNK INDEX first
    # This ensures chunk_0 is selected before chunk_1, chunk_1 before chunk_2, etc.
    def get_chunk_index(entry):
        var_id = entry.get("variable", {}).get("id", "")
        if "_chunk_" in var_id:
            parts = var_id.split("_chunk_")
            if len(parts) == 2:
                try:
                    return int(parts[1])
                except:
                    pass
        return 999999  # Non-chunk variables get high index (scheduled last)
    
    # Sort by: chunk index (ascending), then domain size (ascending), then priority (descending)
    selectable_sorted = sorted(
        selectable,
        key=lambda e: (
            get_chunk_index(e),  # Lower chunk indices first
            len(e.get("domain", [])),  # Smaller domain (MRV)
            -e.get("variable", {}).get("priorityScore", 0)  # Higher priority
        )
    )
    
    # Return the first one (lowest chunk index, smallest domain, highest priority)
    return selectable_sorted[0]


def order_values_lcv(domain: List[dict], score_fn, rng: Optional[random.Random] = None) -> List[dict]:
    # Order domain values by Least Constraining Value (LCV) using score_fn
    scored = []
    for s in domain:
        try:
            score = score_fn(s)
        except Exception:
            score = 0
        # small random tie-breaker when rng provided
        tie = rng.random() if rng else 0
        scored.append((s, score, tie))

    scored.sort(key=lambda t: (t[1], t[2], t[0]["start"]))
    return [t[0] for t in scored]


def compute_degree(variable: Dict) -> float:
    # Heuristic degree combining deadline proximity, remaining chunks and priority
    score = 0.0
    if variable.get("deadline"):
        try:
            days_until = max(0.0, (variable["deadline"] - datetime.now()).total_seconds() / (60 * 60 * 24))
        except Exception:
            days_until = 0.0
        score += max(0, 30 - days_until)

    score += (variable.get("remainingChunks", 1) or 1) * 2
    score += (variable.get("priorityScore", 0) or 0) / 10.0
    return score


def forward_check(assigned_slot: dict, variable_domains: Dict[str, List[dict]], assigned_var_id: str) -> Optional[Dict[str, List[dict]]]:
    # Remove conflicting domain values after assigning a slot (forward checking)
    pruned = {}

    for var_id, domain in variable_domains.items():
        if var_id == assigned_var_id:
            pruned[var_id] = [assigned_slot]
            continue

        filtered = [slot for slot in domain if slot["end"] <= assigned_slot["start"] or slot["start"] >= assigned_slot["end"]]

        if not filtered:
            return None

        pruned[var_id] = filtered

    return pruned


def arc_consistency(variable_domains: Dict[str, List[dict]]) -> Optional[Dict[str, List[dict]]]:
    # AC-3 algorithm to enforce arc consistency on variable domains
    from collections import deque

    var_ids = list(variable_domains.keys())
    queue = deque()
    for i in range(len(var_ids)):
        for j in range(len(var_ids)):
            if i == j:
                continue
            queue.append((var_ids[i], var_ids[j]))

    domains = {k: list(v) for k, v in variable_domains.items()}

    def revise(xi, xj):
        revised = False
        new_domain = []
        for slot_i in domains[xi]:
            ok = any(slot_i["end"] <= slot_j["start"] or slot_i["start"] >= slot_j["end"] for slot_j in domains[xj])
            if ok:
                new_domain.append(slot_i)
        if len(new_domain) < len(domains[xi]):
            domains[xi] = new_domain
            revised = True
        return revised

    while queue:
        xi, xj = queue.popleft()
        if revise(xi, xj):
            if not domains[xi]:
                return None
            for xk in var_ids:
                if xk != xi and xk != xj:
                    queue.append((xk, xi))

    return domains
