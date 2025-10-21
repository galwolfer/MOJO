# 🚀 Quick Start — MOJO with MongoDB & Authentication

This quick start will get you a running MOJO server (local MongoDB), create a user, and show how to send messages from the PowerShell CLI.

Prerequisites
- Node.js (16+)
- MongoDB running locally or a MongoDB Atlas connection string

1) Configure environment

Create a `.env` file in the project root with values similar to:

```bash
# MongoDB connection (local example)
MONGODB_URI=mongodb://localhost:27017/mojo

# Authentication
JWT_SECRET=replace-with-a-secure-secret

# Gemini (optional)
GEMINI_API_KEY=your_gemini_api_key_here

# Server
PORT=3000
```

2) Start the server

Run in PowerShell:

```powershell
npm run dev
```

You should see logs like:

```
✅ MongoDB connected successfully
[LOG] HTTP server listening on http://localhost:3000
✅ Vector store initialized
```

3) Register a user

Register a new user (this prints a JWT and saves it to `scripts/.token`):

```powershell
.\scripts\register.ps1 -Username "ofek" -Email "ofek@example.com" -Password "123456"
```

If the user already exists, use the login command below.

4) Login (if needed)

Login will produce and save a JWT to `scripts/.token` as well:

```powershell
.\scripts\login.ps1 -Username "ofek" -Password "123456"
```

5) Send a single message (CLI)

Send a one-time message to the server (uses the token saved in `scripts/.token`):

```powershell
.\scripts\send-message.ps1 -Message "Hello from CLI!"
```

6) Start interactive chat session

For an interactive chat (like a chat room), run:

```powershell
.\scripts\chat.ps1
```

This will:
- Load your token from `scripts/.token`
- Create a persistent chat session
- Let you send messages and receive MOJO's replies in a loop
- Type `exit` or `quit` to end the session

Example interaction:
```
You: Hello, who are you?
MOJO: Hi! I'm MOJO, your AI assistant...

You: Add a task to review the presentation tomorrow at 2pm
MOJO: I've added the task...

You: exit
Goodbye!
```

7) Continue with other commands

```powershell
.\scripts\chat.ps1
```

Useful commands

- Show saved token (if any):
```powershell
Get-Content .\scripts\.token
```
- Send single message:
```powershell
.\scripts\send-message.ps1 -Message "What's the weather like?"
```
- View profile:
```powershell
.\scripts\get-profile.ps1
```

Troubleshooting

- "MongoDB connection failed": verify MongoDB is running and the `MONGODB_URI` in `.env` is correct.
- "No token found": run `.\scripts\login.ps1` or `.\scripts\register.ps1` first — they save a token to `scripts/.token`.
- "User already exists": use `.\scripts\login.ps1` instead of `register`.

Next steps

1. Try all CLI commands
2. Inspect data with MongoDB Compass (refresh collections view if empty)
3. Build a UI on top of the API
4. Add external data sources
5. Deploy to the cloud

That's it — you're ready to use MOJO locally.

