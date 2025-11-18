# Mojo Workflow

> **Mojo** is a task manager that automatically prioritizes your work and schedules it into your calendar.

## What Mojo Does

```mermaid
flowchart LR
    A[Add Tasks] --> B[Smart Prioritization]
    B --> C[Calendar Scheduling]
    C --> D[Get Things Done]
    
    style A fill:#90EE90
    style B fill:#FFD700
    style C fill:#9370DB
    style D fill:#FFB6C1
```

Mojo helps you answer: **"What should I work on next?"**

---

## System Overview

```mermaid
flowchart TB
    User[👤 User] --> CLI[💻 Command Line]
    CLI --> DB[(🗄️ MongoDB)]
    
    subgraph "What You Can Do"
        M1[➕ Add Tasks]
        M2[📋 View Tasks]
        M3[🎯 Get Recommendation]
        M4[📅 Schedule Tasks]
    end
    
    CLI --> M1 & M2 & M3 & M4
    M1 & M2 & M3 & M4 --> DB
```

**Three Simple Steps:**
1. Add your tasks (with importance and deadlines)
2. Ask Mojo what to work on next
3. Schedule tasks into your calendar

---

## How Tasks Are Prioritized

```mermaid
flowchart TD
    Task[📝 Your Task] --> Factors{What Matters?}
    
    Factors --> F1[⭐ Importance 1-5]
    Factors --> F2[⏰ Deadline]
    Factors --> F3[💪 Effort 1-5]
    
    F1 --> Score[🎯 Priority Score]
    F2 --> Score
    F3 --> Score
    
    Score --> Result[Top Task Recommended!]
    
    style Task fill:#87CEEB
    style Score fill:#FFD700
    style Result fill:#90EE90
```

**Example:**
- "Finish report" (Importance: 5, Due: Tomorrow) → **High Priority** ⚡
- "Read article" (Importance: 2, Due: Next month) → **Low Priority**

---

## Basic Workflow

```mermaid
flowchart TD
    Start([Start Mojo]) --> Login[Login]
    Login --> Menu{What do you want?}
    
    Menu -->|Add Task| Add[Enter task details]
    Add --> Auto[Auto-calculate priority]
    Auto --> Menu
    
    Menu -->|What's next?| Rec[Show top priority task]
    Rec --> Menu
    
    Menu -->|Schedule| Plan[Put tasks in calendar]
    Plan --> Menu
    
    Menu -->|Done| Exit([Exit])
    
    style Start fill:#90EE90
    style Auto fill:#FFD700
    style Rec fill:#9370DB
    style Exit fill:#FFB6C1
```

---

## Project Structure

```
Mojo/
├── src/
│   ├── models/          # Database schemas
│   │   ├── User.js      # User accounts
│   │   ├── Task.js      # Tasks with priority scores
│   │   └── TaskSchedule.js  # Calendar slots
│   │
│   ├── services/        # Core logic
│   │   ├── priority.js      # Task ranking algorithm
│   │   ├── planner.js       # Calendar scheduling
│   │   └── suggestions.js   # Task recommendations
│   │
│   ├── cli.js           # Interactive command-line interface
│   └── server.js        # Express API server
│
└── data/                # MongoDB data
```

---

## Key Features

### 🎯 Smart Prioritization
Tasks are scored based on:
- **Importance**: How critical is it? (1-5)
- **Urgency**: When is it due?
- **Effort**: How much work? (1-5)

### 🏷️ Auto-Tagging
Mojo detects categories automatically:
- "Finish assignment" → `study` tag
- "Go to gym" → `health` tag
- "Fix bug" → `work` tag

### 📅 Calendar Planning
Schedule tasks around:
- Your working hours (9 AM - 6 PM)
- Busy blocks (meetings, appointments)
- Routine times (morning routine, lunch breaks)

### 💡 Task Suggestions
Mojo suggests new tasks based on your profile:
- If you prioritize `health`, it suggests fitness tasks
- If you prioritize `work`, it suggests project tasks

---

## Tech Stack

```mermaid
flowchart TB
    subgraph Frontend
        CLI[Node.js CLI<br/>readline + colors]
    end
    
    subgraph Backend
        API[Express.js API<br/>REST endpoints]
        Services[Business Logic<br/>Priority & Scheduling]
    end
    
    subgraph Database
        DB[(MongoDB<br/>Mongoose ODM)]
    end
    
    CLI <--> API
    API <--> Services
    Services <--> DB
```

**Technologies:**
- **Node.js** - JavaScript runtime
- **Express** - Web server/API
- **MongoDB** - Database
- **Mongoose** - Database models
- **bcrypt** - Password security

---

## Quick Start

```bash
# 1. Start MongoDB
sudo service mongod start

# 2. Start the server
node src/server.js

# 3. Run the CLI (in new terminal)
npm run cli
```

That's it! Now you can add tasks and get smart recommendations.

---

> 📚 **Want more detail?** Check out `WORKFLOW_DETAILED.md` for comprehensive flowcharts and architecture diagrams.
