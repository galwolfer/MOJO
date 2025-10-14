import { GeminiAdapter } from "./geminiAdapter.js";
import { memoryStore } from "./memoryStore.js";
import { toolDefinitions, executeToolCall } from "./toolFunctions.js";
import { SYSTEM_PROMPT } from "./prompts.js";

/**
 * Agent Controller - הבקר המרכזי של האגנט
 */
export class AgentController {
  constructor(apiKey) {
    this.gemini = new GeminiAdapter(apiKey);
    this.maxIterations = 5; // מקסימום סיבובים למניעת לולאות אינסופיות
  }

  /**
   * עיבוד הודעה מהמשתמש
   */
  async processMessage(sessionId, userMessage, userId) {
    try {
      // הוספת הודעת המשתמש לזיכרון
      memoryStore.addUserMessage(sessionId, userMessage);

      // קבלת ההיסטוריה
      let history = memoryStore.getHistory(sessionId);

      // הוספת system prompt אם זו ההודעה הראשונה
      if (history.length === 1) {
        history = [{ role: "system", content: SYSTEM_PROMPT }, ...history];
      }

      // לולאה לטיפול בקריאות פונקציות
      let iteration = 0;
      let finalResponse = null;

      while (iteration < this.maxIterations) {
        iteration++;

        // שליחת בקשה ל-Gemini
        const geminiResponse = await this.gemini.generateContent(history, toolDefinitions);

        // חילוץ התשובה
        const response = this.gemini.extractResponse(geminiResponse);

        // אם זו תשובה טקסטואלית - סיימנו
        if (response.type === "text") {
          finalResponse = response.text;
          memoryStore.addAssistantMessage(sessionId, finalResponse);
          break;
        }

        // אם זו קריאה לפונקציה - נבצע אותה
        if (response.type === "function_call") {
          const { name, args } = response.functionCall;

          console.log(`Executing function: ${name}`, args);

          // הוספת הקריאה לזיכרון
          memoryStore.addFunctionCall(sessionId, response.functionCall);

          try {
            // ביצוע הפונקציה
            const functionResult = await executeToolCall(name, args);

            // הוספת התוצאה לזיכרון
            const resultString = JSON.stringify(functionResult);
            memoryStore.addFunctionResult(sessionId, name, resultString);

            // עדכון ההיסטוריה
            history = memoryStore.getHistory(sessionId);
          } catch (error) {
            console.error("Function execution error:", error);

            // הוספת שגיאה לזיכרון
            const errorMessage = JSON.stringify({
              error: error.message,
            });
            memoryStore.addFunctionResult(sessionId, name, errorMessage);

            history = memoryStore.getHistory(sessionId);
          }
        }
      }

      // אם הגענו למקסימום איטרציות ללא תשובה
      if (!finalResponse) {
        finalResponse = "מצטער, נתקלתי בבעיה בעיבוד הבקשה. אנא נסה שוב.";
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
   * איפוס סשן
   */
  resetSession(sessionId) {
    memoryStore.clearSession(sessionId);
    return { success: true, message: "Session reset successfully" };
  }

  /**
   * קבלת היסטוריית סשן
   */
  getSessionHistory(sessionId) {
    return memoryStore.getHistory(sessionId);
  }
}
