# Team MOJO Server 🚀

## 🎯 Phase 2 Complete - User-Centric Memory System ✅

**Advanced user-centric memory and embedding system with MongoDB**

### ✨ Latest Features (Refactored)
- 🧠 **User-Centric Architecture** - All memories embedded in User documents
- � **Dynamic User Embedding** - Auto-updated based on memories and interactions
- 🔍 **Semantic Search** - Smart retrieval of relevant information
- 📊 **Memory Statistics** - Track memory usage per user
- ⚡ **High Performance** - Single query for user + all memories
- 🎯 **Priority Management** - Importance × Recency weighting

### 📚 Documentation
- **Quick Start**: [`MEMORY_QUICKSTART.md`](./MEMORY_QUICKSTART.md)
- **Full Documentation**: [`md/MEMORY_REFACTOR.md`](./md/MEMORY_REFACTOR.md)
- **Hebrew Summary**: [`md/MEMORY_REFACTOR_HE.md`](./md/MEMORY_REFACTOR_HE.md)
- **Refactor Summary**: [`REFACTOR_SUMMARY.md`](./REFACTOR_SUMMARY.md)

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
# Test new user-centric memory system
npm run test:user-memory

# Test backward compatibility
npm run test:memory

# Migrate existing data (if needed)
npm run migrate:memories
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
