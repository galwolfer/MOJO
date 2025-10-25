import fetch from "node-fetch";

/**
 * Gemini API Adapter
 * Adapter for working with the Google Gemini API
 */
export class GeminiAdapter {
  constructor(apiKey, model = "gemini-2.5-flash") {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = "https://generativelanguage.googleapis.com/v1beta/models";
  }

  /**
   * Sending a request to Gemini
   */
  async generateContent(messages, tools = null) {
    const url = `${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`;

    const contents = this.convertMessagesToGeminiFormat(messages);

    const requestBody = {
      contents,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        // Balanced: enough for most responses, but not too much to waste tokens
        // 512 was too low for complex responses with internal thinking
        maxOutputTokens: 768,
      },
    };

    // If there are tools, add them
    if (tools && tools.length > 0) {
      requestBody.tools = [
        {
          functionDeclarations: tools,
        },
      ];
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const json = await response.json();

    // If the model finished due to MAX_TOKENS, log a warning so callers can react
    try {
      const candidate = json?.candidates?.[0];
      if (candidate && candidate.finishReason === "MAX_TOKENS") {
        console.warn(
          "GeminiAdapter.generateContent: model finished with MAX_TOKENS. Consider reducing prompt size or increasing maxOutputTokens if desired."
        );
      }
    } catch (e) {
      // ignore logging issues
    }

    return json;
  }

  /**
   * Convert messages to Gemini format
   */
  convertMessagesToGeminiFormat(messages) {
    return messages.map((msg) => {
      if (msg.role === "system") {
        // Gemini does not support the system role, convert to user
        return {
          role: "user",
          parts: [{ text: `[System]: ${msg.content}` }],
        };
      }

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

      if (msg.role === "function") {
        // Parse the content if it's a string (from JSON.stringify)
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
