import fetch from "node-fetch";
import { config } from "../config/env.js";

/**
 * ========================================
 * GEMINI ADAPTER - API Communication Layer
 * ========================================
 * 
 * This adapter handles direct communication with the Google Gemini API.
 * It's the low-level interface that constructs HTTP requests and parses responses.
 * 
 * NOTE: This is currently maintained for compatibility but the system primarily
 * uses LangChain's ChatGoogleGenerativeAI wrapper instead of this direct adapter.
 * 
 * RESPONSIBILITIES:
 * 1. Format LangChain messages into Gemini API format
 * 2. Send requests to the Gemini API with configured parameters
 * 3. Parse Gemini's response format (candidates, parts, tokens)
 * 4. Handle error conditions (MAX_TOKENS, invalid responses)
 * 5. Extract actual content from Gemini's nested response structure
 */
export class GeminiAdapter {
  /**
   * Constructor - Initialize Gemini adapter with API credentials
   * 
   * @param {string} apiKey - Google Gemini API key (from config.env)
   * @param {string} model - Model identifier (default: gemini-2.0-flash)
   *        Available models: gemini-pro, gemini-pro-vision, gemini-2.0-flash, etc.
   */
  constructor(apiKey, model = config.geminiModel || "gemini-2.0-flash") {
    this.apiKey = apiKey;
    this.model = model;
    // Gemini API base URL - all requests go through generativelanguage.googleapis.com
    this.baseUrl = "https://generativelanguage.googleapis.com/v1beta/models";
  }

  /**
   * Send a request to Gemini API with optional tool definitions
   * 
   * FLOW:
   * 1. Convert LangChain messages to Gemini format
   * 2. Configure generation settings (temperature, tokens, etc.)
   * 3. Attach tool definitions if available
   * 4. Send POST request to Gemini API
   * 5. Parse and return JSON response
   * 
   * @param {Array<Object>} messages - Array of LangChain message objects
   *        Each message has: { role: "user"|"assistant", content: string }
   * @param {Array<Object>} tools - Optional array of tool definitions (for function calling)
   *        Each tool has: { name, description, inputSchema }
   * @returns {Promise<Object>} Raw Gemini API response with candidates array
   * @throws {Error} If API request fails or API returns an error
   * 
   * GENERATION CONFIG:
   * - temperature: 0.7 - moderate randomness for natural responses
   * - maxOutputTokens: 768 - balanced between detail and efficiency
   * - topK: 40 - nucleus sampling parameter
   * - topP: 0.95 - diversity vs coherence balance
   */
  async generateContent(messages, tools = null) {
    const url = `${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`;

    // Convert LangChain format messages to Gemini API format
    // (different role names, nested structure, etc.)
    const contents = this.convertMessagesToGeminiFormat(messages);

    // Build the request body with generation configuration
    const requestBody = {
      contents,
      generationConfig: {
        temperature: 0.7,  // Moderate randomness - balanced responses
        topK: 40,          // Nucleus sampling for diversity
        topP: 0.95,        // Cumulative probability for sampling
        maxOutputTokens: 768, // Enough detail but not wasteful
      },
    };

    // If tools are provided (for function calling), add them to the request
    // Tools allow the LLM to call functions in the agent system
    if (tools && tools.length > 0) {
      requestBody.tools = [
        {
          functionDeclarations: tools,
        },
      ];
    }

    // Send HTTP POST request to Gemini API
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    // Handle HTTP errors
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    // Parse response JSON
    const json = await response.json();

    // Check for MAX_TOKENS finish reason (model ran out of output space)
    // This is a soft limit - the model gracefully stops but may not have finished
    try {
      const candidate = json?.candidates?.[0];
      if (candidate && candidate.finishReason === "MAX_TOKENS") {
        console.warn(
          "GeminiAdapter.generateContent: model finished with MAX_TOKENS. Consider reducing prompt size or increasing maxOutputTokens if desired."
        );
      }
    } catch (e) {
      // Ignore logging errors
    }

    return json;
  }

  /**
   * Convert LangChain message format to Gemini API format
   * 
   * LangChain messages have a standardized format with role and content,
   * but Gemini API expects different role names and nested structure.
   * 
   * CONVERSIONS:
   * - LangChain "system" → Gemini "user" (Gemini doesn't support system role)
   * - LangChain "user" → Gemini "user" (human input)
   * - LangChain "assistant" → Gemini "model" (AI response)
   * - LangChain with functionCall → Gemini with functionCall part
   * - LangChain "function" → Gemini with functionResponse (tool result)
   * 
   * @param {Array<Object>} messages - LangChain message objects
   * @returns {Array<Object>} Gemini API format messages
   * 
   * Example conversion:
   * LangChain: { role: "user", content: "Hello" }
   * Gemini: { role: "user", parts: [{ text: "Hello" }] }
   */
  convertMessagesToGeminiFormat(messages) {
    return messages.map((msg) => {
      // Gemini doesn't support "system" role, convert to user with [System]: prefix
      if (msg.role === "system") {
        return {
          role: "user",
          parts: [{ text: `[System]: ${msg.content}` }],
        };
      }

      // Handle assistant messages with function calls (tool invocation)
      if (msg.role === "assistant" && msg.functionCall) {
        return {
          role: "model",
          parts: [
            {
              functionCall: msg.functionCall,
            },
          ],
        };
      }

      // Handle function response (tool result from system)
      if (msg.role === "function") {
        // Parse the content if it's a JSON string
        let responseContent = msg.content;
        if (typeof responseContent === "string") {
          try {
            responseContent = JSON.parse(responseContent);
          } catch (e) {
            // If parsing fails, keep as string
            console.warn("Could not parse function response:", e);
          }
        }

        return {
          role: "function",
          parts: [
            {
              functionResponse: {
                name: msg.name,
                response: responseContent,
              },
            },
          ],
        };
      }

      // Standard message conversion
      // Convert LangChain role names to Gemini role names
      return {
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      };
    });
  }

  /**
   * Extract the text/function response from Gemini's nested response structure
   * 
   * Gemini API responses are deeply nested:
   * {
   *   candidates: [{
   *     content: {
   *       parts: [{
   *         text: "Response text"
   *         OR functionCall: { name, args }
   *       }],
   *       role: "model"
   *     },
   *     finishReason: "STOP"
   *   }]
   * }
   * 
   * This method:
   * 1. Navigates the nested structure safely
   * 2. Checks for completion (finish reason)
   * 3. Returns the response with type indication
   * 4. Logs detailed errors if structure is unexpected
   * 
   * @param {Object} geminiResponse - Raw Gemini API response
   * @returns {Object} Parsed response with type: "text", "function_call", or "max_tokens"
   *          { type: "text", text: "..." }
   *          { type: "function_call", functionCall: { name, args } }
   *          { type: "max_tokens", candidate: {...} }
   * @throws {Error} If response structure is invalid or no content found
   * 
   * ERROR HANDLING:
   * - Defensive navigation through optional nested objects
   * - Logs full response for debugging if structure is unexpected
   * - Multiple fallback paths to find content
   */
  extractResponse(geminiResponse) {
    // Defensive parsing: Try several possible response shapes
    // Different Gemini API versions or edge cases may return different structures
    const candidate = geminiResponse?.candidates?.[0] || geminiResponse?.candidate || null;

    if (!candidate) {
      // Log full response for debugging
      console.error(
        "GeminiAdapter.extractResponse: no candidate found in response. Full response:\n",
        JSON.stringify(geminiResponse, null, 2)
      );
      throw new Error("No candidate in Gemini response (see server logs for raw Gemini payload)");
    }

    // Check for MAX_TOKENS finish reason (model ran out of output space)
    // This indicates the response was truncated
    if (candidate.finishReason === "MAX_TOKENS") {
      console.warn("⚠️ GeminiAdapter: Model hit MAX_TOKENS before completing response");
      return {
        type: "max_tokens",
        candidate: candidate,
        usageMetadata: geminiResponse.usageMetadata,
      };
    }

    // Try to locate the content part in several possible shapes
    // Gemini API response structure varies; we need to be defensive
    let part = null;
    if (candidate.content?.parts && candidate.content.parts.length > 0) {
      part = candidate.content.parts[0];
    } else if (candidate.content && typeof candidate.content === "object" && candidate.content.text) {
      part = { text: candidate.content.text };
    } else if (candidate.text) {
      part = { text: candidate.text };
    }

    if (!part) {
      // Log detailed information for debugging
      console.error(
        "GeminiAdapter.extractResponse: candidate present but no parts/text found. Candidate:\n",
        JSON.stringify(candidate, null, 2)
      );
      console.error("Full Gemini response:\n", JSON.stringify(geminiResponse, null, 2));
      throw new Error("No parts in Gemini response (see server logs for raw Gemini payload)");
    }

    // Check if this is a function call (tool invocation)
    if (part.functionCall) {
      return {
        type: "function_call",
        functionCall: part.functionCall,
      };
    }

    // Check if this is plain text response
    if (part.text) {
      return {
        type: "text",
        text: part.text,
      };
    }

    // Unknown part shape — log for inspection
    // This shouldn't happen, but helps catch API changes
    console.error("GeminiAdapter.extractResponse: unknown part shape:", JSON.stringify(part, null, 2));
    console.error("Full Gemini response:\n", JSON.stringify(geminiResponse, null, 2));
    throw new Error("Unknown response type from Gemini (see server logs for raw Gemini payload)");
  }
}
        if (typeof responseContent === "string") {
          try {
            responseContent = JSON.parse(responseContent);
          } catch (e) {
            // If parsing fails, keep as string
            console.warn("Could not parse function response:", e);
          }
        }

        return {
          role: "function",
          parts: [
            {
              functionResponse: {
                name: msg.name,
                response: responseContent,
              },
            },
          ],
        };
      }

      return {
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      };
    });
  }

  /**
   * Extract the response from Gemini's reply
   */
  extractResponse(geminiResponse) {
    // Defensive parsing: Gemini responses may change shape. Try common locations
    const candidate = geminiResponse?.candidates?.[0] || geminiResponse?.candidate || null;

    if (!candidate) {
      // Log the full response for debugging
      console.error(
        "GeminiAdapter.extractResponse: no candidate found in response. Full response:\n",
        JSON.stringify(geminiResponse, null, 2)
      );
      throw new Error("No candidate in Gemini response (see server logs for raw Gemini payload)");
    }

    // Check for MAX_TOKENS finish reason (model ran out of output space)
    if (candidate.finishReason === "MAX_TOKENS") {
      console.warn("⚠️ GeminiAdapter: Model hit MAX_TOKENS before completing response");
      // Return a special type so the caller can retry with a shorter request
      return {
        type: "max_tokens",
        candidate: candidate,
        usageMetadata: geminiResponse.usageMetadata,
      };
    }

    // Try to locate the main part in several possible shapes
    let part = null;
    if (candidate.content?.parts && candidate.content.parts.length > 0) {
      part = candidate.content.parts[0];
    } else if (candidate.content && typeof candidate.content === "object" && candidate.content.text) {
      part = { text: candidate.content.text };
    } else if (candidate.text) {
      part = { text: candidate.text };
    }

    if (!part) {
      // Log the full response for debugging
      console.error(
        "GeminiAdapter.extractResponse: candidate present but no parts/text found. Candidate:\n",
        JSON.stringify(candidate, null, 2)
      );
      console.error("Full Gemini response:\n", JSON.stringify(geminiResponse, null, 2));
      throw new Error("No parts in Gemini response (see server logs for raw Gemini payload)");
    }

    // If there is a function call
    if (part.functionCall) {
      return {
        type: "function_call",
        functionCall: part.functionCall,
      };
    }

    // If there is plain text
    if (part.text) {
      return {
        type: "text",
        text: part.text,
      };
    }

    // Unknown part shape — log for inspection
    console.error("GeminiAdapter.extractResponse: unknown part shape:", JSON.stringify(part, null, 2));
    console.error("Full Gemini response:\n", JSON.stringify(geminiResponse, null, 2));
    throw new Error("Unknown response type from Gemini (see server logs for raw Gemini payload)");
  }
}
