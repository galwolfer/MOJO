/**
 * Memory Store - Manages conversation memory
 */

class MemoryStore {
  constructor() {
    // Map of sessionId -> array of messages
    this.sessions = new Map();
    // Define the maximum number of messages to keep in memory
    this.maxMessages = 50;
  }

  /**
   * Retrieve conversation history
   */
  getHistory(sessionId) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, []);
    }
    return this.sessions.get(sessionId);
  }

  /**
   * Add a message to the history
   */
  addMessage(sessionId, message) {
    const history = this.getHistory(sessionId);
    history.push(message);

    // Maintain the message limit
    if (history.length > this.maxMessages) {
      history.shift(); // Remove the oldest message
    }
  }

  /**
   * Add a user message
   */
  addUserMessage(sessionId, content) {
    this.addMessage(sessionId, {
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Add an assistant message
   */
  addAssistantMessage(sessionId, content) {
    this.addMessage(sessionId, {
      role: "assistant",
      content,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Add a function call
   */
  addFunctionCall(sessionId, functionCall) {
    this.addMessage(sessionId, {
      role: "assistant",
      functionCall,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Add a function result
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
   * Clear session history
   */
  clearSession(sessionId) {
    this.sessions.delete(sessionId);
  }

  /**
   * Clear all sessions
   */
  clearAll() {
    this.sessions.clear();
  }

  /**
   * Get the number of messages in a session
   */
  getMessageCount(sessionId) {
    return this.getHistory(sessionId).length;
  }
}

// Create a single instance
export const memoryStore = new MemoryStore();
