# Team MOJO Server 🚀

## 🎯 Phase 2 Complete - Memory & Embedding System ✅

**מערכת זיכרון ואינדקס סמנטי מתקדמת מוטמעת ב-MongoDB**

### ✨ תכונות חדשות
- 🧠 **זיכרון ראשי** - העדפות ועובדות על המשתמש
- 💬 **זיכרון שיחות** - מידע חשוב מהשיחות הקודמות
- 🔍 **חיפוש סמנטי** - מציאת מידע רלוונטי באופן חכם
- 🤖 **הפקה אוטומטית** - זיהוי ושמירת מידע חשוב אוטומטית
- ⚡ **ביצועים גבוהים** - embeddings מוטמעים ב-MongoDB

📚 **קרא את המדריך המלא**: [`md/MEMORY_EMBEDDING_SYSTEM.md`](./md/MEMORY_EMBEDDING_SYSTEM.md)

---

## Team MOJO

- **Ofek** - Agent & Tools
- **Gal** - API & Routes
- **Joni** - Services & DB

---

## Quick Start

```bash
# 1. Copy the example environment file
cp .env.example .env

# 2. Edit .env and insert your API key
# GEMINI_API_KEY=your_key_here
# MONGODB_URI=mongodb://localhost:27017/mojo

# 3. Install dependencies
npm install

# 4. Run the server
npm run dev
```

---

## 🧪 Testing the Memory System

```bash
# Run memory system tests
node scripts/test_memory.js
```

Or with PowerShell:
```powershell
.\scripts\test_memory.ps1
```

---

## Gemini API Key Setup

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Insert the key into `.env`

---

## Example Usage

### Chat with Memory

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

---

## 📚 Documentation

- **[Memory & Embedding System](./md/MEMORY_EMBEDDING_SYSTEM.md)** - מדריך מלא בעברית
- **[Memory Update](./md/MEMORY_UPDATE.md)** - סיכום השינויים
- **[Implementation Summary](./md/IMPLEMENTATION_SUMMARY.md)** - סיכום טכני
- **[Phase 2 Spec](./md/phase2.md)** - מפרט Phase 2

---

## 🎯 Features

### Phase 1 ✅
- Express.js server with MongoDB
- Gemini API integration
- Basic chat functionality
- User authentication & sessions
- Tool functions (tasks, notes, time)

### Phase 2 ✅ NEW!
- **Persistent memory with embeddings**
- **Semantic search** (cosine similarity)
- **Memory categories**: Primary (profile, preferences) + Conversation
- **Auto-extraction** of important information
- **Context-aware responses**
- **Memory pruning** for old conversations

---

## 🏗️ Project Structure

```
Mojo/
├── src/
│   ├── agent/
│   │   ├── agentController.js      # Main agent logic + memory integration ✨
│   │   ├── geminiAdapter.js        # Gemini API adapter
│   │   ├── memoryStore.js          # (deprecated)
│   │   ├── mongoMemoryStore.js     # MongoDB memory management ✨
│   │   ├── vectorStore.js          # Embedding & semantic search ✨
│   │   ├── memoryExtractor.js      # Auto memory extraction ✨ NEW!
│   │   ├── prompts.js              # System prompts with memory ✨
│   │   └── toolFunctions.js        # Tool definitions
│   ├── models/
│   │   ├── Memory.js               # Memory model with embeddings ✨
│   │   ├── Embedding.js            # (deprecated)
│   │   ├── User.js
│   │   └── Session.js
│   ├── routes/
│   ├── controllers/
│   └── config/
├── scripts/
│   ├── test_memory.js              # Memory system tests ✨ NEW!
│   └── test_memory.ps1             # PowerShell test runner ✨ NEW!
├── md/
│   ├── MEMORY_EMBEDDING_SYSTEM.md  # Full documentation ✨ NEW!
│   ├── MEMORY_UPDATE.md            # Update summary ✨ NEW!
│   └── IMPLEMENTATION_SUMMARY.md   # Technical summary ✨ NEW!
└── README.md
```

---

## 🚀 Next Steps (Optional)

### Phase 2.1
- [ ] Gemini Embeddings API (768 dimensions)
- [ ] MongoDB Atlas Vector Search
- [ ] Smart context pruning

### Phase 3
- [ ] UI widgets
- [ ] Full automation
- [ ] Deployment

---

## 📞 Support

בעיות? שאלות?
1. קרא את [`md/MEMORY_EMBEDDING_SYSTEM.md`](./md/MEMORY_EMBEDDING_SYSTEM.md)
2. הרץ `node scripts/test_memory.js`
3. בדוק את הלוגים

---

**Version**: Phase 2 Complete  
**Status**: ✅ Production Ready  
**Date**: October 21, 2025
