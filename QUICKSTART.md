# Quickstart — MOJO Chat Agent ⚡

This quickstart helps you get the MOJO chat agent running locally.

## Step 1 — Install (2 minutes)

```bash
# clone the repository (if you haven't already)
git clone <repository-url>
cd Mojo

# install dependencies
npm install
```

## Step 2 — Configure Gemini API (1 minute)

1. Get an API key from Google/Vertex AI (Gemini).
   - In Google AI Studio (or your provider), create or retrieve an API key.

2. Create a `.env` file and set the key:

```bash
# copy the example env
cp .env.example .env

# edit .env and add your key
GEMINI_API_KEY=your_actual_api_key_here
```

On Windows PowerShell you can copy the file with `Copy-Item .env.example .env`.

## Step 3 — Run the server (10 seconds)

```bash
npm run dev
```

You should see:

```
🚀 Server running on http://localhost:3000
```

## Step 4 — Smoke test (verify)

From another terminal, send a POST request to the chat endpoint:

```bash
curl -X POST http://localhost:3000/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!"}'
```

You should receive a JSON response from the agent.

## Quick examples

1) Ask for the time:

```bash
curl -X POST http://localhost:3000/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{"message": "What time is it?"}'
```

2) Add a task (example):

```bash
curl -X POST http://localhost:3000/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{"message": "Add task: buy milk", "userId": "user1"}'
```

3) Ask to show tasks:

```bash
curl -X POST http://localhost:3000/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{"message": "Show my tasks", "userId": "user1"}'
```

## Browser / JavaScript example

You can also call the API from browser JS (or Postman):

```javascript
fetch('http://localhost:3000/api/chat/message', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Hello MOJO!' })
})
.then(r => r.json())
.then(data => console.log(data.response));
```

## Simple HTML test UI

Create a file called `test-chat.html` and open it in a browser:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>MOJO Chat</title>
  <style>
    body { font-family: Arial; padding: 20px; }
    #messages { border: 1px solid #ccc; height: 400px; overflow-y: auto; padding: 10px; margin-bottom: 10px; }
    .message { margin: 10px 0; padding: 10px; border-radius: 5px; }
    .user { background: #e3f2fd; text-align: left; }
    .assistant { background: #f1f8e9; text-align: right; }
  </style>
</head>
<body>
  <h1>MOJO Chat</h1>
  <div id="messages"></div>
  <input id="input" placeholder="Type a message..." />
  <button id="send">Send</button>

  <script>
    const messagesDiv = document.getElementById('messages');
    const input = document.getElementById('input');
    const sendBtn = document.getElementById('send');
    let sessionId = null;

    async function sendMessage() {
      const message = input.value.trim();
      if (!message) return;
      addMessage(message, 'user');
      input.value = '';
      try {
        const res = await fetch('http://localhost:3000/api/chat/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, sessionId })
        });
        const data = await res.json();
        if (!sessionId) sessionId = data.sessionId;
        addMessage(data.response || JSON.stringify(data), 'assistant');
      } catch (err) {
        addMessage('Error: ' + err.message, 'assistant');
      }
    }

    function addMessage(text, type) {
      const div = document.createElement('div');
      div.className = `message ${type}`;
      div.textContent = text;
      messagesDiv.appendChild(div);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    sendBtn.onclick = sendMessage;
    input.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };
  </script>
</body>
</html>
```

## Troubleshooting

- `GEMINI_API_KEY is not defined` — ensure you copied `.env.example` to `.env` and set `GEMINI_API_KEY`.
- `EADDRINUSE: port 3000 already in use` — stop the previous Node process or change the port in `.env`.

Windows PowerShell example to stop node processes:

```powershell
Get-Process -Name node | Stop-Process -Force
```

## Next steps

1. Read `EXAMPLES.md` for advanced examples
2. Read `README_CHAT.md` for deeper explanation
3. Try the agent and add tasks, notes or preferences
4. Build a UI (React/Vue) or use the simple HTML test

## Need help?

- Full docs: `README_CHAT.md`
- Examples: `EXAMPLES.md`
- Problems? Open an issue

---

Good luck — enjoy building with MOJO! 🚀
