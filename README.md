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

```bash
npm run dev
```

`nodemon` will restart the server whenever you edit files in `src/`.

## Testing heuristics for categories/sub-categories

1. **Prepare data** – make sure MongoDB is running (`sudo service mongod start`) and run `scripts/migrateTitleToTaskname.js` once if you haven’t yet renamed `taskname`. This ensures existing tasks will surface the new field.
2. **Run the CLI** – execute `npm run cli`, add a few tasks with different wording, and verify that each new task prints an `Auto sub-category:` line showing the inferred label. The label should be stable for similar wording and fall back to tag-based summaries when the title is too vague.
3. **Trigger scoring** – if you change tags or priorities while testing, run `node src/scripts/updateScores.js` (or let the server/CLI run continuously) so `priorityScore` and telemetry stay consistent.
4. **Check telemetry** – confirmed suggestions (option 6) and overrides generate `sub_category_generated` and `sub_category_corrected` events (see console logs or your telemetry storage). This helps you validate that manual overrides influence future history-based suggestions.

## Directory layout

```
Mojo/
├── src/
│   ├── algorithms/
│   │   ├── priority/     # priority scoring, tagging, suggestions & model helpers
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
