import fetch from "node-fetch";

/**
 * Gemini API Adapter
 * מתאם לעבודה עם Google Gemini API
 */
export class GeminiAdapter {
  constructor(apiKey, model = "gemini-1.5-pro") {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = "https://generativelanguage.googleapis.com/v1beta/models";
  }

  /**
   * שליחת בקשה ל-Gemini
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

    // אם יש כלים, נוסיף אותם
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
   * המרת הודעות לפורמט של Gemini
   */
  convertMessagesToGeminiFormat(messages) {
    return messages.map((msg) => {
      if (msg.role === "system") {
        // Gemini לא תומך ב-system role, נהפוך ל-user
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
   * חילוץ התשובה מתגובת Gemini
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

    // אם יש קריאה לפונקציה
    if (part.functionCall) {
      return {
        type: "function_call",
        functionCall: part.functionCall,
      };
    }

    // אם יש טקסט רגיל
    if (part.text) {
      return {
        type: "text",
        text: part.text,
      };
    }

    throw new Error("Unknown response type from Gemini");
  }
}
