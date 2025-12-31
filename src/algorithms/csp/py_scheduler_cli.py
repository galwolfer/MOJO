"""CLI wrapper exposing the Python CSP scheduler to stdin/stdout.

Reads JSON from stdin like { "tasks": [...], "options": {...} }
and writes JSON schedule to stdout with ISO-formatted datetimes.
"""
import sys
import json
from pathlib import Path

try:
    # ensure package import works
    sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
    from src.algorithms.csp.scheduler import schedule_tasks_csp
except Exception:
    # fallback if package layout differs
    from .scheduler import schedule_tasks_csp


def to_iso(o):
    # Recursively convert datetime objects to ISO strings for JSON output
    if isinstance(o, dict):
        return {k: to_iso(v) for k, v in o.items()}
    if isinstance(o, list):
        return [to_iso(v) for v in o]
    try:
        from datetime import datetime

        if isinstance(o, datetime):
            return o.isoformat()
    except Exception:
        pass
    return o


def main():
    # Read JSON from stdin and run scheduler, writing ISO-safe JSON to stdout
    raw = sys.stdin.read()
    if not raw:
        data = {}
    else:
        data = json.loads(raw)

    tasks = data.get("tasks") or data
    options = data.get("options") or {}

    out = schedule_tasks_csp(tasks, options)
    out = to_iso(out)
    print(json.dumps(out))


if __name__ == "__main__":
    main()
