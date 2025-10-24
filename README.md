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
# Team MOJO Server — English README

## Phase 2 Complete — User-Centric Memory System

This repository contains the MOJO chat agent with a refactored user-centric memory and embedding system using MongoDB.

### Highlights

- User-centric architecture: all memories are embedded inside the `User` documents
- Dynamic user embeddings: auto-updated from memory embeddings
- Semantic search using cosine-similarity over embeddings
- Memory statistics per user and priority management

### Documentation

- Quick Start: `MEMORY_QUICKSTART.md`
- Memory refactor documentation: `md/MEMORY_REFACTOR.md`
- Full docs directory: `md/`

---

## Team

- Ofek — Agent & Tools
- Gal — API & Routes
- Joni — Services & DB

---

## Quick Start

```bash
# 1. Copy example environment file
cp .env.example .env

# 2. Edit .env and insert your API key and MongoDB URI
# GEMINI_API_KEY=your_key_here
# MONGO_URI=mongodb://localhost:27017/mojo

# 3. Install dependencies
npm install

# 4. Run the server
npm run dev
```

---

## Testing

```bash
# Test the user-centric memory system
npm run test:user-memory

# Migrate existing memories (if needed)
npm run migrate:memories
```

---

## Gemini API Key

1. Obtain a Gemini/Vertex AI API key (or other provider).
2. Add it to your `.env` as `GEMINI_API_KEY`.

---

## Example Usage

Chat endpoint example:

```bash
curl -X POST http://localhost:3000/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!"}'
```

PowerShell example:

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/chat/message" `
  -Method POST `
  -Headers @{ "Content-Type" = "application/json" } `
  -Body '{ "message": "Hello!" }'
```

---

## Project Structure (overview)

```
Mojo/
├── src/
│   ├── agent/            # agent logic, memory extraction, vector store
│   ├── models/           # User, Session (Memory model kept for migration)
│   ├── routes/
│   ├── controllers/
│   └── config/
├── scripts/              # admin scripts and migration helpers
├── md/                   # documentation (English)
└── README.md
```

---

## Next steps & ideas

- Add production embeddings and vector search (MongoDB Atlas)
- Improve memory consolidation (clustering, summarization)
- Add UI components and deployment flow

---

## Support

If you run into issues:

1. Check `md/` documentation
2. Run `node scripts/test_memory.js`
3. Inspect server logs

---

**Version**: Phase 2 Complete
**Status**: ✅ Ready for development
**Date**: October 21, 2025
- [ ] Deployment
