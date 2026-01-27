```
MODULAR TASK SCHEDULING ARCHITECTURE
=====================================

┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ENTRY POINTS (Two Paths to Task Operations)                              │
│  ═════════════════════════════════════════════════════════════════════    │
│                                                                             │
│  Path A: REST API                      Path B: LLM Chat                   │
│  ──────────────────                    ──────────────────                │
│  POST /api/tasks                       addTask.execute()                 │
│   │                                     │                                 │
│   └──────────────┬──────────────────────┘                               │
│                  │                                                        │
│                  ▼                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │              CONTROLLER LAYER (Single Source of Truth)          │   │
│  │  ═════════════════════════════════════════════════════════    │   │
│  │                                                              │   │
│  │  • taskController.createTask()                              │   │
│  │  • taskController.updateTask()                              │   │
│  │  • taskController.deleteTask()                              │   │
│  │                                                              │   │
│  └────────────────────────┬─────────────────────────────────────┘   │
│                           │                                         │
│                           ├─────────────────────┐                  │
│                           │                     │                  │
│                           ▼                     ▼                  │
│  ┌─────────────────────────────────┐   ┌──────────────────────┐   │
│  │   Service Layer                  │   │   Helper Layer      │   │
│  │   ═══════════════════════════   │   │   ═════════════════ │   │
│  │                                  │   │                    │   │
│  │   taskService.createTask()       │   │   ┌──────────────┐ │   │
│  │   taskService.updateTask()       │   │   │   Mission    │ │   │
│  │   taskService.deleteTask()       │   │   │   Helpers    │ │   │
│  │   taskService.deleteSubTask()    │   │   │ ──────────── │ │   │
│  │                                  │   │   │ • create     │ │   │
│  │   (Database & Business Logic)    │   │   │ • update     │ │   │
│  │                                  │   │   │ • delete     │ │   │
│  └──────────────────────────────────┘   │   └──────────────┘ │   │
│                                          └────────────────────┘   │
└─────────────────────────┬──────────────────────────────────────────┘
                          │
                          │
        ┌─────────────────┴──────────────────┐
        │                                    │
        ▼                                    ▼
  ┌──────────────────────────┐   ┌──────────────────────────┐
  │  SCHEDULER HELPER        │   │  SCHEDULER TRIGGER       │
  │  ═════════════════════  │   │  ════════════════════   │
  │                          │   │                          │
  │  triggerSchedulerUpdate()│   │  Called automatically:   │
  │  ─────────────────────  │   │  ─────────────────────  │
  │                          │   │  • After create         │
  │  Input:                  │   │  • After update         │
  │  • userId                │   │  • After delete         │
  │  • operationType         │   │                          │
  │  • location              │   │  Location tracking:     │
  │                          │   │  • "API"                │
  │  Output:                 │   │  • "LLM"                │
  │  • success (boolean)     │   │                          │
  │  • sessionCount          │   │                          │
  │  • error (optional)      │   │                          │
  │                          │   │                          │
  └──────────────┬───────────┘   │                          │
                 │               └──────────────────────────┘
                 │
                 ▼
  ┌──────────────────────────┐
  │  PYTHON SCHEDULER        │
  │  ═══════════════════════│
  │                          │
  │  py_scheduler_cli.py     │
  │  (CSP Algorithm)         │
  │                          │
  │  Input: Tasks & config   │
  │  Output: 15+ sessions    │
  │                          │
  └──────────────┬───────────┘
                 │
                 ▼
  ┌──────────────────────────┐
  │  DATABASE                │
  │  ═════════════════════  │
  │                          │
  │  TaskSchedule collection │
  │  • 15+ sessions per task │
  │  • Start/end timestamps  │
  │  • Task references       │
  │  • User ID               │
  │                          │
  └──────────────────────────┘


DATAFLOW EXAMPLE: CREATE TASK VIA API
════════════════════════════════════════

POST /api/tasks
    │
    ├─ req = { user: { userId }, body: { taskname, category, deadline } }
    │
    ▼
taskController.createTask(req, res)
    │
    ├─ Validate inputs
    │
    ├─ taskService.createTask(taskData)
    │  └─ Returns: Task object { _id, taskname, ... }
    │
    ├─ triggerSchedulerUpdate(userId, "creation", "API")  ◄── CENTRALIZED!
    │  │
    │  ├─ Calls generatePlan(userId)
    │  │  └─ Spawns Python scheduler with task data
    │  │
    │  ├─ Calls savePlan(userId, plan, unscheduled)
    │  │  └─ Persists 15 sessions to TaskSchedule collection
    │  │
    │  └─ Returns: { success: true, sessionCount: 15 }
    │
    └─ res.json({ success: true, task })


DATAFLOW EXAMPLE: CREATE TASK VIA LLM MISSION
════════════════════════════════════════════════

addTask.execute({ userId, args })
    │
    ├─ Validate inputs
    │
    ├─ createTaskViaController(userId, taskData)  ◄── HELPER!
    │  │
    │  ├─ Mock req/res objects
    │  │
    │  ├─ Call: taskController.createTask(mockReq, mockRes)
    │  │  │
    │  │  └─ (Same flow as API path!)
    │  │     ├─ taskService.createTask()
    │  │     └─ triggerSchedulerUpdate()  ◄── SAME CENTRALIZED HELPER!
    │  │
    │  └─ Extract response and return task
    │
    └─ Return: `ok=true\nid="${task._id}"`


KEY BENEFITS
════════════════════════════════════════════════════════════════

1. CENTRALIZED SCHEDULER TRIGGER
   ✓ All task operations (create/update/delete) go through same function
   ✓ If scheduler logic changes, update in ONE place
   ✓ Consistent error handling across all paths

2. CLEAN MISSION CODE
   ✓ Missions don't contain infrastructure/scheduling code
   ✓ Missions focus on business logic
   ✓ Easy to understand and maintain

3. CONSISTENT LOGGING
   ✓ All operations log: "[SCHEDULER] Updated after task {type} ({location}): N sessions"
   ✓ Can trace execution path (API vs LLM)
   ✓ Can count sessions scheduled per operation

4. GRACEFUL ERROR HANDLING
   ✓ Task operations don't fail if scheduler fails
   ✓ Scheduler errors logged but not thrown
   ✓ User gets task created/updated even if scheduling delayed/failed

5. REUSABLE HELPERS
   ✓ Mission controller helpers can be used in any mission
   ✓ Scheduler helper can be called from any endpoint
   ✓ Easy to add new missions/endpoints following same pattern


OPERATION TRACKING
════════════════════════════════════════════════════════════════

Every task operation is logged with:
┌────────────────────────────────────┐
│ [SCHEDULER] Updated after task     │
│ {operationType} ({location}):      │
│ {sessionCount} sessions scheduled  │
└────────────────────────────────────┘

Examples:
  [SCHEDULER] Updated after task creation (API): 15 sessions scheduled
  [SCHEDULER] Updated after task update (LLM): 14 sessions scheduled
  [SCHEDULER] Updated after task deletion (API): 13 sessions scheduled

Location codes:
  API  = REST API endpoint (controllers)
  LLM  = LLM chat mission (theoretical, but helpers support it)


ERROR HANDLING STRATEGY
════════════════════════════════════════════════════════════════

Normal Flow:
  Task Operation → Scheduler → Success (logged)

Error Handling:
  Task Operation → Scheduler → Error (logged but not thrown)
                                   └─ Task still succeeds
                                   └─ Schedule regeneration deferred

Result: User always gets task created/updated/deleted, even if
        scheduler temporary unavailable. Scheduler runs async
        in background and completes when available.


HELPER FUNCTIONS OVERVIEW
════════════════════════════════════════════════════════════════

┌─ missionControllerHelpers.js
│
├─ createTaskViaController(userId, taskData)
│  └─ Used by: addTask mission
│  └─ Returns: Task object or null
│
├─ updateTaskViaController(userId, taskId, updates)
│  └─ Used by: updateTask mission
│  └─ Returns: Updated Task object or null
│
├─ deleteTaskViaController(userId, taskId)
│  └─ Used by: deleteTask mission
│  └─ Returns: boolean success
│
└─ saveSubcategoryToProfile(userId, subName, category)
   └─ Used by: All missions that create/update tasks
   └─ Returns: Promise<void>

┌─ schedulingService.js
│
└─ triggerSchedulerUpdate(userId, operationType, location)
   └─ Used by: All task controllers
   └─ Returns: { success, sessionCount, error }
   └─ Operation types: "creation", "update", "deletion"
   └─ Locations: "API", "LLM"
```
