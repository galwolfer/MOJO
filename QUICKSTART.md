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

## Step 2 — Configure Environment (1 minute)

1. Get an API key from Google/Vertex AI (Gemini).
   - In Google AI Studio (or your provider), create or retrieve an API key.

2. Create a `.env` file and set the configuration:

```bash
# copy the example env
cp .env.example .env

# edit .env and add your keys
GEMINI_API_KEY=your_actual_api_key_here
MONGODB_URI=mongodb://localhost:27017/mojo
JWT_SECRET=your-secret-key-change-in-production
```

On Windows PowerShell you can copy the file with `Copy-Item .env.example .env`.

**Important:** Make sure MongoDB is running on your system!

## Step 3 — Run the server (10 seconds)

```bash
npm run dev
```

You should see:

```
🚀 Server running on http://localhost:3000
✅ Tasks Module: Enabled (Phase 4)
```

## Step 4 — Register a User (1 minute)

Before you can use the chat, you need to create an account.

### Option 1: Using PowerShell Script (Recommended)

```powershell
.\scripts\register.ps1
```

You'll be prompted for:
- Username
- Email
- Password

### Option 2: Using API Directly

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "yourname",
    "email": "you@example.com",
    "password": "your-secure-password"
  }'
```

PowerShell:
```powershell
$body = @{
    username = "yourname"
    email = "you@example.com"
    password = "your-secure-password"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/auth/register" `
  -Method POST -Headers @{"Content-Type"="application/json"} -Body $body
```

You'll receive a response with a JWT token. **Save this token!**

## Step 5 — Login (30 seconds)

### Option 1: Using PowerShell Script (Recommended)

```powershell
.\scripts\login.ps1
```

You'll be prompted for:
- Email
- Password

The script will display your JWT token. **Copy it for the next steps!**

### Option 2: Using API Directly

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "you@example.com",
    "password": "your-secure-password"
  }'
```

PowerShell:
```powershell
$body = @{
    email = "you@example.com"
    password = "your-secure-password"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" `
  -Method POST -Headers @{"Content-Type"="application/json"} -Body $body
```

Save the `token` from the response!

## Step 6 — Test the Chat (verify)

Now you can send messages to the chat. **You must include your token!**

### Option 1: Using PowerShell Script (Easiest)

```powershell
.\scripts\chat.ps1
```

This will:
1. Ask for your token (paste it)
2. Start an interactive chat session
3. You can type messages and get responses

### Option 2: Using API with Token

```bash
curl -X POST http://localhost:3000/api/chat/message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"message": "Hello!"}'
```

PowerShell:
```powershell
$token = "YOUR_TOKEN_HERE"
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}
$body = @{ message = "Hello!" } | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/chat/message" `
  -Method POST -Headers $headers -Body $body
```

You should receive a JSON response from the agent.

## Quick Examples (with Authentication)

**Note:** Replace `YOUR_TOKEN_HERE` with your actual JWT token from login!

### 1) Ask for the time:

```bash
curl -X POST http://localhost:3000/api/chat/message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"message": "What time is it?"}'
```

### 2) Add a task:

```bash
curl -X POST http://localhost:3000/api/chat/message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"message": "Add a task to buy milk tomorrow at 5pm"}'
```

### 3) Show your tasks:

```bash
curl -X POST http://localhost:3000/api/chat/message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"message": "Show me all my tasks"}'
```

### 4) Create a task directly via API:

```powershell
$token = "YOUR_TOKEN_HERE"
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}
$body = @{
    name = "Buy groceries"
    tag = "personal"
    deadline = "2025-10-26T17:00:00Z"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/tasks" `
  -Method POST -Headers $headers -Body $body
```

## Browser / JavaScript Example

You can also call the API from browser JS (or Postman).

**First, login to get a token:**

```javascript
// Login
fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'you@example.com',
    password: 'your-password'
  })
})
.then(r => r.json())
.then(data => {
  const token = data.token;
  console.log('Token:', token);
  
  // Now use the token to chat
  return fetch('http://localhost:3000/api/chat/message', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ message: 'Hello MOJO!' })
  });
})
.then(r => r.json())
.then(data => console.log('Response:', data.response));
```

## Simple HTML Test UI with Authentication

Create a file called `test-chat.html` and open it in a browser:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>MOJO Chat</title>
  <style>
    body { font-family: Arial; padding: 20px; }
    #loginForm { margin-bottom: 20px; padding: 15px; border: 1px solid #ccc; background: #f5f5f5; }
    #loginForm.hidden { display: none; }
    #chatArea.hidden { display: none; }
    #messages { border: 1px solid #ccc; height: 400px; overflow-y: auto; padding: 10px; margin-bottom: 10px; }
    .message { margin: 10px 0; padding: 10px; border-radius: 5px; }
    .user { background: #e3f2fd; text-align: left; }
    .assistant { background: #f1f8e9; text-align: right; }
    input { margin: 5px; padding: 5px; }
    button { padding: 5px 15px; margin: 5px; }
  </style>
</head>
<body>
  <h1>MOJO Chat</h1>
  
  <!-- Login Form -->
  <div id="loginForm">
    <h3>Login</h3>
    <input id="email" type="email" placeholder="Email" />
    <input id="password" type="password" placeholder="Password" />
    <button id="loginBtn">Login</button>
    <button id="registerBtn">Register</button>
    <div id="loginError" style="color: red;"></div>
  </div>

  <!-- Chat Area -->
  <div id="chatArea" class="hidden">
    <p>Logged in as: <strong id="username"></strong> <button id="logoutBtn">Logout</button></p>
    <div id="messages"></div>
    <input id="input" placeholder="Type a message..." />
    <button id="send">Send</button>
  </div>

  <script>
    const loginForm = document.getElementById('loginForm');
    const chatArea = document.getElementById('chatArea');
    const messagesDiv = document.getElementById('messages');
    const input = document.getElementById('input');
    const sendBtn = document.getElementById('send');
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const usernameSpan = document.getElementById('username');
    const loginError = document.getElementById('loginError');
    
    let token = null;
    let sessionId = null;

    // Login
    loginBtn.onclick = async () => {
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      if (!email || !password) {
        loginError.textContent = 'Please enter email and password';
        return;
      }
      
      try {
        const res = await fetch('http://localhost:3000/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        
        if (data.success) {
          token = data.token;
          usernameSpan.textContent = data.user.username;
          loginForm.classList.add('hidden');
          chatArea.classList.remove('hidden');
          loginError.textContent = '';
        } else {
          loginError.textContent = data.error || 'Login failed';
        }
      } catch (err) {
        loginError.textContent = 'Error: ' + err.message;
      }
    };

    // Register
    registerBtn.onclick = async () => {
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      if (!email || !password) {
        loginError.textContent = 'Please enter email and password';
        return;
      }
      
      const username = prompt('Enter username:');
      if (!username) return;
      
      try {
        const res = await fetch('http://localhost:3000/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, email, password })
        });
        const data = await res.json();
        
        if (data.success) {
          token = data.token;
          usernameSpan.textContent = data.user.username;
          loginForm.classList.add('hidden');
          chatArea.classList.remove('hidden');
          loginError.textContent = '';
        } else {
          loginError.textContent = data.error || 'Registration failed';
        }
      } catch (err) {
        loginError.textContent = 'Error: ' + err.message;
      }
    };

    // Logout
    logoutBtn.onclick = () => {
      token = null;
      sessionId = null;
      messagesDiv.innerHTML = '';
      loginForm.classList.remove('hidden');
      chatArea.classList.add('hidden');
      emailInput.value = '';
      passwordInput.value = '';
    };

    // Send Message
    async function sendMessage() {
      const message = input.value.trim();
      if (!message || !token) return;
      addMessage(message, 'user');
      input.value = '';
      
      try {
        const res = await fetch('http://localhost:3000/api/chat/message', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
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
    passwordInput.onkeypress = (e) => { if (e.key === 'Enter') loginBtn.click(); };
  </script>
</body>
</html>
```

## Troubleshooting

- **`GEMINI_API_KEY is not defined`** — ensure you copied `.env.example` to `.env` and set `GEMINI_API_KEY`.
- **`MongoDB connection error`** — make sure MongoDB is running (`mongod` or MongoDB service).
- **`EADDRINUSE: port 3000 already in use`** — stop the previous Node process or change the port in `.env`.
- **`No token provided`** — you forgot to include `Authorization: Bearer <token>` header. Login first!
- **`Token expired`** — login again to get a fresh token.
- **`User not found`** — check your email/password or register a new account.

Windows PowerShell example to stop node processes:

```powershell
Get-Process -Name node | Stop-Process -Force
```

Check if MongoDB is running:

```powershell
Get-Service MongoDB
# or check if mongod process is running
Get-Process mongod
```

## Next Steps

1. **Try the Tasks Module** — See `md/TASKS_QUICKSTART.md` for task management features
2. **Read Full API Docs** — Check `md/TASKS_API.md` for complete API reference
3. **Test the PowerShell Scripts**:
   - `.\scripts\chat.ps1` - Interactive chat
   - `.\scripts\test_tasks.ps1 -Token "..."` - Test tasks API
4. **Explore Examples** — See `md/TASKS_EXAMPLES.js` for code examples
5. **Build a Custom UI** — Use the HTML template above or create a React/Vue app

## Available Scripts

- `.\scripts\register.ps1` - Register a new user
- `.\scripts\login.ps1` - Login and get token
- `.\scripts\chat.ps1` - Interactive chat session
- `.\scripts\test_tasks.ps1` - Test tasks API

## Need Help?

- **Tasks Documentation**: `md/PHASE4_START_HERE.md`
- **Memory System**: `MEMORY_QUICKSTART.md`
- **Full README**: `README.md`
- **API Reference**: `md/TASKS_API.md`
- **Problems?** Open an issue on GitHub

---

Good luck — enjoy building with MOJO! 🚀
