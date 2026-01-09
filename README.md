# Team MOJO Workspace

Mojo combines a lightweight Express API, MongoDB models, and a colorful interactive CLI that helps you register users, manage tasks, and get priority recommendations.

## Prerequisites

- Node.js 18 or newer
- Local MongoDB service (`mongod`)
- npm

## Install dependencies

```bash
cp .env.example .env  # if you still need a local config
npm install
```

## Start required services

Use two terminals (leave both running):

1. **MongoDB**
   ```bash
   sudo service mongod start
   ```

2. **Express API**
   ```bash
   node src/server.js
   ```
   The server reads the connection string from `.env` and keeps task scores in sync.

## Launch the Mojo Coacher CLI

Open a third terminal once MongoDB and the API are running:

```bash
npm run cli
```

The CLI lets you register/login, add tasks, and receive priority suggestions. Password prompts are masked, and task operations update their priority score automatically.

## Optional: Auto-reloading server

During active development you can replace `node src/server.js` with:
﻿# Team MOJO Server 🚀

## 🎯 Latest Updates

### Phase 4 Complete - Tasks Management System ✅
- 🎯 **Task Management** - Full CRUD operations for user tasks
- 🤖 **LLM Integration** - Natural language task creation
- 🔐 **Secure & Isolated** - JWT authentication with per-user data
- 📝 **Rich API** - 8 endpoints with filtering and queries

### Phase 2 Complete - User-Centric Memory System ✅
- 🧠 **User-Centric Architecture** - All memories embedded in User documents
- 🔍 **Dynamic User Embedding** - Auto-updated based on memories and interactions
- 🔍 **Semantic Search** - Smart retrieval of relevant information
- 📊 **Memory Statistics** - Track memory usage per user
- ⚡ **High Performance** - Single query for user + all memories
- 🎯 **Priority Management** - Importance × Recency weighting

### 📚 Documentation
- **Quick Start**: [`QUICKSTART.md`](./QUICKSTART.md) 👈 **Start here!**
- **Tasks Module**: [`md/PHASE4_START_HERE.md`](./md/PHASE4_START_HERE.md)
- **Tasks API**: [`md/TASKS_API.md`](./md/TASKS_API.md)
- **Memory System**: [`MEMORY_QUICKSTART.md`](./MEMORY_QUICKSTART.md)
- **Full Docs**: [`md/`](./md/)

---

## Team MOJO

This project is maintained by the single MOJO team (all contributors). The team owns the agent, API, and services components together.

---

## Quick Start (5 Minutes)

### 1. Install Dependencies
```bash
npm run dev
```

`nodemon` will restart the server whenever you edit files in `src/`.

## Testing heuristics for categories/sub-categories

1. **Prepare data** – make sure MongoDB is running (`sudo service mongod start`) and run `scripts/migrateTitleToTaskname.js` once if you haven’t yet renamed `taskname`. This ensures existing tasks will surface the new field.
2. **Run the CLI** – execute `npm run cli`, add a few tasks with different wording, and verify that each new task prints an `Auto sub-category:` line showing the inferred label. The label should be stable for similar wording and fall back to tag-based summaries when the title is too vague.
3. **Trigger scoring** – if you change categories or priorities while testing, run `node src/scripts/updateScores.js` (or let the server/CLI run continuously) so `priorityScore` and telemetry stay consistent.
4. **Check telemetry** – confirmed suggestions (option 6) and overrides generate `sub_category_generated` and `sub_category_corrected` events (see console logs or your telemetry storage). This helps you validate that manual overrides influence future history-based suggestions.

## Directory layout
npm install
```

### 2. Configure Environment
```bash
# Copy example env file
cp .env.example .env

# Edit .env and set:
# GEMINI_API_KEY=your_key_here
# MONGODB_URI=mongodb://localhost:27017/mojo
# JWT_SECRET=your-secret-key-change-in-production
```

**Important:** Make sure MongoDB is running!

### 3. Run the Server
```bash
npm run dev
```

You should see:
```
🚀 Server running on http://localhost:3000
✅ Tasks Module: Enabled (Phase 4)
```

### 4. Register a User

**Option 1: PowerShell Script (Recommended)**
```powershell
.\scripts\register.ps1
```

**Option 2: Direct API Call**
```powershell
$body = @{
    username = "yourname"
    email = "you@example.com"
    password = "your-secure-password"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/auth/register" `
  -Method POST -Headers @{"Content-Type"="application/json"} -Body $body
```

### 5. Login

**Option 1: PowerShell Script (Recommended)**
```powershell
.\scripts\login.ps1
```

**Copy the token from the response!**

**Option 2: Direct API Call**
```powershell
$body = @{
    email = "you@example.com"
    password = "your-password"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" `
  -Method POST -Headers @{"Content-Type"="application/json"} -Body $body
```

### 6. Start Chatting!

**Interactive Chat (Easiest)**
```powershell
.\scripts\chat.ps1
```

**Or use the API directly:**
```powershell
$token = "YOUR_TOKEN_HERE"
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}
$body = @{
    message = "Add a task to study for exam next Friday"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/chat/message" `
  -Method POST -Headers $headers -Body $body
```

---

## Features

### 🎯 Task Management (Phase 4)
- Create, read, update, delete tasks
- Natural language task creation via LLM
- Tag-based organization
- Deadline tracking (upcoming/overdue)
- Per-user data isolation

**Example:**
```
User: "Add a task to do my linear algebra homework for next week"
Agent: Creates task with calculated deadline
```

### 🧠 Memory System (Phase 2)
- User-centric memory storage
- Semantic search with embeddings
- Automatic memory extraction from conversations
- Priority-based retrieval

### 🔐 Authentication
- JWT-based authentication
- Secure password hashing (bcrypt)
- Per-user data isolation
- Token-based API access

---

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT token

### Chat
- `POST /api/chat/message` - Send message to agent (requires auth)
- `POST /api/chat/reset` - Reset chat session
- `GET /api/chat/history/:sessionId` - Get chat history

### Tasks (Phase 4)
- `POST /api/tasks` - Create task
- `GET /api/tasks` - List tasks (with filters)
- `GET /api/tasks/:id` - Get specific task
- `PATCH /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `GET /api/tasks/upcoming/:days` - Get upcoming tasks
- `GET /api/tasks/overdue` - Get overdue tasks
- `POST /api/tasks/:id/toggle` - Toggle completion

**All authenticated endpoints require:**
```
Authorization: Bearer <your-jwt-token>
```

---

## Testing

### Test the Tasks Module
```powershell
# Get your token first
.\scripts\login.ps1

# Run automated tests
.\scripts\test_tasks.ps1 -Token "YOUR_TOKEN"
```

### Test Memory System
```bash
npm run test:user-memory
```

### Test Chat
```powershell
.\scripts\chat.ps1
```

Try these commands:
- "Add a task to study for exam next Friday"
- "Show me all my tasks"
- "What tasks are due this week?"
- "Mark my exam task as completed"

---

## PowerShell Scripts

Convenient scripts for common operations:

- **`.\scripts\register.ps1`** - Register a new user account
- **`.\scripts\login.ps1`** - Login and get JWT token
- **`.\scripts\chat.ps1`** - Interactive chat session
- **`.\scripts\test_tasks.ps1`** - Test the tasks API

---

## Example Usage

### Register & Login
```powershell
# Register
.\scripts\register.ps1

# Login (get token)
.\scripts\login.ps1
```

### Chat with Agent
```powershell
.\scripts\chat.ps1
# Then type: "Add a task to buy groceries tomorrow"
```

### Direct API Calls
```powershell
# Set your token
$token = "YOUR_JWT_TOKEN"
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# Create a task
$body = @{
    name = "Study for exam"
    tag = "school"
    deadline = "2025-11-01T12:00:00Z"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/tasks" `
  -Method POST -Headers $headers -Body $body

# Get all tasks
Invoke-RestMethod -Uri "http://localhost:3000/api/tasks" `
  -Method GET -Headers $headers
```

---

## Project Structure

```
Mojo/
├── src/
│   ├── algorithms/
│   │   ├── priority/     # priority scoring, categorizing, suggestions & model helpers
│   │   └── binPacking/   # planner, calendar utilities, routine blocks
│   ├── models/           # Mongoose schemas (Task, User, TaskSchedule, BusyBlock, etc.)
│   ├── services/         # lightweight helpers: telemetry, subcategory generation, CLI glue
│   ├── cli.js            # interactive command line
│   └── server.js         # Express API server
├── data/                 # training data and exported JSON models
├── scripts/              # tooling (migrations, update scores, synthetic data)
└── package.json
```

The algorithm implementations now live under `src/algorithms`, and the CLI/server code import them directly. `src/services` stays focused on helpers (telemetry, tag helpers, subcategory utilities) so the two main algorithms—priority scoring and bin-packing scheduling—are easy to present separately.
│   ├── agent/              # Agent logic, tools, memory extraction
│   │   ├── agentController.js    # Main agent controller with LangChain
│   │   ├── geminiAdapter.js      # Gemini API adapter (for future use)
│   │   ├── langchainTools.js     # LangChain tools (tasks, time, memories)
│   │   ├── prompts.js            # System prompts
│   │   └── vectorStore.js        # Vector embeddings and memory storage
│   ├── models/             # MongoDB models
│   │   ├── User.js         # User with embedded memories
│   │   ├── Task.js         # Task model (Phase 4)
│   │   ├── Session.js
│   │   └── Memory.js       # (deprecated, kept for migration)
│   ├── services/           # Business logic
│   │   ├── taskService.js  # Task operations
│   │   ├── memoryService.js # Memory and conversation management
│   │   └── index.js        # Services index
│   ├── controllers/        # HTTP handlers
│   │   ├── authController.js
│   │   ├── chatController.js
│   │   └── taskController.js
│   ├── routes/             # API routes
│   │   ├── auth.js
│   │   ├── chat.js
│   │   ├── tasks.js        # Tasks endpoints (Phase 4)
│   │   └── index.js
│   ├── middlewares/        # Express middlewares
│   │   └── auth.js         # JWT authentication
│   └── config/             # Configuration
│       ├── database.js
│       └── env.js
├── scripts/                # Helper scripts
│   ├── register.ps1        # User registration
│   ├── login.ps1           # User login
│   ├── chat.ps1            # Interactive chat
│   └── test_tasks.ps1      # Tasks API tests
├── md/                     # Documentation
│   ├── PHASE4_START_HERE.md    # Tasks quick start
│   ├── TASKS_API.md            # API documentation
│   ├── TASKS_QUICKSTART.md     # Tasks guide
│   └── ...
├── .env                    # Environment variables (create from .env.example)
├── package.json
├── QUICKSTART.md           # Main quick start guide
└── README.md               # This file
```

---

## Environment Variables

Create a `.env` file with:

```env
# Gemini API
GEMINI_API_KEY=your-gemini-api-key
# Gemini model (options: gemini-2.0-flash, gemini-2.0-flash-lite, gemini-2.5-flash, gemini-2.5-flash-lite, gemini-2.5-flash-image, gemini-3, gemini-3-lite, gemini-3-image, gemini-3-flash)
GEMINI_MODEL=gemini-2.5-flash

# MongoDB
MONGODB_URI=mongodb://localhost:27017/mojo

# JWT Authentication
JWT_SECRET=your-secret-key-change-in-production

# Server
PORT=3000
NODE_ENV=development
```

---

## Troubleshooting

### Common Issues

**"MongoDB connection error"**
- Make sure MongoDB is running: `mongod` or start the MongoDB service
- Check `MONGODB_URI` in `.env`

**"No token provided"**
- You need to login first: `.\scripts\login.ps1`
- Include token in `Authorization: Bearer <token>` header

**"Invalid token"**
- Token may have expired, login again
- Check that you're using the correct token

**"GEMINI_API_KEY is not defined"**
- Create `.env` file from `.env.example`
- Add your Gemini API key

**"Port 3000 already in use"**
- Stop existing Node processes: `Get-Process -Name node | Stop-Process -Force`
- Or change `PORT` in `.env`

### MongoDB Setup

**Install MongoDB:**
- Download from [mongodb.com](https://www.mongodb.com/try/download/community)
- Or use Docker: `docker run -d -p 27017:27017 mongo`

**Check if running:**
```powershell
Get-Service MongoDB
# or
Get-Process mongod
```

---

## Next Steps & Future Ideas

### Current Features
- ✅ User authentication with JWT
- ✅ Task management system
- ✅ User-centric memory system
- ✅ LLM natural language interface
- ✅ Semantic search with embeddings

### Future Enhancements
- [ ] Task priorities and recurring tasks
- [ ] Subtasks and checklists
- [ ] Task notifications and reminders
- [ ] Notes module (following same pattern)
- [ ] Goals tracking module
- [ ] Calendar/events integration
- [ ] Production embeddings (MongoDB Atlas Vector Search)
- [ ] Memory consolidation and summarization
- [ ] Web UI (React/Vue)
- [ ] Mobile app
- [ ] Deployment guide

---

## Documentation

### Quick Start Guides
- **Main Quick Start**: [`QUICKSTART.md`](./QUICKSTART.md) 👈 Start here
- **Memory System**: [`MEMORY_QUICKSTART.md`](./MEMORY_QUICKSTART.md)
- **Tasks Module**: [`md/TASKS_QUICKSTART.md`](./md/TASKS_QUICKSTART.md)

### Complete Documentation
- **Tasks API Reference**: [`md/TASKS_API.md`](./md/TASKS_API.md)
- **Tasks Overview**: [`md/TASKS_README.md`](./md/TASKS_README.md)
- **Phase 4 Summary**: [`md/PHASE4_START_HERE.md`](./md/PHASE4_START_HERE.md)
- **Memory Architecture**: [`md/MEMORY_REFACTOR.md`](./md/MEMORY_REFACTOR.md)
- **All Documentation**: [`md/`](./md/) directory

### Code Examples
- **Tasks Examples**: [`md/TASKS_EXAMPLES.js`](./md/TASKS_EXAMPLES.js)
- **Test Script**: [`scripts/test_tasks.ps1`](./scripts/test_tasks.ps1)

---

## Support & Contributing

### Getting Help
1. Check the documentation in [`md/`](./md/)
2. Read [`QUICKSTART.md`](./QUICKSTART.md)
3. Run the test scripts
4. Open an issue on GitHub

### Contributing
We welcome contributions! Please:
1. Follow the existing code structure
2. Maintain user isolation in all queries
3. Add comprehensive error handling
4. Update documentation
5. Add tests for new features

---

## Version History

- **Phase 4** (Oct 2025) - Tasks management system with LLM integration
- **Phase 2** (Oct 2025) - User-centric memory system refactor
- **Phase 1** (Oct 2025) - Initial chat agent with basic memory

---

**Version**: Phase 4 Complete
**Status**: ✅ Production Ready
**Last Updated**: October 25, 2025

---

**Built with ❤️ by Team MOJO**

*Modular. Secure. Intelligent.*
