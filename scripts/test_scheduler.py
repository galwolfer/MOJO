import sys
from pathlib import Path
# Ensure project root is on sys.path
sys.path.append(str(Path(__file__).resolve().parents[1]))

from src.algorithms.csp.scheduler import schedule_tasks_csp

print('Imported scheduler, OK')
print(schedule_tasks_csp([]))
