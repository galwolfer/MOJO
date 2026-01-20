/*
 * File: src/agent/agentController.js
 * Purpose: Orchestrates LLM interactions, memory retrieval and tool calls
 */
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { memoryStore } from "../services/memoryService.js";
import { createLangChainTools } from "./langchainTools.js";
import { validateToolCall, validateWidgetPayload } from "./security.js";
import { extractWidgetFromText } from "./widgets/widgetUtils.js";
import { PromptManager } from "./promptManager.js";
import { TOKEN_BUDGET, LOGGING_FIELDS } from "./tokenBudget.js";
import { okFalse, okTrue } from "./lib/errorFormatter.js";
import { User } from "../models/index.js";
import { config } from "../config/env.js";

/**
 * ========================================
 * AGENT CONTROLLER - Core Orchestrator
 * ========================================
 *
 * The AgentController is the heart of MOJO's intelligent assistant system.
 * It orchestrates the entire flow:
 *
 * 1. MEMORY MANAGEMENT - Saves user/assistant messages and retrieves conversation history
 * 2. CONTEXT BUILDING - Loads user profile and retrieves relevant semantic memories
 * 3. PROMPT ENGINEERING - Builds personalized system prompts with user context
 * 4. LLM AGENT LOOP - Manages multi-turn interactions with tool calling
 * 5. TOOL EXECUTION - Handles memory operations, tasks, and time-related queries
 *
 * FLOW: User Message → Save Message → Load Context → Build Prompt →
 *       Agent Loop (LLM + Tools) → Save Response → Return Result
 */
export class AgentController {
  /**
   * Constructor - Initialize LangChain LLM and agent settings
   *
   * @param {string} apiKey - Google Gemini API key
   */
  constructor(apiKey) {
    this.apiKey = apiKey;
    // maxIterations prevents infinite loops if tool calling goes awry
    // Each iteration: LLM → Tool Call → Tool Execution → Loop back
    this.maxIterations = 5;

    // Initialize ChatGoogleGenerativeAI with optimized settings
    // temperature: 0.2 = low randomness, focused responses
    // maxOutputTokens: 768 = balanced between detail and token efficiency
    this.llm = new ChatGoogleGenerativeAI({
      model: config.geminiModel || "gemini-3.0-flash",
      apiKey: apiKey,
      temperature: 0.2, // Low temperature = focused, deterministic responses
      maxOutputTokens: 768, // Balanced token limit
    });
  }

  /**
   * ==========================================================================
   * MAIN METHOD: Process a user message with semantic memory and tool calling
   * ==========================================================================
   *
   * This is the primary entry point for handling user messages. It implements
   * the complete agent loop with memory retrieval and LLM tool calling.
   *
   * ALGORITHM:
   * 1. Save the incoming user message to MongoDB (Session model)
   * 2. Retrieve conversation history from cache/database
   * 3. Load user profile (name, tone, persona preferences)
   * 4. Retrieve semantically relevant memories using vector embeddings
   * 5. Build personalized system prompt with user context
   * 6. Create LangChain tools (memory, tasks, time operations)
   * 7. Invoke LLM with agent loop (max 3 iterations)
   *    - If LLM requests tool calls, execute them and loop
   *    - If no tool calls, return the response
   * 8. Save assistant response to database
   * 9. Return result to caller
   *
   * @param {string} sessionId - Unique session identifier
   * @param {string} userMessage - The user's input text
   * @param {string} userId - User's MongoDB _id (from auth token)
   * @returns {Promise<Object>} { success, response, sessionId, messageCount }
   */
  async processMessage(sessionId, userMessage, userId) {
    try {
      console.log(`[AgentController] Processing message for user: ${userId}, session: ${sessionId}`);
      let lastWidgetResult = null;

      // STEP 1: SAVE USER MESSAGE
      // Store the user's message in the session for later retrieval
      await memoryStore.addUserMessage(sessionId, userId, userMessage);

      // Get message count (Task 1)
      const messageCount = await memoryStore.getMessageCount(sessionId, userId);
      const messageIndex = messageCount; // 1-based index

      // STEP 2: RETRIEVE CONVERSATION HISTORY
      // Get all previous messages in this session (cached for performance)
      let history = await memoryStore.getHistory(sessionId, userId);
      const summary = await memoryStore.getSessionSummary(sessionId);
      console.log(`[AgentController] History length: ${history.length}, Summary length: ${summary.length}`);

      // STEP 3: LOAD USER PROFILE
      // Get user's preferences: name, ojoType
      const user = await User.findById(userId).populate("profile.ojoTypeId");
      console.log(`[AgentController] User found:`, user ? `${user.username} (${user._id})` : "NOT FOUND");

      const userProfile = user?.profile ? { ...user.profile } : {}; // Clone to avoid mutation issues
      // Inject subCategories into profile context
      if (user && user.subCategories && user.subCategories.length > 0) {
        userProfile.subCategories = user.subCategories;
      }

      // Populate ojoType if not already populated
      if (userProfile.ojoTypeId && !userProfile.ojoType) {
        const OjoType = (await import("../models/OjoType.js")).default;
        userProfile.ojoType = await OjoType.findById(userProfile.ojoTypeId);
      }

      console.log(`[AgentController] User profile:`, {
        name: userProfile.name,
        ojoType: userProfile.ojoType?.name,
      });

      // STEP 4: SEMANTIC MEMORY RETRIEVAL
      // Use vector embeddings to find memories relevant to the user's message
      // This allows the agent to "remember" past facts and decisions
      console.log(`[AgentController] Retrieving relevant memories for query: "${userMessage.substring(0, 50)}..."`);

      const relevantMemories = await memoryStore.retrieveRelevantMemories(userId, userMessage, 5);

      // Format memories in compact structure to minimize token usage
      // Primary memories: User facts (location, education, preferences)
      // Conversation memories: Past decisions, plans, discussed topics
      let memoryContext = "";

      // Add primary memories (settings, preferences, facts) - compact format
      if (relevantMemories.primary && relevantMemories.primary.length > 0) {
        memoryContext += "\nMemory: ";
        relevantMemories.primary.forEach((mem, idx) => {
          memoryContext += `${mem.text}; `;
        });
      }

      // Add conversation memories - compact format
      if (relevantMemories.conversation && relevantMemories.conversation.length > 0) {
        memoryContext += "\nPast: ";
        relevantMemories.conversation.forEach((mem, idx) => {
          memoryContext += `${mem.text}; `;
        });
      }

      // Language hint: detect basic script of the user's message and add a short USER_LANGUAGE marker
      // This is a lightweight hint to help the model choose natural phrasing without heavy rules.
      try {
        const userLang = /[\u0590-\u05FF]/.test(userMessage) ? "Hebrew" : "English";
        memoryContext += `\nUSER_LANGUAGE: ${userLang}`;
        console.log(`[AgentController] Detected USER_LANGUAGE=${userLang}`);
      } catch (e) {
        // ignore non-critical errors
      }

      console.log(`[AgentController] Memory context length: ${memoryContext.length} chars`);
      console.log(
        `[AgentController] Retrieved ${relevantMemories.primary.length} primary + ${relevantMemories.conversation.length} conversation memories`,
      );

      // SAFETY: Truncate long memory context to avoid huge prompts
      // The LLM can use search_memories tool for deeper recall if needed
      const MAX_MEMORY_CHARS = TOKEN_BUDGET.MAX_MEMORY_TOKENS * 4; // Approx 4 chars per token
      if (memoryContext.length > MAX_MEMORY_CHARS) {
        console.warn(
          `[AgentController] memoryContext is ${memoryContext.length} chars; truncating to ${MAX_MEMORY_CHARS} chars. LLM can use search_memories tool for more.`,
        );
        memoryContext = memoryContext.substring(0, MAX_MEMORY_CHARS) + "...";
      }

      // STEP 4.5: ADD SESSION ENTITY CONTEXT
      // Inject recently discussed entities (tasks, etc.) for reference resolution
      // This allows the LLM to understand "this task", "that one", "delete it", etc.
      const entityContext = memoryStore.buildEntityContextString(sessionId);
      if (entityContext) {
        memoryContext += entityContext;
        console.log(`[AgentController] Added entity context (${entityContext.length} chars)`);
      }

      // STEP 5 & 6: BUILD MESSAGES (Task 2 & 3)
      // Pass history excluding the message we just saved, as buildMessages adds userMessage explicitly
      const messages = PromptManager.buildMessages({
        userMessage,
        history: history.slice(0, -1),
        summary,
        userProfile,
        userId,
        memoryContext,
        messageIndex,
      });

      // LOGGING (Task 0)
      const systemMessage = messages.find((m) => m._getType() === "system");
      const systemTokens = systemMessage ? systemMessage.content.length / 4 : 0; // Approx
      console.log(`[TokenBudget] tokens_in_system: ~${Math.round(systemTokens)}`);
      console.log(`[TokenBudget] tokens_in_memory: ~${Math.round(memoryContext.length / 4)}`);
      console.log(`[TokenBudget] tokens_in_history: ~${Math.round(JSON.stringify(history).length / 4)}`);

      console.log(`[AgentController] Invoking LLM with ${messages.length} messages`);

      // STEP 7: CREATE LANGCHAIN TOOLS
      // These are the functions the LLM can call to take actions:
      // - Memory: save_user_fact, save_conversation_note, search_memories
      // - Tasks: add_task, get_tasks, update_task, delete_task, etc.
      // - Time: get_current_time
      const tools = createLangChainTools(userId);

      // Bind tools to the LLM so it knows what functions are available
      const llmWithTools = this.llm.bindTools(tools);

      // STEP 8: AGENT LOOP - Multi-turn interaction with tool calling
      // The agent can decide to:
      // 1. Call a tool (memory, tasks, time) and get a result
      // 2. Return a text response (no tool needed)
      let finalResponse = null;
      let currentMessages = [...messages];

      // Heuristic shortcut: If the user explicitly asks to LIST/SHOW their tasks, call the get_tasks tool directly
      // This avoids model history bias and ensures the data is fresh and authoritative
      try {
        const showTasksRE = /\b(משימות|הצג לי|תציג|תראה|להציג|הצג|show|list|display)\b/i;
        const detailRE = /\b(details?|specifics|info|information|פרטים|פירוט|מידע)\b/i;
        if (showTasksRE.test(userMessage) && !detailRE.test(userMessage)) {
          const getTasksTool = tools.find((t) => t.name === "get_tasks");
          if (getTasksTool) {
            const callId = `direct_get_tasks_${Date.now()}`;
            let result = await getTasksTool.func({});

            // Use centralized handler for widget validation/persistence and message adding
            const processed = await this._handleToolExecutionResult(
              sessionId,
              userId,
              { id: callId, name: getTasksTool.name, args: {} },
              getTasksTool,
              result,
              currentMessages,
            );

            if (processed.lastWidget) lastWidgetResult = processed.lastWidget;

            if (processed.stop) {
              // Stop means we should return the finalResponse directly (widget-only or returnDirect)
              if (processed.finalResponse) {
                console.log(
                  `[AgentController] get_tasks shortcut returned ONLY a widget. Skipping LLM and returning directly.`,
                );
                finalResponse = processed.finalResponse;
              }
            } else {
              // Otherwise, let the LLM craft a natural response referencing the added tool result
              try {
                const toolResponse = await llmWithTools.invoke(currentMessages);
                if (!(toolResponse.tool_calls && toolResponse.tool_calls.length > 0)) {
                  finalResponse =
                    typeof toolResponse.content === "string" ? toolResponse.content : toolResponse.text || "";
                } else {
                  currentMessages.push(toolResponse);
                }
              } catch (err) {
                console.warn(
                  `[AgentController] Shortcut LLM invoke failed, falling back to agent loop: ${err.message}`,
                );
              }
            }
          }
        }
      } catch (err) {
        console.warn(`[AgentController] Shortcut get_tasks execution failed: ${err.message}`);
      }

      let iteration = 0;
      while (iteration < this.maxIterations && !finalResponse) {
        iteration++;
        console.log(`[AgentController] Agent loop iteration ${iteration}/${this.maxIterations}`);

        try {
          let response;
          try {
            response = await llmWithTools.invoke(currentMessages);
          } catch (err) {
            console.error(
              `[AgentController] LLM invocation failed. Sanitized messages:`,
              currentMessages.map((m) => ({ type: m._getType && m._getType(), content: m.content })),
            );
            // If we saw the internal TypeError (reading 'message'), perform a minimal retry
            // to help isolate provider/formatting issues (system + last user message)
            if (err instanceof TypeError && /reading 'message'/.test(err.message)) {
              console.warn(
                `[AgentController] Detected TypeError in LLM invoke (reading 'message'). Retrying with minimal messages (system + last user message).`,
              );
              const systemMsg = currentMessages.find((m) => m._getType && m._getType() === "system");
              const lastUser = [...currentMessages].reverse().find((m) => m._getType && m._getType() === "human");
              const fallback = [systemMsg, lastUser].filter(Boolean);
              try {
                console.log(`[AgentController] Attempting fallback invoke with ${fallback.length} messages`);
                response = await llmWithTools.invoke(fallback);
                console.log(`[AgentController] Fallback invoke succeeded.`);
              } catch (err2) {
                console.error(`[AgentController] Fallback invoke also failed:`, err2);
                throw err; // rethrow original for visibility
              }
            } else {
              throw err;
            }
          }

          // SECURITY: Reject explicit 'system' messages coming from the model (prompt injection attempt).
          if (response._getType && response._getType() === "system") {
            console.warn(`[AgentController] Ignoring system message received from LLM (possible prompt injection).`);
            const errText = `ok=false\nerr="System messages from the model are not allowed and were ignored."`;

            // Persist a function result for auditing
            await memoryStore.addToolResult(sessionId, userId, "_system_rejected", "_system_rejected", errText);

            // Do not add it to history as a system message. Instead, add a tool-like failure so LLM sees it's not allowed
            currentMessages.push(
              new ToolMessage({
                content: errText,
                tool_call_id: "_system_rejected",
                name: "_system_rejected",
              }),
            );

            // Try loop again so the LLM can respond to the rejection
            continue;
          }

          // Normalize content to string (LangChain/Gemini may return array)
          let persistentContent = "";
          if (typeof response.content === "string") {
            persistentContent = response.content;
          } else if (Array.isArray(response.content)) {
            persistentContent = response.content
              .map((c) => (typeof c === "string" ? c : c.text || JSON.stringify(c)))
              .join("\n");
          }
          persistentContent = this._sanitizeResponse(persistentContent);

          // Set normalized content on response
          response.content = persistentContent;

          // Check if the LLM wants to call any tools
          if (response.tool_calls && response.tool_calls.length > 0) {
            console.log(`[AgentController] Tool calls requested: ${response.tool_calls.length}`);

            // Persist assistant message with tool calls to session history
            // Persist assistant tool call message and include the user's OjoType (if available)
            await memoryStore.addAssistantToolCalls(sessionId, userId, persistentContent, response.tool_calls, {
              ojoTypeName: userProfile?.ojoType?.name,
              ojoTypeDisplayName: userProfile?.ojoType?.displayName,
            });

            // Add the LLM's response (which includes tool calls) to the message history
            currentMessages.push(response);

            // Execute each tool call sequentially
            for (const toolCall of response.tool_calls) {
              console.log(`[AgentController] Executing tool: ${toolCall.name}`);

              // Find the tool in our tools array
              const tool = tools.find((t) => t.name === toolCall.name);

              if (tool) {
                try {
                  // Validate the tool call args against tool schema and basic security checks
                  const validation = validateToolCall(tool, toolCall.args || {});
                  if (!validation.valid) {
                    console.warn(
                      `[AgentController] Tool call validation failed for ${toolCall.name}: ${validation.reason}`,
                    );
                    const errText = `ok=false\nerr="Validation failed: ${validation.reason}"`;
                    // Persist failure to session for auditing
                    await memoryStore.addToolResult(sessionId, userId, toolCall.id, toolCall.name, errText);

                    // Do not execute the tool; notify LLM via tool response
                    currentMessages.push(
                      new ToolMessage({
                        content: errText,
                        tool_call_id: toolCall.id,
                        name: toolCall.name || toolCall.id || "unknown",
                      }),
                    );
                    continue; // skip execution
                  }

                  // Execute the tool with the arguments provided by the LLM
                  let result = await tool.func(toolCall.args);

                  // Use centralized helper to validate widget, persist results, and add messages
                  const processed = await this._handleToolExecutionResult(
                    sessionId,
                    userId,
                    toolCall,
                    tool,
                    result,
                    currentMessages,
                  );

                  if (processed.lastWidget) lastWidgetResult = processed.lastWidget;

                  if (processed.stop) {
                    if (processed.finalResponse) {
                      finalResponse = processed.finalResponse;
                    }
                    break; // Exit tool loop and skip LLM invocation
                  }

                  console.log(`[AgentController] Tool ${toolCall.name} executed successfully`);
                } catch (error) {
                  console.error(`[AgentController] Tool execution error:`, error);
                  // Even if tool fails, add the error to the message history and persist it
                  const errText = `ok=false\nerr="${error.message}"`;
                  currentMessages.push(
                    new ToolMessage({
                      content: errText,
                      tool_call_id: toolCall.id,
                      name: toolCall.name || toolCall.id || "unknown",
                    }),
                  );
                  await memoryStore.addToolResult(sessionId, userId, toolCall.id, toolCall.name, errText);
                }
              } else {
                console.warn(`[AgentController] Tool not found: ${toolCall.name}`);
                const errText = `ok=false\nerr="Tool not found: ${toolCall.name}"`;
                currentMessages.push(
                  new ToolMessage({
                    content: errText,
                    tool_call_id: toolCall.id,
                    name: toolCall.name || toolCall.id || "unknown",
                  }),
                );
                await memoryStore.addToolResult(sessionId, userId, toolCall.id, "unknown", errText);
              }
            }
            // Loop back: invoke LLM again with tool results
          } else {
            // No tool calls - the LLM has provided a final response
            finalResponse = response.content;
            console.log(`[AgentController] Final response received (${finalResponse.length} chars)`);
          }
        } catch (error) {
          console.error(`[AgentController] LLM invocation error:`, error);

          // Handle MAX_TOKENS error: ask LLM to be brief and retry
          if (error.message && error.message.includes("MAX_TOKENS")) {
            console.warn(`⚠️ Model hit MAX_TOKENS. Retrying with shorter request...`);

            // Add explicit instruction for brevity
            currentMessages.push(new HumanMessage("[System: Please provide a brief, concise response.]"));
            // Continue loop to retry
            continue;
          } else {
            // Re-throw other errors
            throw error;
          }
        }
      }

      // STEP 9: SAVE ASSISTANT RESPONSE
      // Store the final response in the session
      if (finalResponse) {
        finalResponse = this._sanitizeResponse(finalResponse);
        finalResponse = this._normalizeWidgetTags(finalResponse);
        if (lastWidgetResult) {
          if (extractWidgetFromText(finalResponse)) {
            finalResponse = finalResponse.replace(/<WIDGET_JSON>[\s\S]*?<\/WIDGET_JSON>/i, lastWidgetResult);
          } else {
            finalResponse = finalResponse ? `${finalResponse}\n${lastWidgetResult}` : lastWidgetResult;
          }
        } else if (extractWidgetFromText(finalResponse)) {
          const widgetMatch = finalResponse.match(/<WIDGET_JSON>[\s\S]*?<\/WIDGET_JSON>/i);
          if (widgetMatch) {
            const widgetBlock = widgetMatch[0];
            finalResponse = finalResponse.replace(/<WIDGET_JSON>[\s\S]*?<\/WIDGET_JSON>/i, widgetBlock);
          }
        }
        // Ensure only a single widget block remains in the final response
        const widgetMatches = finalResponse.match(/<WIDGET_JSON>[\s\S]*?<\/WIDGET_JSON>/gi);
        if (widgetMatches && widgetMatches.length > 1) {
          let kept = false;
          finalResponse = finalResponse.replace(/<WIDGET_JSON>[\s\S]*?<\/WIDGET_JSON>/gi, (match) => {
            if (!kept) {
              kept = true;
              return match;
            }
            return "";
          });
          finalResponse = finalResponse.replace(/\n\s*\n+/g, "\n").trim();
        }
        // If the message is just a widget or has very short surrounding text, insert a short, natural fallback
        try {
          const widgetPresent = extractWidgetFromText(finalResponse) || lastWidgetResult;
          if (widgetPresent) {
            // Extract widget block
            const match = finalResponse.match(/<WIDGET_JSON>[\s\S]*?<\/WIDGET_JSON>/i);
            const widgetBlock = match ? match[0] : lastWidgetResult || "";
            const surrounding = finalResponse.replace(widgetBlock, "").trim();

            // Decide if surrounding text is too terse (few words or just punctuation)
            const words = surrounding.split(/\s+/).filter(Boolean);
            if (words.length < 3) {
              // Removed robotic fallback text - let LLM generate natural response
            }
          }
        } catch (e) {
          // Non-critical - fall back to original finalResponse
        }

        // Persist assistant message and attach which OjoType authored it (user's selected OjoType)
        await memoryStore.addAssistantMessage(sessionId, userId, finalResponse, {
          ojoTypeName: userProfile?.ojoType?.name,
          ojoTypeDisplayName: userProfile?.ojoType?.displayName,
        });
      } else {
        // Fallback response if something went wrong
        finalResponse = "Sorry, I encountered an issue processing the request. Please try again.";
        await memoryStore.addAssistantMessage(sessionId, userId, finalResponse, {
          ojoTypeName: userProfile?.ojoType?.name,
          ojoTypeDisplayName: userProfile?.ojoType?.displayName,
        });
      }

      // STEP 10: RETURN RESULT
      // Send back the response with metadata

      // Background Task: Update Summary if needed
      if (messageIndex % TOKEN_BUDGET.SUMMARY_UPDATE_EVERY_K_TURNS === 0) {
        // Trigger a background summarization job (non-blocking)
        this._triggerSummaryUpdate(sessionId, userId, messageIndex);
      }

      return {
        success: true,
        response: finalResponse,
        sessionId,
        messageCount: await memoryStore.getMessageCount(sessionId, userId),
        // Expose which OjoType authored this assistant message so clients can render persona UI immediately
        ojoTypeName: userProfile?.ojoType?.name,
        ojoTypeDisplayName: userProfile?.ojoType?.displayName,
      };
    } catch (error) {
      console.error("Agent processing error:", error);
      throw error;
    }
  }

  /**
   * Reset a session - Clears all messages from a session
   *
   * @param {string} sessionId - Session to reset
   * @param {string} userId - User's ID (for authorization check)
   * @returns {Promise<Object>} { success, message }
   */
  async resetSession(sessionId, userId) {
    await memoryStore.clearSession(sessionId);
    return { success: true, message: "Session reset successfully" };
  }

  /**
   * Retrieve full session history
   *
   * @param {string} sessionId - Session to retrieve
   * @param {string} userId - User's ID (for authorization check)
   * @returns {Promise<Array>} Array of message objects { role, content, timestamp }
   */
  async getSessionHistory(sessionId, userId) {
    return await memoryStore.getHistory(sessionId, userId);
  }

  /**
   * Retrieve a page of session history from the END of the session.
   */
  async getSessionHistoryPage(sessionId, userId, limit, offset) {
    return await memoryStore.getHistoryPage(sessionId, userId, limit, offset);
  }

  /**
   * List a user's sessions with cursor pagination.
   * If includeMessages is set, include the last N messages per session.
   */
  async listUserSessions(userId, limit, cursor, includeMessages) {
    return await memoryStore.listSessions(userId, limit, cursor, includeMessages);
  }

  /**
   * Sanitize response to remove raw function call JSON that shouldn't be displayed
   * @param {string} response - The raw response from the LLM
   * @returns {string} Cleaned response
   * @private
   */
  _sanitizeResponse(response) {
    if (!response || typeof response !== "string") return response;

    let cleaned = String(response);

    // Remove full JSON blocks that contain ""type":"functionCall""
    let search = '"type":"functionCall"';
    let idx = cleaned.indexOf(search);
    while (idx !== -1) {
      // find the opening brace before idx
      let open = cleaned.lastIndexOf("{", idx);
      if (open === -1) break;

      // find matching closing brace by scanning, respecting string literals
      let depth = 0;
      let inString = false;
      let escape = false;
      let close = -1;
      for (let i = open; i < cleaned.length; i++) {
        const ch = cleaned[i];
        if (inString) {
          if (escape) {
            escape = false;
          } else if (ch === "\\") {
            escape = true;
          } else if (ch === '"') {
            inString = false;
          }
        } else {
          if (ch === '"') {
            inString = true;
          } else if (ch === "{") {
            depth++;
          } else if (ch === "}") {
            depth--;
            if (depth === 0) {
              close = i;
              break;
            }
          }
        }
      }

      if (close === -1) break; // bail if not found

      // remove the entire block
      cleaned = cleaned.slice(0, open) + cleaned.slice(close + 1);

      // search again
      idx = cleaned.indexOf(search);
    }

    // Remove stray lines that are just closing braces or empty objects
    cleaned = cleaned.replace(/^\s*}\s*$/gm, "");
    cleaned = cleaned.replace(/\{\s*\}/g, "");

    // Remove any leftover incomplete JSON starts (but keep widget JSON)
    cleaned = cleaned.replace(/\{\s*"(type|functionCall|name|args)"\s*:/g, (match, group, offset) => {
      const beforeText = cleaned.substring(Math.max(0, offset - 50), offset);
      if (beforeText.includes("<WIDGET_JSON>")) return match;
      return "";
    });

    // Clean up extra newlines and whitespace
    cleaned = cleaned.replace(/\n\s*\n+/g, "\n").trim();

    // Strip illegal display characters outside widget blocks
    const widgetBlocks = [];
    cleaned = cleaned.replace(/<WIDGET_JSON>[\s\S]*?<\/WIDGET_JSON>/gi, (match) => {
      const token = `__WIDGET_BLOCK_${widgetBlocks.length}__`;
      widgetBlocks.push(match);
      return token;
    });
    cleaned = cleaned.replace(/[<>]/g, "");
    widgetBlocks.forEach((block, idx) => {
      cleaned = cleaned.replace(`__WIDGET_BLOCK_${idx}__`, block);
    });

    cleaned = cleaned.replace(/\n\s*\n+/g, "\n").trim();

    return cleaned;
  }

  // ===== Helper: capture/normalize widget strings and process tool results =====
  _captureWidgetBlock(raw) {
    if (typeof raw !== "string") return null;
    const match = raw.match(/<WIDGET_JSON>[\s\S]*?<\/WIDGET_JSON>/);
    return match ? match[0] : null;
  }

  _normalizeWidgetTags(text) {
    if (typeof text !== "string") return text;
    return text.replace(/<\s*\/?\s*W[^>]*JSON\s*>/gi, (m) => (m.includes("</") ? "</WIDGET_JSON>" : "<WIDGET_JSON>"));
  }

  /**
   * Process a tool execution result: validate widgets, persist result, extract entities,
   * and determine if we should return the widget directly (widget-only response).
   * @private
   */
  async _handleToolExecutionResult(sessionId, userId, toolCall, tool, result, currentMessages) {
    try {
      // If result contains a widget payload, validate it
      if (typeof result === "string" && result.includes("<WIDGET_JSON>")) {
        const widgetValidation = validateWidgetPayload(result);
        if (!widgetValidation.valid) {
          // Handle empty task list -> structured empty result
          if (widgetValidation.reason === "Empty task list" && widgetValidation.widget?.widget_type === "task_list") {
            result = okTrue({ count: 0 });
          } else if (toolCall.name === "preview_task") {
            // For preview_task, return friendly fallback text
            result =
              "I’m sorry — I ran into a problem generating a preview for the task. " +
              "I can still create the task for you with the details you provided, or make any edits you want before I create it.";
          } else {
            // Persist failure for auditing and return structured error
            await memoryStore.addToolResult(
              sessionId,
              userId,
              toolCall.id,
              toolCall.name,
              `ok=false\nerr="Widget validation failed: ${widgetValidation.reason}"`,
            );
            result = `ok=false\nerr="Widget validation failed: ${widgetValidation.reason}"`;
          }
        }
      }

      const widgetBlock = this._captureWidgetBlock(result);
      if (widgetBlock) {
        // Track last widget and check if result contains only the widget
        const resultWithoutWidget = result.replace(/<WIDGET_JSON>[\s\S]*?<\/WIDGET_JSON>/i, "").trim();
        if (!resultWithoutWidget || resultWithoutWidget === "") {
          // Only widget present: persist and return widget directly
          await memoryStore.addToolResult(sessionId, userId, toolCall.id, toolCall.name, result);
          return { finalResponse: widgetBlock, lastWidget: widgetBlock, addedMessage: false, stop: true };
        }
      }

      // Add the tool result to the message history and persist it
      currentMessages.push(
        new ToolMessage({
          content: result,
          tool_call_id: toolCall.id,
          name: toolCall.name || toolCall.id || "unknown",
        }),
      );
      await memoryStore.addToolResult(sessionId, userId, toolCall.id, toolCall.name, result);

      // Extract and track entities from tool results
      this._extractAndTrackEntities(sessionId, toolCall.name, toolCall.args || {}, result);

      // If tool requests returnDirect, return now
      if (tool && tool.returnDirect) {
        return { finalResponse: result, lastWidget: null, addedMessage: true, stop: true };
      }

      return { finalResponse: null, lastWidget: widgetBlock || null, addedMessage: true, stop: false };
    } catch (err) {
      console.error(`[AgentController] Error processing tool result: ${err.message}`);
      // Persist error
      const errText = `ok=false\nerr="${err.message}"`;
      currentMessages.push(
        new ToolMessage({
          content: errText,
          tool_call_id: toolCall.id,
          name: toolCall.name || toolCall.id || "unknown",
        }),
      );
      await memoryStore.addToolResult(sessionId, userId, toolCall.id, toolCall.name, errText);
      return { finalResponse: null, lastWidget: null, addedMessage: true, stop: false };
    }
  }

  /**
   * Extract and track entities from tool calls and results
   * This enables the LLM to resolve references like "this task", "delete it", etc.
   * @param {string} sessionId - Session ID
   * @param {string} toolName - Name of the tool that was called
   * @param {Object} args - Arguments passed to the tool
   * @param {string} result - Result returned by the tool
   * @private
   */
  _extractAndTrackEntities(sessionId, toolName, args, result) {
    try {
      // Task-related tools
      if (toolName === "add_task" || toolName === "preview_task") {
        // Extract task ID from result (format: id="xxx" or from widget JSON)
        const idMatch = result.match(/id="([^"]+)"/);
        const taskName = args?.taskname || args?.name || "Untitled Task";

        if (idMatch) {
          memoryStore.addSessionEntity(sessionId, "task", idMatch[1], taskName, {
            action: toolName === "add_task" ? "created" : "previewed",
            dueDate: args?.deadline || args?.dueDate,
          });
        }

        // Also extract from widget JSON if present
        const widget = extractWidgetFromText(result);
        if (widget && widget.data?.id) {
          memoryStore.addSessionEntity(sessionId, "task", widget.data.id, widget.data.title || taskName, {
            action: toolName === "add_task" ? "created" : "previewed",
            dueDate: widget.data.dueDate,
            status: widget.data.status,
            importance: widget.data.importance,
            taskType: widget.data.taskType,
          });
        }
      }

      // Update task - track the updated task
      if (toolName === "update_task" && args.taskId) {
        const taskName = args.name || args.tagname || "Updated Task";
        memoryStore.addSessionEntity(sessionId, "task", args.taskId, taskName, {
          action: "updated",
        });
      }

      // Task detail - track the shown task
      if (toolName === "get_task_detail") {
        const widget = extractWidgetFromText(result);
        if (widget?.data?.task?.id && widget?.data?.task?.title) {
          memoryStore.addSessionEntity(sessionId, "task", widget.data.task.id, widget.data.task.title, {
            action: "detailed",
            status: widget.data.task.status,
            dueDate: widget.data.task.dueDate,
          });
        }
      }

      // Get tasks - track all returned tasks (user might refer to any of them)
      if (toolName === "get_tasks" || toolName === "get_upcoming_tasks" || toolName === "get_overdue_tasks") {
        const widget = extractWidgetFromText(result);
        const taskBuckets = [];
        if (widget?.data?.tasks && Array.isArray(widget.data.tasks)) {
          taskBuckets.push(widget.data.tasks);
        }
        if (widget?.data?.today?.tasks && Array.isArray(widget.data.today.tasks)) {
          taskBuckets.push(widget.data.today.tasks);
        }
        if (widget?.data?.upcoming && Array.isArray(widget.data.upcoming)) {
          widget.data.upcoming.forEach((group) => {
            if (group?.tasks && Array.isArray(group.tasks)) {
              taskBuckets.push(group.tasks);
            }
          });
        }

        if (taskBuckets.length > 0) {
          const flat = taskBuckets.flat();
          flat
            .slice()
            .reverse()
            .forEach((task) => {
              if (task.id && task.title) {
                memoryStore.addSessionEntity(sessionId, "task", task.id, task.title, {
                  action: "listed",
                  status: task.status,
                  dueDate: task.dueDate,
                });
              }
            });
        }
      }

      // Delete task - remove from context after deletion
      if (toolName === "delete_task" && result.includes("ok=true")) {
        // Task was deleted successfully - optionally log but don't add as active entity
        // to prevent confusion in future references
      }

      console.log(`[AgentController] Entity extraction complete for ${toolName}`);
    } catch (err) {
      console.warn(`[AgentController] Entity extraction failed: ${err.message}`);
    }
  }

  /**
   * Background summary update (non-blocking)
   * @private
   */
  _triggerSummaryUpdate(sessionId, userId, messageIndex) {
    setImmediate(async () => {
      try {
        console.log(`[AgentController] Background summary: collecting history for ${sessionId}`);
        const history = await memoryStore.getHistory(sessionId, userId);
        // Lightweight summarization placeholder: join last N messages.
        const snippet = history
          .slice(-20)
          .map((m) => `${m.role}: ${m.content}`)
          .join("\n");
        const short = snippet.length > 1000 ? snippet.substring(0, 1000) + "..." : snippet;
        await memoryStore.updateSessionSummary(sessionId, `AutoSummary (turn ${messageIndex}): ${short}`);
        console.log(`[AgentController] Background summary update saved for session ${sessionId}`);
      } catch (err) {
        console.warn(`[AgentController] Summary update failed: ${err.message}`);
      }
    });
  }
}
