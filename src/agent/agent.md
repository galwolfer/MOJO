# 🤖 MOJO Agent System - Complete Architecture Guide

## Overview

The **MOJO Agent System** is the intelligent core of the application. It orchestrates conversations, manages memory, executes tools, and provides an adaptive, personalized experience for each user.

This document provides a comprehensive understanding of:
- **What each file does**
- **How they work together**
- **The complete message flow**
- **Key concepts and design patterns**

---

## 📁 File Structure & Responsibilities

### 1. **agentController.js** - The Orchestrator
**Purpose:** Central coordinator that manages the entire message processing pipeline

**Key Responsibilities:**
- Save user messages to MongoDB
- Load user profile and conversation history
- Retrieve semantically relevant memories
- Build personalized system prompts
- Manage the LLM agent loop (up to 3 iterations)
- Execute tools when the LLM requests them
- Save assistant responses

**Main Method:** `processMessage(sessionId, userMessage, userId)`

**Flow Within:**
```
1. Save user message
2. Load conversation history & user profile
3. Retrieve relevant memories using semantic search
4. Build personalized system prompt
5. AGENT LOOP (max 3 iterations):
   - Invoke LLM with tools
   - If tool calls → execute them → loop back
   - If no tool calls → return response
6. Save assistant response
7. Return result to caller
```

**Key Features:**
- **Semantic Memory Retrieval:** Uses vector embeddings to find relevant past information
- **Context Management:** Limits history to last 10 messages to save tokens
- **Tool Binding:** LLM has access to 10+ tools for actions (memory, tasks, time)
- **MAX_TOKENS Handling:** Gracefully retries with shorter prompts if model hits token limit

---

### 2. **langchainTools.js** - LLM Actions
**Purpose:** Defines all the tools/functions that the LLM can call

**Factory Function:** `createLangChainTools(userId)`

**Tool Categories:**

#### 📝 Memory Tools
- **`save_user_fact`** - Store personal facts (name, location, education, work, skills)
  - User facts are PRIMARY MEMORY (high importance: 7-10)
  - Stored with embeddings for semantic search
  
- **`save_conversation_note`** - Store important discussion points
  - Conversation memories are CONTEXTUAL (lower importance: 1-6)
  - Help recall what was discussed if conversation resumes
  
- **`search_memories`** - Semantic search through all saved memories
  - Can search PRIMARY, CONVERSATION, or ALL categories
  - Returns top 5 matching memories with similarity scores

#### ✅ Task Tools
- **`add_task`** - Create tasks with deadline and optional recurrence
  - Automatically calculates ISO dates from relative expressions ("tomorrow", "next Monday")
  - Supports recurring patterns (daily, weekly, monthly)
  
- **`get_tasks`** - Retrieve tasks with filters (tag, completion status, date range)
- **`update_task`** - Modify task details
- **`delete_task`** - Permanently remove a task
- **`get_upcoming_tasks`** - Get tasks due within N days
- **`get_overdue_tasks`** - Get incomplete tasks past deadline

#### ⏰ Time Tools
- **`get_current_time`** - Returns current date/time/timestamp
  - Used by LLM for date calculations and context

**Tool Response Format:** TOML-like structured text
```
ok=true/false
msg="Success or error message"
id="resource_id"
count=N
```

---

### 3. **prompts.js** - LLM Behavior Configuration
**Purpose:** Defines system prompts that guide the LLM's behavior

**Key Concepts:**

**Base System Prompt (`SYSTEM_PROMPT`)**
- Defines MOJO's identity and capabilities
- Specifies response format and language rules
- Documents how to use tools
- Provides date/time formatting rules

**Personalization Layers:**

1. **User Identification**
   - User ID and name injected into prompt
   - Allows tools to be bound to correct user
   
2. **Personality Settings**
   - **Tone:** friendly, professional, casual, formal, enthusiastic
   - **Persona:** Optional roleplay (e.g., "act as a productivity coach")
   - Maps tones to descriptive language for better LLM understanding
   
3. **Memory Context**
   - Recent relevant memories automatically injected
   - Compact format (max 200 chars) to save tokens
   - LLM can use `search_memories` tool for deeper recall

**Function:** `buildSystemPromptWithUserContext(userProfile, userId, memoryContext)`

---

### 4. **vectorStore.js** - Semantic Memory Search
**Purpose:** Implements vector-based memory storage and similarity search

**Core Concepts:**

**What is a Vector?**
- A 128-dimensional array of numbers representing text meaning
- Similar texts have similar vectors
- Similarity calculated using cosine similarity (0 to 1 scale)

**Memory Storage Structure:**
```javascript
User.memories = [
  {
    text: "works at Google as software engineer",
    embedding: [0.12, 0.45, ..., 0.88],  // 128D vector
    type: "user_fact" | "preference" | "profile" | "conversation",
    importance: 1-10,
    timestamp: Date,
    metadata: { source: "llm_tool", category: "work" }
  },
  ...
]
```

**Key Functions:**

1. **`normalizeTextForEmbedding(text)`**
   - Removes stop words ("the", "a", "is", etc.)
   - Keeps only meaningful keywords
   - Improves semantic matching quality
   
2. **`generateDeterministicVector(text, dim=128)`**
   - Converts text to fixed-size numeric vector
   - Currently: Fast local implementation (no API calls)
   - TODO: Replace with Google Embeddings API for production
   
3. **`cosineSimilarity(vecA, vecB)`**
   - Measures how similar two vectors are
   - Result: 0-1 scale (1 = identical, 0 = opposite)
   - Fast calculation: just dot product + normalization
   
4. **`updateUserEmbedding(userId)`**
   - Creates weighted average of all user's memories
   - Provides overall "user profile" vector
   - Uses importance scores as weights

**Memory Retrieval Strategy:**
```
User message: "Where do you work?"
         ↓
   Generate embedding for query
         ↓
   Compare against all user memories using cosine similarity
         ↓
   Sort by similarity score
         ↓
   Return top 5 memories
```

---

### 5. **geminiAdapter.js** - LLM API Adapter
**Purpose:** Low-level communication with Google Gemini API

**Note:** This adapter is maintained for compatibility. The system primarily uses LangChain's `ChatGoogleGenerativeAI` wrapper instead.

**Key Functions:**

1. **`generateContent(messages, tools)`**
   - Sends request to Gemini API with conversation history
   - Includes tool definitions for function calling
   - Receives candidates (possible responses) from model
   - Handles MAX_TOKENS finish reason gracefully

2. **`convertMessagesToGeminiFormat(messages)`**
   - Converts LangChain message format to Gemini API format
   - Handles role mapping (system→user, user→user, assistant→model)
   - Processes function calls and responses

3. **`extractResponse(geminiResponse)`**
   - Parses Gemini's nested response structure
   - Safely navigates optional nested objects
   - Returns: `{ type: "text" | "function_call" | "max_tokens", ... }`
   - Logs full response for debugging if structure is unexpected

**Generation Settings:**
- Temperature: 0.7 (moderate randomness)
- Max Output Tokens: 768 (balanced length)
- Top-K: 40 (nucleus sampling)
- Top-P: 0.95 (cumulative probability)

---

## 🔄 Complete Message Flow Diagram

```
┌────────────────┐
│  User sends    │
│    message     │
└────────┬───────┘
         │
         ▼
┌─────────────────────────────────────────┐
│      CHAT CONTROLLER                    │
│  • Extract: message, sessionId, userId  │
│  • Call: agent.processMessage()         │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│           AGENT CONTROLLER.processMessage()             │
│                                                         │
│ STEP 1: Save User Message                             │
│ └→ MongoDB: Session.messages.push(user_message)       │
│                                                         │
│ STEP 2: Load Context                                  │
│ ├→ Get conversation history (last 10 messages)        │
│ └→ Load user profile (name, tone, persona)            │
│                                                         │
│ STEP 3: Semantic Memory Retrieval                     │
│ ├→ Generate embedding for user message               │
│ ├→ Compare against User.memories vectors             │
│ ├→ Get top 5 similar memories (by cosine similarity) │
│ └→ Format for injection into prompt                   │
│                                                         │
│ STEP 4: Build Personalized System Prompt             │
│ ├→ Base rules & capabilities                         │
│ ├→ User personality (tone, persona)                  │
│ ├→ User identification                               │
│ └→ Memory context (relevant facts)                   │
│                                                         │
│ STEP 5: Create LangChain Tools                       │
│ ├→ Memory tools (save_fact, save_note, search)      │
│ ├→ Task tools (add, get, update, delete)            │
│ └→ Time tool (current_time)                          │
│                                                         │
│ STEP 6: Agent Loop (max 3 iterations)                │
│ ┌───────────────────────────────────────┐            │
│ │ Invoke LLM with tools                 │            │
│ │                                       │            │
│ │ Response has tool_calls?              │            │
│ │ YES → Execute → Add results → Loop   │            │
│ │ NO  → This is final response → Exit  │            │
│ └───────────────────────────────────────┘            │
│                                                         │
│ STEP 7: Save Assistant Response                      │
│ └→ MongoDB: Session.messages.push(assistant_response)│
│                                                         │
│ STEP 8: Return to Chat Controller                    │
│ └→ { success, response, sessionId, messageCount }    │
│                                                         │
└────────┬────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────┐
│ CHAT CONTROLLER      │
│ Return JSON response │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│   Client/UI          │
│ Display response     │
└──────────────────────┘
```

---

## 🛠️ Tool Execution Flow

When the LLM decides to use a tool:

```
LLM Response: "I'll save that for you"
with tool_call: { name: "save_user_fact", args: { fact: "...", ... } }
         │
         ▼
Find tool in tools array by name
         │
         ▼
Execute: tool.func(args)
         │
         ├─ Success? → Return result
         └─ Error?   → Catch, return error message
         │
         ▼
Add tool result to message history:
{
  role: "tool",
  content: "ok=true\nmsg=...",
  tool_call_id: "..."
}
         │
         ▼
Invoke LLM again with new message history
(LLM can use tool results to inform next response)
```

---

## 💾 Data Flow: Memory Management

### Saving a Memory

```
User: "I study at Bar Ilan University"
         │
         ▼
LLM decides: "I should save this fact"
Calls: save_user_fact({
  fact: "studies at Bar Ilan",
  category: "education",
  importance: 8
})
         │
         ▼
memoryStore.savePrimaryMemory()
         │
         ├─ Generate embedding vector for text
         ├─ Determine memory type: "profile"
         └─ Create memory object with:
            - text
            - embedding (128D vector)
            - type
            - importance
            - timestamp
            - metadata
         │
         ▼
User.memories.push(memoryObject)
Save to MongoDB
         │
         ▼
Update user's overall embedding
(weighted average of all memories)
```

### Retrieving Memories

```
User message: "Tell me about myself"
         │
         ▼
memoryStore.retrieveRelevantMemories(userId, message, topN=5)
         │
         ├─ Generate embedding for user message
         ├─ Load all User.memories from MongoDB
         └─ Compare message embedding vs each memory embedding
            using cosineSimilarity()
         │
         ▼
Sort memories by similarity score (highest first)
         │
         ▼
Return top 5 memories as:
{
  primary: [...],      // User facts
  conversation: [...], // Discussion notes
  all: [...]          // Combined
}
         │
         ▼
Format for system prompt (compact 200 chars max)
         │
         ▼
Inject into prompt: "Memory: studies at Bar Ilan; works at Google; ..."
```

---

## 🧠 Memory Types & Importance

### Primary Memory (User Facts)
- **What:** Profile information, education, work, preferences, skills
- **Importance:** 7-10 (high - stable facts about user)
- **Lifespan:** Long-term (rarely change)
- **Example:** "works at Google", "speaks Hebrew and English", "prefers morning meetings"

### Conversation Memory (Contextual)
- **What:** Decisions made, plans discussed, topics covered in this conversation
- **Importance:** 1-6 (lower - specific to conversation)
- **Lifespan:** Session-specific (may expire after conversation ends)
- **Example:** "user wants to finish report by Friday", "discussed Q4 goals"

### Retrieval Strategy
- Always try to retrieve both types
- Weight by importance during embedding comparisons
- Let LLM use `search_memories` tool for deeper recall when needed
- Inject compact summary into system prompt for quick access

---

## 🔌 Integration Points

### With Chat Controller
```javascript
// Chat controller calls:
await agent.processMessage(sessionId, userMessage, userId)

// Returns:
{
  success: true,
  response: "Assistant's response text",
  sessionId: "...",
  messageCount: 42
}
```

### With Memory Service
- Saves/loads conversation history
- Stores/retrieves memories with embeddings
- Updates user-level aggregated embedding

### With Task Service
- Creates, updates, deletes tasks
- Retrieves tasks with various filters
- Calculates task deadlines and recurrence

### With Google Gemini API
- Sends conversation + tools to LLM
- Receives responses with optional tool calls
- Handles MAX_TOKENS errors gracefully

---

## 🎯 Key Design Patterns

### 1. **Semantic Similarity Search**
Instead of keyword matching, memories are found by MEANING.
```
"I work at Google" and "Where do you work?" → Matched because semantically similar
```

### 2. **Weighted Importance**
Memories with higher importance scores are prioritized.
```
Fact (importance: 8) > Conversation note (importance: 4)
```

### 3. **Graceful Token Management**
System handles token limits intelligently:
- Limits history to last 10 messages
- Truncates memory context to 200 chars
- Retries with "be brief" instruction on MAX_TOKENS

### 4. **Tool-Based Autonomy**
LLM decides what to save, when to search, what to update.
```
LLM: "I'll save that fact" → Calls save_user_fact tool
LLM: "Let me search for related info" → Calls search_memories tool
```

### 5. **Layered Personalization**
Three levels of customization:
1. Base behavior (SYSTEM_PROMPT)
2. User preferences (tone, persona)
3. Relevant context (memory injection)

---

## 🚀 Performance Optimizations

1. **Embedding Vectors**
   - 128D vectors (balance precision/speed)
   - Deterministic generation (fast, no API calls)
   - Cached in User document

2. **Memory Retrieval**
   - Limits to top 5 most relevant
   - Only compares at query time (lazy evaluation)
   - Compact text format for prompt injection

3. **Conversation History**
   - Keeps only last 10 messages
   - Older context replaced by memory summaries
   - Saves tokens without losing context

4. **Tool Execution**
   - Sequential execution (one tool at a time)
   - Results fed back to LLM immediately
   - Loop exits when no more tool calls

---

## 🔐 Security & Validation

- **User Scoping:** All operations bound to userId
- **Input Validation:** Zod schemas for all tool inputs
- **Error Handling:** Comprehensive try-catch blocks
- **Logging:** Detailed console logs for debugging
- **Token Limits:** Graceful handling of token overflow

---

## 🐛 Debugging Tips

1. **Check Agent Logs:**
   ```
   [AgentController] Processing message for user: ...
   [AgentController] Retrieving relevant memories...
   [AgentController] Agent loop iteration X/3
   [AgentController] Tool calls requested: N
   ```

2. **Verify Memory Retrieval:**
   - Check similarity scores in logs
   - Verify memory context was injected into prompt
   - Use `search_memories` tool to test

3. **Tool Execution Issues:**
   - Check tool response format (TOML-like)
   - Verify `ok=true/false` in responses
   - Look for error messages in tool results

4. **LLM Response Quality:**
   - Check system prompt content
   - Verify user personality settings applied
   - Look at what memories were injected

---

## 📚 Related Documentation

- **MESSAGE_FLOW.md** - Detailed message flow diagrams
- **MEMORY_EMBEDDING_SYSTEM.md** - Vector embedding details
- **TASKS_README.md** - Task management specifics

---

## 🧩 Refactor Notes & Guidelines

This section consolidates the agent refactor guidance and single-source-of-truth rules introduced during the recent changes. Edit instructions and widget schemas in one place to keep behavior consistent.

**Key files**
- `agentConfig.js` — Central place for system prompts, policy anchors, widgets, and tool manifest strings. Edit strings here to change LLM instructions and widget descriptions in one place.
- `prompts.js` — Thin wrappers that re-export builders and constants from `agentConfig` (kept for backwards compatibility).
- `widgetManager.js` — Compatibility layer that delegates to `agentConfig` for widget data and prompt text.
- `langchainTools.js` — Tools factory for LLM actions (memory, tasks, time). Keep business logic here; move descriptive strings to `agentConfig.js` when appropriate.

**Guidelines**
- **Edit prompts & widget text only in `agentConfig.js`.** This is the single source of truth for LLM-facing strings.
- **Add widgets** by updating the `WIDGETS` map in `agentConfig.js` and extend `getWidgetPromptInstructions()` if needed.
- **Tool descriptions** should be added to `TOOL_DESCRIPTIONS` for consistent LLM-facing help text.
- **Keep tool logic** in `langchainTools.js`, but prefer referencing descriptions from `agentConfig.js`.
- **Tests & docs:** Add unit tests when modifying tools or prompt behaviors to prevent regressions.

---

## 🎓 Summary

The MOJO Agent System is a sophisticated multi-layer system that:

1. **Manages conversations** with full history and context
2. **Remembers users** through semantic memory with importance-weighted retrieval
3. **Personalizes responses** through tone and persona settings
4. **Executes actions** through LangChain tools (memory, tasks, time)
5. **Handles intelligence** via Google Gemini API
6. **Optimizes tokens** through smart truncation and formatting
7. **Gracefully handles errors** including MAX_TOKENS conditions

Each file has a specific responsibility, working together seamlessly to create an intelligent, adaptive assistant experience.

May the force be with you! 🌟
  - `save_conversation_note` — saves conversation notes/decisions via `memoryStore.saveConversationMemory`.
  - `search_memories` — LLM-initiated memory search that returns compact results (category filters supported).
  - Task tools: `add_task`, `get_tasks`, `update_task`, `delete_task`, `get_upcoming_tasks`, `get_overdue_tasks` — integrate with `taskService`.
- **Return format**: Tools return compact, parseable TOML-like strings (ok=true/false, count, id, msg) that the LLM and agent can easily inspect.

**`prompts.js`**
- **Role**: Contains `SYSTEM_PROMPT` (base instructions) and `buildSystemPromptWithUserContext(userProfile, userId, memoryContext)`.
- **Design notes**: The prompt builder appends personality and tone derived from the user's profile and injects a compact memory context. Keep injected memory short — the LLM should rely on `search_memories` when it needs deeper recall.

**`vectorStore.js`**
- **Role**: Local, deterministic vector store for development. Provides embedding generation and semantic search across `User.memories`.
- **Key functions**:
  - `generateDeterministicVector(text, dim)` — deterministic, local embedding generator (keyword-based). Replace in production with real embeddings.
  - `cosineSimilarity(a,b)` — computes similarity score between vectors.
  - `storePrimaryMemory(userId, text, options)` — create and persist a primary memory (profile/fact) into `User.memories`, generate embedding and trigger post-save maintenance.
  - `storeConversationMemory(userId, text, options)` — similar for conversation memories; store `sessionId` when available.
  - `retrievePrimaryMemories/retrieveConversationMemories/retrieveRelevantMemories` — semantic search helpers that compute similarity and return ranked results.
  - `updateUserEmbedding`, `updateUserMemoryPriorities`, `enforceUserMemoryLimit`, `pruneOldConversationMemories` — maintenance utilities to keep memory counts bounded and to compute a weighted user embedding.
- **Notes & migration**: This module is intentionally self-contained for local dev. When moving to production, consider:
  - Use a managed vector DB (MongoDB Atlas Vector Search, Pinecone, or similar).
  - Use a real embedding provider (Gemini embeddings or OpenAI) and store vectors separately for scale.

**Memory & Tools Interaction (short)**
- The LLM can call `save_user_fact` or `save_conversation_note` to store memories; the tools persist memory and update user embeddings asynchronously.
- The controller will also inject a short memory context into the prompt to help the model respond without always calling memory tools.

### Memory Save Implementation Note

- **Pragmatic save behavior:** To make memory writes resilient to unrelated schema validation errors (for example, an invalid `profile.tone` value such as `"very angry"`), the current runtime memory persistence appends the memory object to `User.memories` and saves the user document using Mongoose with whole-document validation disabled: `user.save({ validateBeforeSave: false })`.
- **Rationale:** This prevents a single invalid field on the `User` document from blocking otherwise valid memory writes. The memory objects themselves are still constructed and validated at the memory-level before being pushed into `user.memories`.
- **Tradeoffs & risks:** Disabling whole-document validation allows invalid profile or other fields to remain in the database, which may cause subtle bugs elsewhere. This was chosen as a minimal, pragmatic fix to restore the "remember" functionality.
- **Recommended follow-ups:**
   - Sanitize and normalize profile inputs where they are set (map unknown `tone` values to an allowed enum or a safe default).
   - Consider a one-time migration script to clean existing invalid profiles.
   - For long-term robustness, move vector storage to a dedicated collection or vector DB so memory writes don't require saving the entire user document.

If you'd like, I can add a migration helper and unit tests that assert memory-save and retrieval while keeping full-document validation enabled.


---
If you want, I can now:
- Run a quick static check (lint) on the modified files, or
- Generate a short unit test that exercises `retrieveRelevantMemories` using a small in-memory `User` mock.
