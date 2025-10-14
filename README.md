# Team MOJO Server


## התקנה מהירה

```bash
# 1. העתק את קובץ ההגדרות
cp .env.example .env

# 2. ערוך .env והוסף את ה-API key שלך
# GEMINI_API_KEY=your_key_here

# 3. התקן dependencies
npm install

# 4. הרץ את השרת
npm run dev
```

## קבלת Gemini API Key

1. גש ל-[Google AI Studio](https://makersuite.google.com/app/apikey)
2. הוסף ל-.env

## דוגמאות שימוש

```bash
curl -X POST http://localhost:3000/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{"message": "מה השעה?"}'
```

## תיעוד מפורט

ראה [README_CHAT.md](./README_CHAT.md)

## Team MOJO

- Ofek - Agent & Tools
- Gal - API & Routes
- Joni - Services & DB
