**Agent Overview**
- **Purpose**: Explains the agent implementation in `src/agent`, how files relate, and the message flow the agent follows when processing user chat messages.
- **Key folders/files**: `agentController.js`, `geminiAdapter.js`, `langchainTools.js`, `prompts.js`, `vectorStore.js`.

**Architecture Summary**
- **Orchestrator**: `agentController.js` — coordinates saving user messages, retrieving context, invoking the LLM with tools, executing tool calls, and saving assistant responses.
- **Model Adapter**: `geminiAdapter.js` — converts our message shapes to/from Google Gemini REST format and handles defensive parsing and common error cases (e.g., MAX_TOKENS).
- **Tools**: `langchainTools.js` — LangChain-compatible tools the LLM can call (memory save/search, task CRUD, time helper). Each tool returns compact TOML-like responses so the agent and LLM can programmatically read results.
- **Prompts**: `prompts.js` — base system prompt and helper to build a personalized system prompt using `userProfile`, `userId`, and a compact `memoryContext`.
- **Vector & Memory Helpers**: `vectorStore.js` — deterministic dev embeddings, cosine-similarity search across `User.memories`, memory insertion, pruning, and user-level embedding maintenance.

**Overall Flow (high-level)**
- Client → Express `chatController` → `agentController.processMessage(sessionId, message, userId)`.
- `agentController` steps:
  - Persist the incoming user message into the session (via `memoryStore`).
  - Load short conversation history and the `User` profile (name, tone, persona).
  - Call `memoryStore.retrieveRelevantMemories(...)` (which uses `vectorStore` internally) to get primary + conversation matches.
  - Build a concise `systemPrompt` with `buildSystemPromptWithUserContext(...)` (from `prompts.js`) and inject a compact `memoryContext`.
  - Create LangChain tools using `createLangChainTools(userId)` and bind them to the LLM.
  - Convert history + current message to LangChain messages and call the LLM with tools enabled.
  - If the LLM issues tool calls, execute them (tools mutate memory, return task results, etc.) and feed results back to the LLM; repeat up to a small iteration limit.
  - Save the final assistant response into session history and return a result object to the controller.

**File-by-file Explanation**

**`agentController.js`**
- **Role**: Main orchestrator. Implements `AgentController.processMessage`, `resetSession`, and `getSessionHistory`.
- **What `processMessage` does**:
  - **Persist**: Calls `memoryStore.addUserMessage(sessionId, userId, message)` to record the incoming user message in the session.
  - **History**: Loads recent conversation messages with `memoryStore.getHistory(sessionId)` and trims to a small number (default 10) to conserve tokens.
  - **Profile**: Loads `User` record to extract `profile` fields for personalization.
  - **Semantic Memory**: Calls `memoryStore.retrieveRelevantMemories(userId, query, topK)` to gather primary and conversation memories. Builds a compact `memoryContext` string limited to a short length (e.g., 200 chars) to avoid prompt bloat.
  - **Prompting**: Uses `buildSystemPromptWithUserContext(userProfile, userId, memoryContext)` to assemble the system prompt.
  - **Tools & LLM**: Creates tools via `createLangChainTools(userId)` and binds them to the LLM (LangChain). Invokes the LLM; if the model requests tools, executes them and returns results back to the LLM until a final textual reply is returned or an iteration limit is reached.
  - **Save**: Persists the assistant response with `memoryStore.addAssistantMessage`.
- **Design notes**: The controller keeps token usage conservative (trim history, compact memory context) and delegates embedding and storage to `memoryStore` / `vectorStore`.

**`geminiAdapter.js`**
- **Role**: Adapter for Google Gemini (REST) usage.
- **Key functions**:
  - `convertMessagesToGeminiFormat(messages)` — maps our message shapes to Gemini `contents`. Handles system->user conversion and function/function-response shapes.
  - `generateContent(messages, tools)` — builds the Gemini request, optionally attaches `tools` metadata, and posts to Gemini's `:generateContent` endpoint. Returns raw Gemini JSON.
  - `extractResponse(geminiResponse)` — defensive extractor that normalizes the response into either: `{ type: 'text', text }`, `{ type: 'function_call', functionCall }`, or `{ type: 'max_tokens', candidate }` so callers can handle retries.
- **Design notes**: Keeps parsing defensive because response shapes may change. Detects `MAX_TOKENS` finish reason and surfaces it to the caller so the agent can retry with shorter context.

**`langchainTools.js`**
- **Role**: Exposes a list of LangChain `DynamicStructuredTool` instances bound to a `userId`.
- **Important tools**:
  - `get_current_time` — returns current date/time (useful for date parsing inside the LLM).
  - `save_user_fact` — saves primary user facts (name, education, preferences) via `memoryStore.savePrimaryMemory`.
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


---
If you want, I can now:
- Run a quick static check (lint) on the modified files, or
- Generate a short unit test that exercises `retrieveRelevantMemories` using a small in-memory `User` mock.
