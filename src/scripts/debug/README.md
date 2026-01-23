Development debug scripts

Location: src/scripts/debug/

Files:
- debug-db.js       : Query sessions for a date range (read-only)
- verify-db.js      : Verify Task -> TaskSchedule consistency (read-only)
- check-fields.js   : Dump a single TaskSchedule document (read-only)
- cleanup-schedule.js : Destructive. Deletes scheduled sessions for "Do homework" task and resets it. Requires `--confirm` flag or DEBUG_CONFIRM=true.
- reschedule-task.js: Regenerates a plan and persists it (writes scheduled sessions)

Safety:
- All scripts refuse to run when NODE_ENV=production.
- Destructive script (`cleanup-schedule.js`) requires `--confirm` to run.

Usage examples:
  NODE_ENV=development node src/scripts/debug/debug-db.js
  node src/scripts/debug/cleanup-schedule.js --confirm

If you want, we can add brighter warnings, or move these to a separate dev-only package or gitignored folder.