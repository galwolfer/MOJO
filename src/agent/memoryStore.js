/**
 * Memory Store - ניהול זיכרון השיחות
 */

class MemoryStore {
  constructor() {
    // Map של sessionId -> array של הודעות
    this.sessions = new Map();
    // הגדרת מקסימום הודעות לשמור בזיכרון
    this.maxMessages = 50;
  }

  /**
   * קבלת היסטוריית השיחה
   */
  getHistory(sessionId) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, []);
    }
    return this.sessions.get(sessionId);
  }

  /**
   * הוספת הודעה להיסטוריה
   */
  addMessage(sessionId, message) {
    const history = this.getHistory(sessionId);
    history.push(message);

    // שמירה על מגבלת ההודעות
    if (history.length > this.maxMessages) {
      history.shift(); // הסרת ההודעה הישנה ביותר
    }
  }

  /**
   * הוספת הודעת משתמש
   */
  addUserMessage(sessionId, content) {
    this.addMessage(sessionId, {
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * הוספת הודעת עוזר
   */
  addAssistantMessage(sessionId, content) {
    this.addMessage(sessionId, {
      role: "assistant",
      content,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * הוספת קריאת פונקציה
   */
  addFunctionCall(sessionId, functionCall) {
    this.addMessage(sessionId, {
      role: "assistant",
      functionCall,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * הוספת תוצאת פונקציה
   */
  addFunctionResult(sessionId, name, result) {
    this.addMessage(sessionId, {
      role: "function",
      name,
      content: result,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * ניקוי היסטוריה של סשן
   */
  clearSession(sessionId) {
    this.sessions.delete(sessionId);
  }

  /**
   * ניקוי כל הסשנים
   */
  clearAll() {
    this.sessions.clear();
  }

  /**
   * קבלת מספר ההודעות בסשן
   */
  getMessageCount(sessionId) {
    return this.getHistory(sessionId).length;
  }
}

// יצירת instance יחיד
export const memoryStore = new MemoryStore();
