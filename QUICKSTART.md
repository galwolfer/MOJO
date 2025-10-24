# מדריך התחלה מהירה - MOJO Chat Agent ⚡

## צעד 1: התקנה (2 דקות)

```bash
# שכפל את הפרויקט (אם עוד לא עשית)
git clone <repository-url>
cd Mojo

# התקן dependencies
npm install
```

## צעד 2: הגדרת Gemini API (1 דקה)

1. **קבל API Key:**
   - גש ל-[Google AI Studio](https://makersuite.google.com/app/apikey)
   - לחץ על "Get API Key" או "Create API Key"
   - העתק את המפתח

2. **הגדר את קובץ .env:**
```bash
# העתק את קובץ הדוגמה
cp .env.example .env

# פתח את .env ושנה:
GEMINI_API_KEY=your_actual_api_key_here
```

## צעד 3: הרץ את השרת (10 שניות)

```bash
npm run dev
```

אמור להופיע:
```
🚀 Server running on http://localhost:3000
```

## צעד 4: בדוק שהכל עובד ✅

פתח טרמינל חדש והרץ:

```bash
curl -X POST http://localhost:3000/api/chat/message \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"שלום!\"}"
```

אמורה להתקבל תשובה מהאגנט! 🎉

## דוגמאות מהירות

### 1. שאל מה השעה
```bash
curl -X POST http://localhost:3000/api/chat/message \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"מה השעה?\"}"
```

### 2. הוסף משימה
```bash
curl -X POST http://localhost:3000/api/chat/message \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"תוסיף משימה: לקנות חלב\", \"userId\": \"user1\"}"
```

### 3. ראה את המשימות
```bash
curl -X POST http://localhost:3000/api/chat/message \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"תראה לי את המשימות שלי\", \"userId\": \"user1\"}"
```

## בדיקה מהדפדפן

אפשר גם להשתמש ב-Postman או לשלוח בקשה מקוד JavaScript:

```javascript
// הדבק בקונסול של הדפדפן (F12)
fetch('http://localhost:3000/api/chat/message', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'שלום MOJO!'
  })
})
.then(r => r.json())
.then(data => console.log(data.response));
```

## מה הלאה?

### יצירת UI פשוט (HTML)

צור קובץ `test-chat.html`:

```html
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <title>MOJO Chat</title>
  <style>
    body { font-family: Arial; padding: 20px; }
    #messages { 
      border: 1px solid #ccc; 
      height: 400px; 
      overflow-y: auto; 
      padding: 10px; 
      margin-bottom: 10px;
    }
    .message { margin: 10px 0; padding: 10px; border-radius: 5px; }
    .user { background: #e3f2fd; text-align: left; }
    .assistant { background: #f1f8e9; text-align: right; }
    #input { width: 80%; padding: 10px; }
    #send { padding: 10px 20px; }
  </style>
</head>
<body>
  <h1>MOJO Chat 🤖</h1>
  <div id="messages"></div>
  <input type="text" id="input" placeholder="כתוב הודעה...">
  <button id="send">שלח</button>

  <script>
    const messagesDiv = document.getElementById('messages');
    const input = document.getElementById('input');
    const sendBtn = document.getElementById('send');
    let sessionId = null;

    async function sendMessage() {
      const message = input.value.trim();
      if (!message) return;

      // הצג הודעת משתמש
      addMessage(message, 'user');
      input.value = '';

      try {
        const response = await fetch('http://localhost:3000/api/chat/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, sessionId })
        });

        const data = await response.json();
        
        // שמור session ID
        if (!sessionId) sessionId = data.sessionId;
        
        // הצג תשובה
        addMessage(data.response, 'assistant');
      } catch (error) {
        addMessage('שגיאה: ' + error.message, 'assistant');
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
    input.onkeypress = (e) => {
      if (e.key === 'Enter') sendMessage();
    };
  </script>
</body>
</html>
```

פתח את הקובץ בדפדפן ותוכל לדבר עם האגנט! 💬

## פתרון בעיות נפוצות

### שגיאה: "GEMINI_API_KEY is not defined"
✅ ודא שהעתקת את `.env.example` ל-`.env` ועדכנת את המפתח

### שגיאה: "EADDRINUSE: port 3000 already in use"
✅ הרוג את התהליך הקודם:
```bash
# Windows PowerShell
Get-Process -Name node | Stop-Process -Force

# או שנה את הפורט ב-.env
PORT=3001
```

### השרת לא מגיב
✅ בדוק ש-`npm run dev` רץ ללא שגיאות

### תשובות לא בעברית
✅ זה תלוי במודל - Gemini אמור לתמוך בעברית היטב

## שלבים הבאים

1. ✅ קרא את [EXAMPLES.md](./EXAMPLES.md) לדוגמאות מתקדמות
2. ✅ קרא את [README_CHAT.md](./README_CHAT.md) להבנה מעמיקה
3. ✅ התחל לשחק עם הכלים - הוסף משימות, הערות ועוד
4. ✅ נסה ליצור UI משלך או להשתמש ב-React/Vue

## זקוק לעזרה?

- 📖 [תיעוד מלא](./README_CHAT.md)
- 💡 [דוגמאות](./EXAMPLES.md)
- 🐛 בעיות? פתח issue

---

**מוכן להתחיל? בהצלחה! 🚀**
