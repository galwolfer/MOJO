# Task Edit API Documentation

Complete API flow for editing tasks and subtasks via PATCH requests.

---

## Table of Contents
- [Update Task](#update-task)
- [Update SubTask](#update-subtask)
- [Bulk Update Task with SubTasks](#bulk-update-task-with-subtasks)
- [Response Codes](#response-codes)
- [Examples](#examples)

---

## Update Task

Update a single task's fields.

**Endpoint:** `PATCH /api/tasks/:id`

**Authentication:** Required (JWT token)

**Path Parameters:**
- `id` (string, required) - Task ID

**Request Body:** (all fields optional)

```json
{
  "taskname": "string",           // Task title (max 200 chars)
  "name": "string",               // Alias for taskname
  "description": "string",        // Task description
  "category": "string",           // Task category
  "subcategory": "string",        // Subcategory label
  "importance": 1-5,              // Integer 1-5
  "effort": 1-5,                  // Integer 1-5
  "estimatedDuration": 60,        // Minutes (min 15)
  "canSplit": true,               // Boolean
  "taskType": "in_parts",         // "perfect" | "in_parts" | "leaky"
  "chunkCount": 3,                // Integer >= 1 (for in_parts/leaky)
  "chunkMinutes": 100,            // Integer >= 1
  "minMinutes": 30,               // Integer >= 1 (for leaky)
  "maxMinutes": 120,              // Integer >= 1 (for leaky)
  "minChunk": 30,                 // Integer >= 15
  "status": "in_progress",        // "todo" | "in_progress" | "done"
  "completed": false,             // Boolean (alias for status)
  "deadline": "2026-02-15",       // ISO 8601 date string
  "dueDate": "2026-02-15T10:00:00Z" // ISO 8601 datetime string
}
```

**Response:**

Success (200):
```json
{
  "success": true,
  "message": "Task updated successfully",
  "task": {
    "_id": "task_id",
    "userId": "user_id",
    "taskname": "Updated Task Name",
    "description": "Updated description",
    "importance": 4,
    "effort": 3,
    "estimatedDuration": 120,
    "taskType": "in_parts",
    "chunkCount": 3,
    "status": "in_progress",
    "dueDate": "2026-02-15T00:00:00.000Z",
    "category": "work_and_career",
    "subCategory": {
      "label": "Project Work",
      "source": "user",
      "confidence": 1,
      "updatedAt": "2026-01-10T..."
    },
    "createdAt": "2026-01-10T...",
    "updatedAt": "2026-01-10T..."
  }
}
```

Error (400 - Validation Error):
```json
{
  "success": false,
  "error": "Importance must be an integer between 1 and 5"
}
```

Error (404 - Not Found):
```json
{
  "success": false,
  "error": "Task not found"
}
```

---

## Update SubTask

Update a single subtask (for tasks with `taskType: "in_parts"` or `"leaky"`).

**Endpoint:** `PATCH /api/tasks/:taskId/subtasks/:subId`

**Authentication:** Required (JWT token)

**Path Parameters:**
- `taskId` (string, required) - Parent task ID
- `subId` (string, required) - SubTask ID

**Request Body:** (all fields optional)

```json
{
  "title": "string",        // Subtask title (max 200 chars)
  "description": "string",  // Subtask description
  "status": "done",         // "todo" | "done"
  "minutes": 45             // Estimated/actual minutes for this subtask
}
```

**Response:**

Success (200):
```json
{
  "success": true,
  "message": "Subtask updated successfully",
  "subtask": {
    "_id": "subtask_id",
    "taskId": "task_id",
    "userId": "user_id",
    "index": 1,
    "title": "Exercise 1",
    "description": "Complete first exercise",
    "status": "done",
    "minutes": 45,
    "completedAt": "2026-01-10T14:30:00.000Z",
    "createdAt": "2026-01-10T...",
    "updatedAt": "2026-01-10T..."
  }
}
```

**Note:** When a subtask is updated:
- Setting `status: "done"` automatically sets `completedAt` to current timestamp
- Setting `status: "todo"` clears `completedAt`
- Parent task status is automatically synced:
  - All subtasks done → parent status: "done"
  - Some subtasks done → parent status: "in_progress"
  - No subtasks done → parent status: "todo"

---

## Bulk Update Task with SubTasks

Update a task and multiple subtasks in a single transaction.

**Endpoint:** `PATCH /api/tasks/:id/full`

**Authentication:** Required (JWT token)

**Path Parameters:**
- `id` (string, required) - Task ID

**Request Body:**

```json
{
  "task": {
    "taskname": "Updated Task Name",
    "importance": 5,
    "estimatedDuration": 180,
    "taskType": "in_parts",
    "chunkCount": 3
  },
  "subtasks": [
    {
      "_id": "subtask_1_id",
      "title": "Exercise 1",
      "status": "done"
    },
    {
      "_id": "subtask_2_id",
      "title": "Exercise 2", 
      "status": "in_progress"
    },
    {
      "_id": "subtask_3_id",
      "title": "Exercise 3",
      "status": "todo"
    }
  ]
}
```

**Response:**

Success (200):
```json
{
  "success": true,
  "message": "Task and subtasks updated successfully",
  "task": {
    "_id": "task_id",
    "taskname": "Updated Task Name",
    "importance": 5,
    "status": "in_progress",
    // ... other task fields
  },
  "subtasks": [
    {
      "_id": "subtask_1_id",
      "title": "Exercise 1",
      "status": "done",
      // ... other subtask fields
    },
    {
      "_id": "subtask_2_id",
      "title": "Exercise 2",
      "status": "in_progress",
      // ... other subtask fields
    },
    {
      "_id": "subtask_3_id",
      "title": "Exercise 3",
      "status": "todo",
      // ... other subtask fields
    }
  ]
}
```

Partial Success (200 - with errors):
```json
{
  "success": true,
  "message": "Partial update completed with some errors",
  "task": { /* updated task */ },
  "subtasks": [ /* successfully updated subtasks */ ],
  "errors": [
    {
      "type": "subtask",
      "id": "subtask_2_id",
      "error": "Subtask not found"
    }
  ]
}
```

---

## Response Codes

| Code | Description |
|------|-------------|
| 200  | Success - Resource updated |
| 400  | Bad Request - Validation error or no fields to update |
| 401  | Unauthorized - Missing or invalid JWT token |
| 404  | Not Found - Task or subtask doesn't exist or doesn't belong to user |
| 500  | Internal Server Error |

---

## Examples

### Example 1: Update Task Name and Importance

```bash
curl -X PATCH http://localhost:5000/api/tasks/678abc123def456 \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "taskname": "Finish 3 out of 4 exercises in Algorithms",
    "importance": 5
  }'
```

### Example 2: Change Task Type and Chunk Count

```bash
curl -X PATCH http://localhost:5000/api/tasks/678abc123def456 \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "taskType": "in_parts",
    "chunkCount": 3,
    "estimatedDuration": 300
  }'
```

**Note:** Changing `taskType` to "in_parts" or "leaky" automatically creates subtasks. Changing to "perfect" removes subtasks.

### Example 3: Mark SubTask as Complete

```bash
curl -X PATCH http://localhost:5000/api/tasks/678abc123def456/subtasks/subtask123 \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "status": "done"
  }'
```

### Example 4: Update Task and All SubTasks Together

```bash
curl -X PATCH http://localhost:5000/api/tasks/678abc123def456/full \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "task": {
      "importance": 5,
      "deadline": "2026-01-20"
    },
    "subtasks": [
      { "_id": "sub1", "status": "done", "title": "Exercise 1" },
      { "_id": "sub2", "status": "done", "title": "Exercise 2" },
      { "_id": "sub3", "status": "todo", "title": "Exercise 3" }
    ]
  }'
```

### Example 5: Clear Task Deadline

```bash
curl -X PATCH http://localhost:5000/api/tasks/678abc123def456 \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "deadline": null
  }'
```

### Example 6: Update Leaky Task Parameters

```bash
curl -X PATCH http://localhost:5000/api/tasks/678abc123def456 \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "taskType": "leaky",
    "minMinutes": 30,
    "maxMinutes": 120,
    "estimatedDuration": 180
  }'
```

---

## Code Flow

### Routes → Controllers → Services

**1. Route Layer** (`src/routes/tasks.js`)
```javascript
router.patch("/:id", taskController.updateTask);
router.patch("/:taskId/subtasks/:subId", taskController.updateSubTask);
router.patch("/:id/full", taskController.bulkUpdateTaskWithSubtasks);
```

**2. Controller Layer** (`src/controllers/taskController.js`)
- Validates request parameters
- Sanitizes input data
- Enforces field constraints
- Maps API field names to internal field names
- Calls service layer
- Formats response

**3. Service Layer** (`src/services/taskService.js`)
- Business logic execution
- Database operations
- Subtask synchronization
- Parent task status sync
- Telemetry logging

---

## Validation Rules

### Task Fields

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| taskname | string | 1-200 chars | Required if provided |
| importance | number | 1-5 (integer) | - |
| effort | number | 1-5 (integer) | - |
| estimatedDuration | number | >= 15 minutes | - |
| taskType | string | "perfect", "in_parts", "leaky" | Changes affect subtasks |
| chunkCount | number | >= 1 (integer) | For in_parts/leaky only |
| minMinutes | number | >= 1 | For leaky only |
| maxMinutes | number | >= 1 | Must be >= minMinutes |
| minChunk | number | >= 15 minutes | - |
| status | string | "todo", "in_progress", "done" | - |

### SubTask Fields

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| title | string | 0-200 chars | Can be empty |
| status | string | "todo", "done" | Affects parent task status |
| minutes | number | >= 0 | - |

---

## Backend Implementation Details

### Model Hook (Task.js)
When a task is saved:
- `post("save")` hook triggers `syncSubTasksForTask()`
- SubTasks are created/removed based on `taskType` and `chunkCount`
- SubTask titles default to "Part N" if not set

### Service Layer (taskService.js)
- `updateTask()`: Updates task fields and triggers subtask sync
- `updateSubTask()`: Updates subtask and syncs parent task status
- `syncSubTasksForTask()`: Ensures correct number of subtasks exist

### Automatic Behaviors
1. **SubTask Creation**: Changing `taskType` to "in_parts" or "leaky" creates subtasks
2. **SubTask Deletion**: Changing `taskType` to "perfect" removes all subtasks
3. **Status Sync**: SubTask status changes propagate to parent task
4. **Index Management**: SubTasks maintain sequential indexes (1, 2, 3...)

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

Common errors:
- **400**: Validation failed, invalid field values, no updates provided
- **404**: Task or subtask not found, or doesn't belong to authenticated user
- **401**: Missing or invalid authentication token
- **500**: Unexpected server error (logged for debugging)

---

## Testing

Test the API endpoints using the provided curl examples or tools like Postman/Insomnia.

For automated testing, see `tests/` directory for integration tests covering:
- Field validation
- SubTask synchronization
- Parent task status updates
- Bulk update transactions
