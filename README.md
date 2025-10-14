# Team MOJO Server

## Team MOJO

- Ofek - Agent & Tools
- Gal - API & Routes
- Joni - Services & DB

## Quick Start

```bash
# 1. Copy the example environment file
cp .env.example .env

# 2. Edit .env and insert your API key
# GEMINI_API_KEY=your_key_here

# 3. Install dependencies
npm install

# 4. Run the server
npm run dev
```

## Gemini API Key Setup

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Insert the key into `.env`

## Example Usage

```bash
curl -X POST http://localhost:3000/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the time?"}'
```

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/chat/message" `
  -Method POST `
  -Headers @{ "Content-Type" = "application/json" } `
  -Body '{ "message": "Hello!" }'
```
