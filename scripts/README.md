# MOJO CLI Scripts - Quick Start Guide

## 🚀 Overview

These PowerShell scripts allow you to interact with MOJO from the command line without a UI.

## 📋 Prerequisites

1. MongoDB running locally or connection string in `.env`
2. Server running (`npm run dev`)
3. PowerShell 5.1 or higher

## 🔐 Authentication Workflow

### 1. Register a New User

```powershell
.\scripts\register.ps1 -Username "yourname" -Email "your@email.com" -Password "yourpassword"
```

This will:
- Create a new user account
- Return a JWT token
- Save the token to `scripts/.token` for convenience

### 2. Login (If Already Registered)

```powershell
.\scripts\login.ps1 -Username "yourname" -Password "yourpassword"
```

This will:
- Authenticate your credentials
- Return a JWT token
- Save the token to `scripts/.token`

### 3. Send a Single Message

```powershell
# Using saved token (automatic)
.\scripts\send-message.ps1 -Message "Add a task to review the presentation"

# Or specify token explicitly
.\scripts\send-message.ps1 -Message "What's my schedule?" -Token "your-jwt-token"

# With specific session ID
.\scripts\send-message.ps1 -Message "Hello MOJO" -SessionId "my-session-123"
```

### 4. Interactive Chat Session

```powershell
.\scripts\chat.ps1
```

This starts an interactive chat where you can:
- Type messages and get responses
- Type `exit` or `quit` to end the session
- Type `clear` to clear the screen
- All messages in one session maintain context

### 5. Get Your Profile

```powershell
.\scripts\get-profile.ps1
```

Shows your user profile, tone, persona, and settings.

## 📝 Complete Example Workflow

```powershell
# Step 1: Register
.\scripts\register.ps1 -Username "ofek" -Email "ofek@example.com" -Password "securepass123"

# Step 2: Start chatting
.\scripts\chat.ps1

# In the interactive chat:
You: Add a task to review the presentation tomorrow at 2pm
MOJO: I've added the task 'review the presentation' for tomorrow at 2pm!

You: What tasks do I have?
MOJO: You have 1 task: review the presentation (tomorrow at 2pm)

You: exit
```

## 🔑 Token Management

Tokens are automatically saved to `scripts/.token` after login/register.

To manually set a token:
```powershell
$env:MOJO_TOKEN = "your-jwt-token-here"
```

Or pass it explicitly to each script:
```powershell
.\scripts\send-message.ps1 -Message "Hello" -Token "your-token"
```

## 🛠️ Advanced Usage

### Custom Server URL

```powershell
.\scripts\login.ps1 -Username "user" -Password "pass" -ServerUrl "http://your-server:3000"
```

### Send Multiple Messages (Batch)

```powershell
$messages = @(
    "Add task: Review presentation",
    "Add task: Send email to team",
    "What are my tasks?"
)

foreach ($msg in $messages) {
    .\scripts\send-message.ps1 -Message $msg
    Start-Sleep -Seconds 1
}
```

### Pipeline Usage

```powershell
# Login and immediately send a message
$token = .\scripts\login.ps1 -Username "user" -Password "pass"
.\scripts\send-message.ps1 -Message "Hello" -Token $token
```

## 📂 File Structure

```
scripts/
├── register.ps1          # Register new user
├── login.ps1             # Login existing user
├── send-message.ps1      # Send single message
├── chat.ps1              # Interactive chat session
├── get-profile.ps1       # Get user profile
└── .token               # Saved JWT token (auto-generated)
```

## 🔒 Security Notes

- Never commit `.token` files to git (already in `.gitignore`)
- Tokens expire after 7 days (configurable in server)
- Use strong passwords (minimum 6 characters)
- For production, use HTTPS URLs

## 🐛 Troubleshooting

### "No token found"
```powershell
# Solution: Login first
.\scripts\login.ps1 -Username "yourname" -Password "yourpass"
```

### "Invalid token" or "Token expired"
```powershell
# Solution: Login again to get a new token
.\scripts\login.ps1 -Username "yourname" -Password "yourpass"
```

### "Connection refused"
```powershell
# Solution: Make sure the server is running
npm run dev
```

### "User already exists"
```powershell
# Solution: Use login instead of register
.\scripts\login.ps1 -Username "yourname" -Password "yourpass"
```

## 💡 Tips

1. **Keep your session alive**: The interactive chat (`chat.ps1`) maintains context
2. **Use descriptive sessions**: Pass custom session IDs to organize conversations
3. **Check your profile**: Use `get-profile.ps1` to see your current tone and settings
4. **Batch operations**: Loop through scripts for automation
5. **Token reuse**: The saved token works across all scripts

## 🎯 Next Steps

- Try the interactive chat for natural conversations
- Experiment with different tones (friendly, professional, casual)
- Use session IDs to maintain separate conversation contexts
- Build your own scripts on top of these examples

---

**Happy Chatting! 🎉**
