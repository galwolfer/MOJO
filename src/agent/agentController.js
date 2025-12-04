import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { memoryStore } from "../services/memoryService.js";
import { createLangChainTools } from "./langchainTools.js";
import { buildSystemPromptWithUserContext } from "./prompts.js";
import { User } from "../models/index.js";
import { config } from "../config/env.js";

/**
 * Agent Controller - The central controller for the agent
 * Now using LangChain for tool calling and agent orchestration
 */
export class AgentController {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.maxIterations = 3; // Maximum iterations to prevent infinite loops

    // Initialize LangChain LLM (model configurable via GEMINI_MODEL env var)
    this.llm = new ChatGoogleGenerativeAI({
      model: config.geminiModel || "gemini-2.0-flash",
      apiKey: apiKey,
      temperature: 0.2,
      maxOutputTokens: 768,
    });
  }
  /**
   * Process a user message with semantic memory retrieval
   */
  async processMessage(sessionId, userMessage, userId) {
    try {
      console.log(`[AgentController] Processing message for user: ${userId}, session: ${sessionId}`);

      // Add the user's message to memory
      await memoryStore.addUserMessage(sessionId, userId, userMessage);

      // Retrieve the history
      let history = await memoryStore.getHistory(sessionId);
      console.log(`[AgentController] History length: ${history.length}`);

      // Load user profile
      const user = await User.findById(userId);
      console.log(`[AgentController] User found:`, user ? `${user.username} (${user._id})` : "NOT FOUND");

      const userProfile = user?.profile || {};
      console.log(`[AgentController] User profile:`, {
        name: userProfile.name,
        tone: userProfile.tone,
        persona: userProfile.persona,
      });

      // ===== SEMANTIC MEMORY RETRIEVAL =====
      // Retrieve relevant memories based on the user's message
      console.log(`[AgentController] Retrieving relevant memories for query: "${userMessage.substring(0, 50)}..."`);

      const relevantMemories = await memoryStore.retrieveRelevantMemories(
        userId,
        userMessage,
        5 // Reduce to top 5 (was 10) to save tokens
      );

      // Format memories for prompt - COMPACT FORMAT to save tokens
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

      // ----- Safety: truncate long memory context to avoid huge prompts -----
      // Context is now supplementary - LLM can use search_memories tool for deeper recall
      const MAX_MEMORY_CHARS = 200;
      if (memoryContext.length > MAX_MEMORY_CHARS) {
        console.warn(
          `[AgentController] memoryContext is ${memoryContext.length} chars; truncating to ${MAX_MEMORY_CHARS} chars. LLM can use search_memories tool for more.`
        );
        memoryContext = memoryContext.substring(0, MAX_MEMORY_CHARS) + "...";
      }

      // Build personalized system prompt with user context AND (possibly truncated) memories
      const systemPrompt = buildSystemPromptWithUserContext(userProfile, userId, memoryContext);
      console.log(`[AgentController] System prompt length: ${systemPrompt.length} chars`);

      // Safety: trim conversation history to last N messages BEFORE adding system prompt
      const MAX_HISTORY_MESSAGES = 10; // Reduced from 20 to 10 to save significant tokens
      if (history.length > MAX_HISTORY_MESSAGES) {
        console.warn(
          `[AgentController] history length is ${history.length}; trimming to last ${MAX_HISTORY_MESSAGES} messages to reduce prompt size.`
        );
        history = history.slice(-MAX_HISTORY_MESSAGES);
      }

      // ===== LANGCHAIN TOOL CALLING =====
      // Create tools with user context
      const tools = createLangChainTools(userId);

      // Bind tools to LLM
      const llmWithTools = this.llm.bindTools(tools);

      // Convert history to LangChain messages
      const messages = [new SystemMessage(systemPrompt)];

      for (const msg of history) {
        if (msg.role === "user") {
          messages.push(new HumanMessage(msg.content));
        } else if (msg.role === "assistant") {
          messages.push(new AIMessage(msg.content));
        }
      }

      // Add current user message
      messages.push(new HumanMessage(userMessage));

      console.log(`[AgentController] Invoking LLM with ${messages.length} messages`);

      // Agent loop
      let finalResponse = null;
      let iteration = 0;
      let currentMessages = [...messages];

      while (iteration < this.maxIterations && !finalResponse) {
        iteration++;

        try {
          const response = await llmWithTools.invoke(currentMessages);

          // Check if there are tool calls
          if (response.tool_calls && response.tool_calls.length > 0) {
            console.log(`[AgentController] Tool calls requested: ${response.tool_calls.length}`);

            // Add AI response to messages
            currentMessages.push(response);

            // Execute each tool call
            for (const toolCall of response.tool_calls) {
              const tool = tools.find((t) => t.name === toolCall.name);

              if (tool) {
                try {
                  const result = await tool.func(toolCall.args);

                  // Add tool result to messages
                  currentMessages.push({
                    role: "tool",
                    content: result,
                    tool_call_id: toolCall.id,
                  });
                } catch (error) {
                  console.error(`[AgentController] Tool execution error:`, error);
                  currentMessages.push({
                    role: "tool",
                    content: `ok=false\nerr="${error.message}"`,
                    tool_call_id: toolCall.id,
                  });
                }
              }
            }
          } else {
            // No tool calls, this is the final response
            finalResponse = response.content;
            console.log(`[AgentController] Final response received`);
          }
        } catch (error) {
          console.error(`[AgentController] LLM invocation error:`, error);

          // Check if it's a MAX_TOKENS error
          if (error.message && error.message.includes("MAX_TOKENS")) {
            console.warn(`⚠️ Model hit MAX_TOKENS. Retrying with shorter request...`);

            // Add explicit request for brevity
            currentMessages.push(new HumanMessage("[System: Please provide a brief, concise response.]"));
            continue;
          } else {
            throw error;
          }
        }
      }

      // Save assistant response to memory
      if (finalResponse) {
        await memoryStore.addAssistantMessage(sessionId, userId, finalResponse);
      } else {
        finalResponse = "Sorry, I encountered an issue processing the request. Please try again.";
        await memoryStore.addAssistantMessage(sessionId, userId, finalResponse);
      }

      // Memory extraction is now handled by LangChain tools (save_user_fact, save_conversation_note)
      // The LLM decides what to save during the conversation, providing better control and transparency

      return {
        success: true,
        response: finalResponse,
        sessionId,
        messageCount: await memoryStore.getMessageCount(sessionId),
      };
    } catch (error) {
      console.error("Agent processing error:", error);
      throw error;
    }
  }

  /**
   * Reset a session
   */
  async resetSession(sessionId, userId) {
    await memoryStore.clearSession(sessionId);
    return { success: true, message: "Session reset successfully" };
  }

  /**
   * Retrieve session history
   */
  async getSessionHistory(sessionId, userId) {
    return await memoryStore.getHistory(sessionId);
  }
}
