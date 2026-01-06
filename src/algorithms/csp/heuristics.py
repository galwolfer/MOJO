# CSP heuristics: MRV, LCV, forward checking, and arc-consistency utilities
from typing import List, Dict, Optional, Tuple
import random
from datetime import datetime


def select_variable_mrv(unassigned_variables: List[Dict], rng: Optional[random.Random] = None) -> Optional[Dict]:
    # Select variable with Minimum Remaining Values (smallest domain)
    if not unassigned_variables:
        return None

    # Find minimal domain size
    best_domain_size = min(len(e.get("domain", [])) for e in unassigned_variables)
    # Collect candidates with minimal domain size
    candidates = [e for e in unassigned_variables if len(e.get("domain", [])) == best_domain_size]

    if len(candidates) == 1:
        return candidates[0]

    # Tie-break by highest priorityScore
    max_priority = max(c.get("variable", {}).get("priorityScore", 0) for c in candidates)
    priority_candidates = [c for c in candidates if c.get("variable", {}).get("priorityScore", 0) == max_priority]

    if len(priority_candidates) == 1:
        return priority_candidates[0]

    # Final tie-break: deterministic choice if no rng, otherwise random choice
    if rng:
        return rng.choice(priority_candidates)
    return priority_candidates[0]


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
