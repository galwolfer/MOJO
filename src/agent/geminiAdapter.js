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
        maxOutputTokens: 2048,
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

    return await response.json();
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
        return {
          role: "function",
          parts: [
            {
              functionResponse: {
                name: msg.name,
                response: msg.content,
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
    const candidate = geminiResponse.candidates?.[0];
    if (!candidate) {
      throw new Error("No candidate in Gemini response");
    }

    const part = candidate.content?.parts?.[0];
    if (!part) {
      throw new Error("No parts in Gemini response");
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

    throw new Error("Unknown response type from Gemini");
  }
}
