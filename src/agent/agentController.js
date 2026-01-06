/*
 * File: src/agent/agentController.js
 * Purpose: Orchestrates LLM interactions, memory retrieval and tool calls
 */
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { memoryStore } from "../services/memoryService.js";
import { createLangChainTools } from "./langchainTools.js";
import { buildSystemPromptWithUserContext } from "./prompts.js";
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
    this.maxIterations = 3;

    // Initialize ChatGoogleGenerativeAI with optimized settings
    // temperature: 0.2 = low randomness, focused responses
    // maxOutputTokens: 768 = balanced between detail and token efficiency
    this.llm = new ChatGoogleGenerativeAI({
      model: config.geminiModel || "gemini-2.0-flash",
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

      // STEP 1: SAVE USER MESSAGE
      // Store the user's message in the session for later retrieval
      await memoryStore.addUserMessage(sessionId, userId, userMessage);

      // STEP 2: RETRIEVE CONVERSATION HISTORY
      // Get all previous messages in this session (cached for performance)
      let history = await memoryStore.getHistory(sessionId, userId);
      console.log(`[AgentController] History length: ${history.length}`);

      // STEP 3: LOAD USER PROFILE
      // Get user's preferences: name, tone (friendly/professional), persona
      const user = await User.findById(userId);
      console.log(`[AgentController] User found:`, user ? `${user.username} (${user._id})` : "NOT FOUND");

      const userProfile = user?.profile || {};
      console.log(`[AgentController] User profile:`, {
        name: userProfile.name,
        tone: userProfile.tone,
        persona: userProfile.persona,
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

      console.log(`[AgentController] Memory context length: ${memoryContext.length} chars`);
      console.log(
        `[AgentController] Retrieved ${relevantMemories.primary.length} primary + ${relevantMemories.conversation.length} conversation memories`
      );

      // SAFETY: Truncate long memory context to avoid huge prompts
      // The LLM can use search_memories tool for deeper recall if needed
      const MAX_MEMORY_CHARS = 200;
      if (memoryContext.length > MAX_MEMORY_CHARS) {
        console.warn(
          `[AgentController] memoryContext is ${memoryContext.length} chars; truncating to ${MAX_MEMORY_CHARS} chars. LLM can use search_memories tool for more.`
        );
        memoryContext = memoryContext.substring(0, MAX_MEMORY_CHARS) + "...";
      }

      // STEP 5: BUILD PERSONALIZED SYSTEM PROMPT
      // Inject user context (name, preferences) into the system prompt
      // This tells the LLM how to behave and remember important details
      const systemPrompt = buildSystemPromptWithUserContext(userProfile, userId, memoryContext);
      console.log(`[AgentController] System prompt length: ${systemPrompt.length} chars`);

      // OPTIMIZATION: Trim conversation history to reduce token usage
      // Keeping only last 10 messages balances context quality with token efficiency
      const MAX_HISTORY_MESSAGES = 10;
      if (history.length > MAX_HISTORY_MESSAGES) {
        console.warn(
          `[AgentController] history length is ${history.length}; trimming to last ${MAX_HISTORY_MESSAGES} messages to reduce prompt size.`
        );
        history = history.slice(-MAX_HISTORY_MESSAGES);
      }

      // STEP 6: PREPARE MESSAGES FOR LANGCHAIN
      // Convert conversation history to LangChain message objects
      const messages = [new SystemMessage(systemPrompt)];

      for (const msg of history) {
        if (msg.role === "user") {
          messages.push(new HumanMessage(msg.content));
        } else if (msg.role === "assistant") {
          messages.push(new AIMessage(msg.content));
        }
      }

      // Add the current user message
      messages.push(new HumanMessage(userMessage));

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
      let iteration = 0;
      let currentMessages = [...messages];

      while (iteration < this.maxIterations && !finalResponse) {
        iteration++;
        console.log(`[AgentController] Agent loop iteration ${iteration}/${this.maxIterations}`);

        try {
          // Invoke the LLM with all available tools
          const response = await llmWithTools.invoke(currentMessages);

          // Check if the LLM wants to call any tools
          if (response.tool_calls && response.tool_calls.length > 0) {
            console.log(`[AgentController] Tool calls requested: ${response.tool_calls.length}`);

            // Add the LLM's response (which includes tool calls) to the message history
            currentMessages.push(response);

            // Execute each tool call sequentially
            for (const toolCall of response.tool_calls) {
              console.log(`[AgentController] Executing tool: ${toolCall.name}`);

              // Find the tool in our tools array
              const tool = tools.find((t) => t.name === toolCall.name);

              if (tool) {
                try {
                  // Execute the tool with the arguments provided by the LLM
                  const result = await tool.func(toolCall.args);

                  // Add the tool result to the message history
                  // The LLM will use this result to inform its next response
                  currentMessages.push({
                    role: "tool",
                    content: result,
                    tool_call_id: toolCall.id,
                  });

                  console.log(`[AgentController] Tool ${toolCall.name} executed successfully`);
                } catch (error) {
                  console.error(`[AgentController] Tool execution error:`, error);
                  // Even if tool fails, add the error to the message history
                  currentMessages.push({
                    role: "tool",
                    content: `ok=false\nerr="${error.message}"`,
                    tool_call_id: toolCall.id,
                  });
                }
              } else {
                console.warn(`[AgentController] Tool not found: ${toolCall.name}`);
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
        await memoryStore.addAssistantMessage(sessionId, userId, finalResponse);
      } else {
        // Fallback response if something went wrong
        finalResponse = "Sorry, I encountered an issue processing the request. Please try again.";
        await memoryStore.addAssistantMessage(sessionId, userId, finalResponse);
      }

      // STEP 10: RETURN RESULT
      // Send back the response with metadata
      return {
        success: true,
        response: finalResponse,
        sessionId,
        messageCount: await memoryStore.getMessageCount(sessionId, userId),
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
}
