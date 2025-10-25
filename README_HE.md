# שרת MOJO 🚀

## 🎯 עדכונים אחרונים

### Phase 4 הושלם - מערכת ניהול משימות ✅
- 🎯 **ניהול משימות** - פעולות CRUD מלאות
- 🤖 **אינטגרציה LLM** - יצירת משימות בשפה טבעית
- 🔐 **מאובטח ומבודד** - אימות JWT עם נתונים לכל משתמש
- 📝 **API עשיר** - 8 endpoints עם פילטרים ושאילתות

### Phase 2 הושלם - מערכת זיכרון מרכזית ✅
- 🧠 **ארכיטקטורה ממוקדת משתמש** - כל הזיכרונות משובצים במסמכי User
- 🔍 **Embedding דינמי** - מתעדכן אוטומטית על בסיס זיכרונות
- 🔍 **חיפוש סמנטי** - שליפה חכמה של מידע רלוונטי
- 📊 **סטטיסטיקות זיכרון** - מעקב אחר שימוש בזיכרון לכל משתמש
- ⚡ **ביצועים גבוהים** - שאילתה אחת למשתמש + כל הזיכרונות

---

## הקמה מהירה (5 דקות)

### 1. התקן תלויות
```bash
npm install
```

### 2. הגדר סביבה
```bash
# העתק קובץ דוגמה
cp .env.example .env

# ערוך .env והגדר:
# GEMINI_API_KEY=your_key_here
# MONGODB_URI=mongodb://localhost:27017/mojo
# JWT_SECRET=your-secret-key-change-in-production
```

**חשוב:** וודא ש-MongoDB רץ!

### 3. הרץ את השרת
```bash
npm run dev
```

אתה אמור לראות:
```
🚀 Server running on http://localhost:3000
✅ Tasks Module: Enabled (Phase 4)
```

### 4. הירשם כמשתמש

**אפשרות 1: סקריפט PowerShell (מומלץ)**
```powershell
.\scripts\register.ps1
```

יתבקש ממך:
- שם משתמש
- אימייל
- סיסמה

**אפשרות 2: קריאת API ישירה**
```powershell
$body = @{
    username = "yourname"
    email = "you@example.com"
    password = "your-secure-password"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/auth/register" `
  -Method POST -Headers @{"Content-Type"="application/json"} -Body $body
```

### 5. התחבר

**אפשרות 1: סקריפט PowerShell (מומלץ)**
```powershell
.\scripts\login.ps1
```

**העתק את הטוקן מהתשובה!**

### 6. התחל לשוחח!

**צ'אט אינטראקטיבי (הכי קל)**
```powershell
.\scripts\chat.ps1
```

**או השתמש ב-API ישירות:**
```powershell
$token = "YOUR_TOKEN_HERE"
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}
$body = @{
    message = "תוסיף לי משימה ללמוד למבחן ביום שישי הבא"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/chat/message" `
  -Method POST -Headers $headers -Body $body
```

---

## תכונות עיקריות

### 🎯 ניהול משימות (Phase 4)
- יצירה, קריאה, עדכון ומחיקה של משימות
- יצירת משימות בשפה טבעית דרך LLM
- ארגון לפי תגיות (tags)
- מעקב אחר תאריכי יעד (קרובים/באיחור)
- בידוד מלא של נתונים לכל משתמש

**דוגמה:**
```
משתמש: "תוסיף לי משימה לעשות שיעורי בית באלגברה ליניארית לעוד שבוע"
Agent: יוצר משימה עם תאריך יעד מחושב
```

### 🧠 מערכת זיכרון (Phase 2)
- אחסון זיכרון ממוקד משתמש
- חיפוש סמנטי עם embeddings
- חילוץ אוטומטי של זיכרונות משיחות
- שליפה מבוססת עדיפות

### 🔐 אימות
- אימות מבוסס JWT
- הצפנת סיסמאות (bcrypt)
- בידוד נתונים לכל משתמש
- גישה לAPI מבוססת טוקן

---

## API Endpoints

### אימות
- `POST /api/auth/register` - רישום משתמש חדש
- `POST /api/auth/login` - התחברות וקבלת JWT token

### צ'אט
- `POST /api/chat/message` - שליחת הודעה לagent (דורש אימות)
- `POST /api/chat/reset` - איפוס session
- `GET /api/chat/history/:sessionId` - קבלת היסטוריית צ'אט

### משימות (Phase 4)
- `POST /api/tasks` - יצירת משימה
- `GET /api/tasks` - רשימת משימות (עם פילטרים)
- `GET /api/tasks/:id` - קבלת משימה ספציפית
- `PATCH /api/tasks/:id` - עדכון משימה
- `DELETE /api/tasks/:id` - מחיקת משימה
- `GET /api/tasks/upcoming/:days` - משימות קרובות
- `GET /api/tasks/overdue` - משימות באיחור
- `POST /api/tasks/:id/toggle` - החלפת סטטוס השלמה

**כל ה-endpoints שדורשים אימות צריכים:**
```
Authorization: Bearer <your-jwt-token>
```

---

## סקריפטים שימושיים

סקריפטים נוחים לפעולות נפוצות:

- **`.\scripts\register.ps1`** - רישום משתמש חדש
- **`.\scripts\login.ps1`** - התחברות וקבלת טוקן
- **`.\scripts\chat.ps1`** - צ'אט אינטראקטיבי
- **`.\scripts\test_tasks.ps1`** - בדיקת Tasks API

---

## דוגמאות שימוש

### רישום והתחברות
```powershell
# רישום
.\scripts\register.ps1

# התחברות (קבלת טוקן)
.\scripts\login.ps1
```

### צ'אט עם ה-Agent
```powershell
.\scripts\chat.ps1
# ואז כתוב: "תוסיף לי משימה לקנות חלב מחר"
```

### קריאות API ישירות
```powershell
# הגדר את הטוקן שלך
$token = "YOUR_JWT_TOKEN"
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# צור משימה
$body = @{
    name = "ללמוד למבחן"
    tag = "school"
    deadline = "2025-11-01T12:00:00Z"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/tasks" `
  -Method POST -Headers $headers -Body $body

# קבל את כל המשימות
Invoke-RestMethod -Uri "http://localhost:3000/api/tasks" `
  -Method GET -Headers $headers
```

### דוגמאות בשפה טבעית

נסה את הפקודות האלה:
- "תוסיף לי משימה ללמוד למבחן ביום שישי הבא"
- "תראה לי את כל המשימות שלי"
- "איזה משימות יש לי לבית הספר?"
- "מה יוצא השבוע?"
- "יש לי משימות באיחור?"
- "סמן את המשימה של המבחן כמושלמת"

---

## בדיקות

### בדיקת מודול המשימות
```powershell
# קבל טוקן קודם
.\scripts\login.ps1

# הרץ בדיקות אוטומטיות
.\scripts\test_tasks.ps1 -Token "YOUR_TOKEN"
```

### בדיקת מערכת הזיכרון
```bash
npm run test:user-memory
```

---

## פתרון בעיות נפוצות

**"MongoDB connection error"**
- וודא ש-MongoDB רץ: `mongod` או הפעל את שירות MongoDB
- בדוק את `MONGODB_URI` ב-`.env`

**"No token provided"**
- צריך להתחבר קודם: `.\scripts\login.ps1`
- כלול את הטוקן ב-header: `Authorization: Bearer <token>`

**"Invalid token"**
- הטוקן אולי פג תוקף, התחבר שוב
- בדוק שאתה משתמש בטוקן הנכון

**"GEMINI_API_KEY is not defined"**
- צור קובץ `.env` מ-`.env.example`
- הוסף את מפתח Gemini API שלך

**"Port 3000 already in use"**
- עצור תהליכי Node קיימים: `Get-Process -Name node | Stop-Process -Force`
- או שנה את `PORT` ב-`.env`

---

## תיעוד

### מדריכי התחלה מהירה
- **מדריך ראשי**: [`QUICKSTART.md`](./QUICKSTART.md) 👈 התחל כאן
- **מערכת זיכרון**: [`MEMORY_QUICKSTART.md`](./MEMORY_QUICKSTART.md)
- **מודול משימות**: [`md/TASKS_QUICKSTART.md`](./md/TASKS_QUICKSTART.md)

### תיעוד מלא
- **תיעוד Tasks API**: [`md/TASKS_API.md`](./md/TASKS_API.md)
- **סקירה Tasks**: [`md/TASKS_README.md`](./md/TASKS_README.md)
- **סיכום Phase 4**: [`md/PHASE4_START_HERE.md`](./md/PHASE4_START_HERE.md)
- **כל התיעוד**: תיקייה [`md/`](./md/)

### דוגמאות קוד
- **דוגמאות Tasks**: [`md/TASKS_EXAMPLES.js`](./md/TASKS_EXAMPLES.js)
- **סקריפט בדיקה**: [`scripts/test_tasks.ps1`](./scripts/test_tasks.ps1)

---

## מבנה הפרויקט

```
Mojo/
├── src/
│   ├── agent/              # לוגיקת Agent, כלים, חילוץ זיכרון
│   ├── models/             # מודלים MongoDB
│   │   ├── User.js         # משתמש עם זיכרונות משובצים
│   │   ├── Task.js         # מודל משימות (Phase 4)
│   │   └── Session.js
│   ├── services/           # לוגיקה עסקית
│   ├── controllers/        # HTTP handlers
│   ├── routes/             # API routes
│   ├── middlewares/        # Express middlewares
│   └── config/             # הגדרות
├── scripts/                # סקריפטים עוזרים
│   ├── register.ps1        # רישום משתמש
│   ├── login.ps1           # התחברות
│   ├── chat.ps1            # צ'אט אינטראקטיבי
│   └── test_tasks.ps1      # בדיקות Tasks API
├── md/                     # תיעוד
└── README.md               # README באנגלית
```

---

## גרסאות

- **Phase 4** (אוקטובר 2025) - מערכת ניהול משימות עם אינטגרציית LLM
- **Phase 2** (אוקטובר 2025) - ארכיטקטורת זיכרון ממוקדת משתמש
- **Phase 1** (אוקטובר 2025) - Agent צ'אט ראשוני עם זיכרון בסיסי

---

**גרסה**: Phase 4 מושלם
**סטטוס**: ✅ מוכן לייצור
**עדכון אחרון**: 25 באוקטובר 2025

---

**נבנה באהבה ❤️ על ידי Team MOJO**

*מודולרי. מאובטח. חכם.*
