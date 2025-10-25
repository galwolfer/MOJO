# Quick Start - New Memory System

## 🚀 For New Projects (No Migration Needed)

Just start using the new system - everything works out of the box!

```bash
# Install dependencies
npm install

# Start the server
npm run dev

# Test the memory system
npm run test:user-memory
```

That's it! The new user-centric memory system is active.

## 🔄 For Existing Projects (Migration Required)

If you have existing data in the old Memory/Embedding collections:

### Step 1: Backup Your Data (Recommended)
```bash
# MongoDB dump
mongodump --uri="your-mongodb-uri" --db=your-db-name --out=./backup
```

### Step 2: Run Migration
```bash
npm run migrate:memories
```

This will:
- ✅ Copy memories from Memory collection to User.memories
- ✅ Generate user-level embeddings
- ✅ Update memory statistics
- ✅ Keep old collections intact (safe!)

### Step 3: Verify
```bash
# Test the new system
npm run test:user-memory

# Start server and test chat
npm run dev
```

### Step 4: Cleanup (Optional)
After verifying everything works:

**Using MongoDB Compass:**
1. Connect to your database
2. Delete `memories` collection
3. Delete `embeddings` collection

**Using MongoDB Shell:**
```javascript
db.memories.drop()
db.embeddings.drop()
```

## 📝 Usage Examples

### Store a Memory
```javascript
import { storePrimaryMemory, storeConversationMemory } from "./src/agent/vectorStore.js";

// Store user preference (primary memory)
await storePrimaryMemory(userId, "User prefers formal communication", {
  type: "preference",
  importance: 9
});

// Store conversation info (conversation memory)
await storeConversationMemory(userId, "Discussed project timeline", {
  type: "conversation",
  importance: 6,
  sessionId: sessionId
});

// ✨ User embedding is automatically updated!
```

### Retrieve Memories
```javascript
import { retrieveRelevantMemories } from "./src/agent/vectorStore.js";

// Search for relevant memories
const memories = await retrieveRelevantMemories(userId, "What are my preferences?", 10);

console.log("Primary:", memories.primary);      // User profile/preferences
console.log("Conversation:", memories.conversation); // From past chats
console.log("All:", memories.all);              // Combined, sorted by relevance
```

### Get User Stats
```javascript
import { getUserMemoryStats, getUserEmbedding } from "./src/agent/vectorStore.js";

// Get memory statistics
const stats = await getUserMemoryStats(userId);
console.log(`Total: ${stats.totalCount} (Primary: ${stats.primaryCount}, Conversation: ${stats.conversationCount})`);

// Get user embedding
const embedding = await getUserEmbedding(userId);
console.log(`User embedding: ${embedding.length} dimensions`);
```

## 🎯 Key Concepts

### Memory Categories
- **Primary**: Profile, preferences, facts (important, long-term)
- **Conversation**: Chat history, tasks, notes (medium importance, pruned more aggressively)

### User Embedding
- Automatically calculated from all memories
- Weighted by importance and recency
- Updated on every change
- Represents user's overall profile/preferences

### Memory Limits
- Primary: 100 memories per user
- Conversation: 200 memories per user
- Lowest priority memories are pruned when limit exceeded

## 🔧 Configuration

Edit limits in `vectorStore.js`:

```javascript
// In enforceUserMemoryLimit()
const maxPrimaryMemories = 100;        // Change this
const maxConversationMemories = 200;   // Change this
```

Edit decay rate:

```javascript
// In calculatePriority()
const decayDays = 30;  // Memories lose importance over 30 days
```

## 📊 Monitoring

Check user memory status:

```javascript
import { User } from "./src/models/index.js";

const user = await User.findById(userId);
console.log("Memory Stats:", user.memoryStats);
console.log("Total Memories:", user.memories.length);
console.log("Has Embedding:", !!user.embedding);
```

## ⚠️ Troubleshooting

### Issue: Migration Script Fails
**Solution**: Check MongoDB connection in `.env` file

### Issue: User Embedding Not Updating
**Check**:
1. Are memories being added with embeddings?
2. Check console logs for "Error updating user embedding"

### Issue: Too Many Memories Being Pruned
**Solution**: Increase limits in `enforceUserMemoryLimit()`

### Issue: Server Won't Start
**Check**:
1. MongoDB is running
2. `.env` file is configured correctly
3. Run `npm install` to ensure dependencies are installed

## 🧪 Testing

```bash
# Test the memory system
npm run test:user-memory

# Test existing memory operations (backward compatibility)
npm run test:memory

# Run migration (non-destructive, can run multiple times)
npm run migrate:memories
```


## 🎉 You're Ready!

The new memory system is:
- ✅ Faster (single query per user)
- ✅ Simpler (everything in User document)
- ✅ Dynamic (user embedding updates automatically)
- ✅ Backward compatible (all old APIs still work)

Start coding! 🚀
