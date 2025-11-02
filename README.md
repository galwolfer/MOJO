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
