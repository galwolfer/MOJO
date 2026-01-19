# MOJO API Reference 📡

This document describes the HTTP API exposed by the server in `src/`. It covers the active routes, request/response formats, authentication, and examples to help frontend and integration work.

---

## Base URL

- Local development (default): `http://localhost:3000`
- The app mounts the API under `/api` (see `src/app.js`). Example: `GET /api/health`.

---

## Authentication 🔐

- The server uses JWT-based authentication for protected endpoints.
- Obtain a token by calling `POST /api/auth/login` (or register with `POST /api/auth/register`).
- Send header: `Authorization: Bearer <token>` for protected routes.

---

## Health

- `GET /api/health`
  - Public
  - Response: `{ ok: true, ts: 167XXXXX }`

---

## Authentication (Auth)

- `POST /api/auth/register`
  - Public
  - Body: `{ username, email, password }`
  - Response (201): `{ success: true, token, user: { id, username, email, profile } }`

- `POST /api/auth/login`
  - Public
  - Body: `{ username, password }`
  - Response: `{ success: true, token, user }`

- `GET /api/auth/me`
  - Protected
  - Returns current user profile (without password hash)
  - Response: `{ success: true, user: { id, username, email, profile, createdAt, updatedAt } }`

- `PATCH /api/auth/profile`
  - Protected
  - Body: `{ name?, ojoTypeName?, settings?, profileImage?, gender? }`
  - Description: Update profile fields; set `ojoTypeName` to one of `mentorjo`, `brojo`, `bestojo`, `strictojo` to change the user's OjoType.
  - Response: `{ success: true, message, profile }`

---

## Users

- `GET /api/users`
  - Public (mounted before expired task blocker)
  - Returns a list of users
  - Response: `[{ username, email, profile, ... }, ...]`

- `POST /api/users`
  - Public
  - Body: `{ username, email, password, displayName? }`
  - Response (201): created user object (passwordHash removed)

---

## Tasks (base: `/api/tasks`) ✅
All `/api/tasks` endpoints require authentication (bearer token).

CRUD & helpers:

- `POST /api/tasks`
  - Create a task
  - Body: `{ name, tag, deadline, recurrence? }
  - Response (201): `{ success: true, task }`

- `GET /api/tasks`
  - List tasks with optional filters: `?tag=foo&completed=true&dueBefore=ISO&dueAfter=ISO`
  - Response: `{ success: true, count, tasks }`

- `GET /api/tasks/:id`
  - Get single task
  - Response: `{ success: true, task }`

- `PATCH /api/tasks/:id`
  - Update a task (body fields: `name`, `tag`, `completed`, `deadline`)
  - Response: `{ success: true, task }`

- `DELETE /api/tasks/:id`
  - Delete a task
  - Response: `{ success: true, message }`

- `POST /api/tasks/:id/toggle`
  - Toggle completion status
  - Response: `{ success: true, task, message }`

Filtered & expired management:

- `GET /api/tasks/upcoming/:days?`
  - Tasks due within N days (default: 7)
  - Response: `{ success: true, count, tasks }`

- `GET /api/tasks/overdue`
  - Overdue tasks

- `GET /api/tasks/expired` & `GET /api/tasks/expired/check`
  - List expired tasks or get quick boolean check for expired tasks

- `PATCH /api/tasks/expired/:id/extend`
  - Body: `{ newDeadline: 'ISO DATE' }` — Extend deadline for expired task

- `DELETE /api/tasks/expired/:id/forfeit`
  - Permanently delete an expired task

- `POST /api/tasks/expired/:id/handle`
  - Body: `{ action: 'extend'|'forfeit', newDeadline?: 'ISO DATE' }`
  - Combined handler for expired task flow

Notes:
- Date inputs should be ISO 8601 strings (e.g., `2025-12-31T23:59:59Z`).
- Validation errors return `4xx` with a descriptive message.

Middleware note:
- The server includes an `expiredTaskBlocker` middleware that may block access to non-user-management routes when the user has expired tasks. The endpoints under `/api/tasks/expired/*` are whitelisted to allow resolution flows (extend/forfeit/handle).

---

## Chat (base: `/api/chat`) 💬
Most chat endpoints require authentication unless otherwise noted.

- `POST /api/chat/message`
  - Protected
  - Body: `{ message, sessionId? }`
  - Returns: the agent result `{ success, response, sessionId, messageCount }`
  - Note: Assistant messages stored in session history now include `ojoTypeName` and `ojoTypeDisplayName` (when available) to indicate which OjoType persona authored the message.

- `POST /api/chat/reset`
  - Protected
  - Body: `{ sessionId }` — clears session history

- `GET /api/chat/history/:sessionId`
  - Protected
  - Query: `?limit=10&offset=0` (optional pagination)
  - Returns full or paged session history

- `GET /api/chat/sessions`
  - Protected
  - Query: `?limit&cursor&includeMessages` — lists sessions with optional last N messages

- `GET /api/chat/user-sessions`
  - Protected
  - Lightweight sessions info from the user document with optional `includeMessages`

- `GET /api/chat/health`
  - Public - health for chat subsystem

---

## Feature Routes (profile / priority / ojotypes)

- `GET /api/profile` — Get the profile (mock or from `profileService`)
- `PUT /api/profile` — Update the profile (mocked fallback exists)

- `GET /api/ojo-types` — List available OjoTypes for onboarding
  - Public
  - Response: `{ success: true, count, ojoTypes: [{ name, displayName, persona, tone, isDefault }, ...] }`

- `GET /api/ojo-types/:name` — Get a specific OjoType by name
  - Public
  - Response: `{ success: true, ojoType: { name, displayName, persona, tone, isDefault } }`

- `POST /api/priority/coach/next` — Compute next recommended activity
  - Body: `{ userId? }` (will attempt to read `req.user.userId`)
  - Uses `coacherAlgorithm.computeFromDb(userId)`

- `POST /api/priority/coach/feedback` — Record feedback (currently a safe no-op)
- `GET /api/priority/stats` — Lightweight priority stats
- `POST /api/priority/job` — Trigger an ad-hoc priority job (no-op / quick response)

Notes: these endpoints represent small feature areas. Some are mocked or implemented minimally to be stable and predictable.

---

## Error Handling

- Validation errors use `4xx` with a JSON body such as `{ success: false, error: 'message' }`.
- Unexpected server errors return `500` and are handled by the global error middleware in `src/middlewares/error.js`.

---

## Examples (curl)

- Register:

  curl -s -X POST http://localhost:3000/api/auth/register \
    -H "Content-Type: application/json" \
    -d '{"username":"alice","email":"alice@example.com","password":"secret123"}'

- Create Task (authenticated):

  curl -s -X POST http://localhost:3000/api/tasks \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <token>" \
    -d '{"name":"Write report","tag":"work","deadline":"2025-12-01T12:00:00Z"}'

- Send Chat Message (authenticated):

  curl -s -X POST http://localhost:3000/api/chat/message \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <token>" \
    -d '{"message":"Summarize my tasks for today","sessionId":"session123"}'

---

## Contributing / Extending

- Add or extend controllers in `src/controllers/`. Keep controller logic thin and delegate heavy logic to services in `src/services/`.
- Add route-level documentation above handler definitions (see `src/routes/tasks.js` for an example of good inline docs).

---

If you'd like, I can also generate Postman/OpenAPI specs from these routes (automatically) — tell me whether you'd prefer Swagger/OpenAPI or a Postman collection. ✅
