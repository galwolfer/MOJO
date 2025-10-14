import { GeminiAdapter } from "./geminiAdapter.js";
import { memoryStore } from "./memoryStore.js";
import { toolDefinitions, executeToolCall } from "./toolFunctions.js";
import { SYSTEM_PROMPT } from "./prompts.js";

/**
 * Agent Controller - The central controller for the agent
 */
export class AgentController {
  constructor(apiKey) {
    this.gemini = new GeminiAdapter(apiKey);
    this.maxIterations = 5; // Maximum iterations to prevent infinite loops
  }

  /**
   * Process a user message
   */
  async processMessage(sessionId, userMessage, userId) {
    try {
      // Add the user's message to memory
      memoryStore.addUserMessage(sessionId, userMessage);

      // Retrieve the history
      let history = memoryStore.getHistory(sessionId);

      // Add system prompt if this is the first message
      if (history.length === 1) {
        history = [{ role: "system", content: SYSTEM_PROMPT }, ...history];
      }

      // Loop to handle function calls
      let iteration = 0;
      let finalResponse = null;

      while (iteration < this.maxIterations) {
        iteration++;

        // Send request to Gemini
        const geminiResponse = await this.gemini.generateContent(history, toolDefinitions);

        // Extract the response
        const response = this.gemini.extractResponse(geminiResponse);

        // If it's a textual response - we're done
        if (response.type === "text") {
          finalResponse = response.text;
          memoryStore.addAssistantMessage(sessionId, finalResponse);
          break;
        }

        // If it's a function call - execute it
        if (response.type === "function_call") {
          const { name, args } = response.functionCall;

          console.log(`Executing function: ${name}`, args);

          // Add the call to memory
          memoryStore.addFunctionCall(sessionId, response.functionCall);

          try {
            // Execute the function
            const functionResult = await executeToolCall(name, args);

            // Add the result to memory
            const resultString = JSON.stringify(functionResult);
            memoryStore.addFunctionResult(sessionId, name, resultString);

            // Update the history
            history = memoryStore.getHistory(sessionId);
          } catch (error) {
            console.error("Function execution error:", error);

            // Add the error to memory
            const errorMessage = JSON.stringify({
              error: error.message,
            });
            memoryStore.addFunctionResult(sessionId, name, errorMessage);

            history = memoryStore.getHistory(sessionId);
          }
        }
      }

      // If we reached the maximum iterations without a response
      if (!finalResponse) {
        finalResponse = "Sorry, I encountered an issue processing the request. Please try again.";
        memoryStore.addAssistantMessage(sessionId, finalResponse);
      }

      return {
        success: true,
        response: finalResponse,
        sessionId,
        messageCount: memoryStore.getMessageCount(sessionId),
      };
    } catch (error) {
      console.error("Agent processing error:", error);
      throw error;
    }
  }

  /**
   * Reset a session
   */
  resetSession(sessionId) {
    memoryStore.clearSession(sessionId);
    return { success: true, message: "Session reset successfully" };
  }

  /**
   * Retrieve session history
   */
  getSessionHistory(sessionId) {
    return memoryStore.getHistory(sessionId);
  }
}
