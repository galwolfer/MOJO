/**
 * MongoDB Memory Store - Replaces SQLite-based memory store
 * Manages conversation memory, user profiles, and embeddings using MongoDB
 */
import { User, Session, Memory } from "../models/index.js";
import {
  storePrimaryMemory,
  storeConversationMemory,
  retrievePrimaryMemories,
  retrieveConversationMemories,
  retrieveRelevantMemories as retrieveFromVectorStore,
  getAllMemories as getAllMemoriesFromStore,
  pruneOldConversationMemories,
} from "./vectorStore.js";

class MongoMemoryStore {
  constructor() {
    // In-memory cache for active sessions (for performance)
    this.sessions = new Map();
    this.maxMessages = 50;
  }

  /**
   * Get or create user by MongoDB _id
   */
  async getUserById(userId) {
    try {
      const user = await User.findById(userId).select("-passwordHash");
      return user;
    } catch (error) {
      console.error("Error getting user:", error);
      return null;
    }
  }

  /**
   * Get user profile (for compatibility with existing code)
   */
  async getUserProfile(userId) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        // Return default profile if user not found
        return {
          userId: userId,
          tone: "friendly",
          persona: "assistant",
          settings: {},
        };
      }

      return {
        userId: user._id.toString(),
        tone: user.profile.tone,
        persona: user.profile.persona,
        settings: Object.fromEntries(user.profile.settings || new Map()),
      };
    } catch (error) {
      console.error("Error getting user profile:", error);
      return {
        userId: userId,
        tone: "friendly",
        persona: "assistant",
        settings: {},
      };
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId, updates) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        console.error("User not found:", userId);
        return null;
      }

      if (updates.tone) user.profile.tone = updates.tone;
      if (updates.persona) user.profile.persona = updates.persona;
      if (updates.settings) {
        user.profile.settings = new Map(Object.entries(updates.settings));
      }

      await user.save();

      return this.getUserProfile(userId);
    } catch (error) {
      console.error("Error updating user profile:", error);
      return null;
    }
  }

  /**
   * Get session history from cache or database
   */
  async getHistory(sessionId) {
    // Check cache first
    if (this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId);
    }

    // Load from database
    try {
      const session = await Session.findOne({ sessionId });

      if (session && session.messages.length > 0) {
        // Convert MongoDB documents to plain objects
        const messages = session.messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
          functionCall: msg.functionCall,
          name: msg.name,
          timestamp: msg.timestamp,
        }));

        // Cache it
        this.sessions.set(sessionId, messages);
        return messages;
      }

      // Return empty array if no session found
      const emptyHistory = [];
      this.sessions.set(sessionId, emptyHistory);
      return emptyHistory;
    } catch (error) {
      console.error("Error loading session history:", error);
      const emptyHistory = [];
      this.sessions.set(sessionId, emptyHistory);
      return emptyHistory;
    }
  }

  /**
   * Add a message to session (cache + database)
   */
  async addMessage(sessionId, userId, message) {
    try {
      // Add to cache
      const history = await this.getHistory(sessionId);
      history.push(message);

      // Maintain message limit in cache
      if (history.length > this.maxMessages) {
        history.shift();
      }

      // Update or create session in database
      await Session.findOneAndUpdate(
        { sessionId },
        {
          $set: { userId, lastActiveAt: new Date() },
          $push: { messages: message },
        },
        { upsert: true, new: true }
      );
    } catch (error) {
      console.error("Error adding message:", error);
    }
  }

  /**
   * Add a user message
   */
  async addUserMessage(sessionId, userId, content) {
    await this.addMessage(sessionId, userId, {
      role: "user",
      content,
      timestamp: new Date(),
    });
  }

  /**
   * Add an assistant message
   */
  async addAssistantMessage(sessionId, userId, content) {
    await this.addMessage(sessionId, userId, {
      role: "assistant",
      content,
      timestamp: new Date(),
    });
  }

  /**
   * Add a function call
   */
  async addFunctionCall(sessionId, userId, functionCall) {
    await this.addMessage(sessionId, userId, {
      role: "assistant",
      functionCall,
      timestamp: new Date(),
    });
  }

  /**
   * Add a function result
   */
  async addFunctionResult(sessionId, userId, name, result) {
    await this.addMessage(sessionId, userId, {
      role: "function",
      name,
      content: result,
      timestamp: new Date(),
    });
  }

  /**
   * Clear session (cache + database)
   */
  async clearSession(sessionId) {
    try {
      this.sessions.delete(sessionId);
      await Session.deleteOne({ sessionId });
    } catch (error) {
      console.error("Error clearing session:", error);
    }
  }

  /**
   * Get message count in session
   */
  async getMessageCount(sessionId) {
    const history = await this.getHistory(sessionId);
    return history.length;
  }

  /**
   * Save a memory to MongoDB with embeddings
   *
   * @param {string} userId - User ID
   * @param {string} memoryText - Memory text
   * @param {string} memoryType - Memory type
   * @param {number} importance - Importance (1-10)
   * @param {Object} options - Additional options
   * @returns {Promise<string>} Memory ID
   */
  async saveMemory(userId, memoryText, memoryType = "general", importance = 5, options = {}) {
    try {
      // Determine category based on type
      let category = "conversation";
      if (["profile", "preference", "user_fact"].includes(memoryType)) {
        category = "primary";
      }

      // Store using appropriate function
      let memoryId;
      if (category === "primary") {
        memoryId = await storePrimaryMemory(userId, memoryText, {
          type: memoryType,
          importance,
          metadata: options.metadata || {},
        });
      } else {
        memoryId = await storeConversationMemory(userId, memoryText, {
          type: memoryType,
          importance,
          sessionId: options.sessionId || null,
          metadata: options.metadata || {},
        });
      }

      console.log(`✅ Memory saved for user ${userId} [${category}/${memoryType}]`);
      return memoryId;
    } catch (error) {
      console.error("Error saving memory:", error);
      throw error;
    }
  }

  /**
   * Save primary memory (primary)
   * Settings, preferences, and facts about the user
   */
  async savePrimaryMemory(userId, memoryText, type = "user_fact", importance = 8, metadata = {}) {
    try {
      const memoryId = await storePrimaryMemory(userId, memoryText, {
        type,
        importance,
        metadata,
      });

      console.log(`✅ Primary memory saved: ${type}`);
      return memoryId;
    } catch (error) {
      console.error("Error saving primary memory:", error);
      throw error;
    }
  }

  /**
   * Save conversation memory (conversation)
   * Important information from conversations
   */
  async saveConversationMemory(userId, memoryText, type = "conversation", importance = 5, options = {}) {
    try {
      const memoryId = await storeConversationMemory(userId, memoryText, {
        type,
        importance,
        sessionId: options.sessionId || null,
        metadata: options.metadata || {},
      });

      console.log(`✅ Conversation memory saved: ${type}`);
      return memoryId;
    } catch (error) {
      console.error("Error saving conversation memory:", error);
      throw error;
    }
  }

  /**
   * Get all memories for a user
   *
   * @param {string} userId - User ID
   * @param {string} category - Filter by category ("primary", "conversation", or null for all)
   * @param {number} limit - Max number of memories to retrieve
   * @returns {Promise<Array>} Memories
   */
  async getMemories(userId, category = null, limit = 50) {
    try {
      return await getAllMemoriesFromStore(userId, category, limit);
    } catch (error) {
      console.error("Error getting memories:", error);
      return [];
    }
  }

  /**
   * Get primary memories (primary)
   */
  async getPrimaryMemories(userId, limit = 20) {
    try {
      return await getAllMemoriesFromStore(userId, "primary", limit);
    } catch (error) {
      console.error("Error getting primary memories:", error);
      return [];
    }
  }

  /**
   * Get conversation memories (conversation)
   */
  async getConversationMemories(userId, limit = 50) {
    try {
      return await getAllMemoriesFromStore(userId, "conversation", limit);
    } catch (error) {
      console.error("Error getting conversation memories:", error);
      return [];
    }
  }

  /**
   * Retrieve relevant memories using semantic search
   * Returns both primary and conversation memories
   *
   * @param {string} userId - User ID
   * @param {string} query - Search query
   * @param {number} topK - Number of results to return
   * @returns {Promise<Object>} Object with primary, conversation, and all memories
   */
  async retrieveRelevantMemories(userId, query, topK = 10) {
    try {
      const memories = await retrieveFromVectorStore(userId, query, topK);
      console.log(`✅ Retrieved memories:`, {
        primary: memories.primary.length,
        conversation: memories.conversation.length,
        total: memories.all.length,
      });
      return memories;
    } catch (error) {
      console.error("Error retrieving relevant memories:", error);
      return {
        primary: [],
        conversation: [],
        all: [],
      };
    }
  }

  /**
   * Retrieve only primary memories (primary)
   */
  async retrievePrimaryMemories(userId, query, topK = 5) {
    try {
      const memories = await retrievePrimaryMemories(userId, query, topK);
      console.log(`✅ Retrieved ${memories.length} primary memories`);
      return memories;
    } catch (error) {
      console.error("Error retrieving primary memories:", error);
      return [];
    }
  }

  /**
   * Retrieve only conversation memories (conversation)
   */
  async retrieveConversationMemories(userId, query, topK = 10, options = {}) {
    try {
      const memories = await retrieveConversationMemories(userId, query, topK, options);
      console.log(`✅ Retrieved ${memories.length} conversation memories`);
      return memories;
    } catch (error) {
      console.error("Error retrieving conversation memories:", error);
      return [];
    }
  }

  /**
   * Save conversation message (for compatibility)
   * This is handled automatically by addUserMessage/addAssistantMessage
   */
  async saveConversationMessage(userId, sessionId, role, content) {
    // Already handled by addMessage, but keep for compatibility
    return;
  }

  /**
   * Get conversation history from database
   */
  async getConversationHistory(userId, sessionId, limit = 20) {
    try {
      const session = await Session.findOne({ userId, sessionId });

      if (!session) {
        return [];
      }

      const messages = session.messages.slice(-limit).map((msg) => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
      }));

      return messages;
    } catch (error) {
      console.error("Error getting conversation history:", error);
      return [];
    }
  }

  /**
   * Prune old conversations and memories
   */
  async pruneOldConversations(userId, daysOld = 30) {
    try {
      // Prune old sessions
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const sessionResult = await Session.deleteMany({
        userId,
        lastActiveAt: { $lt: cutoffDate },
      });

      // Prune old conversation memories (but keep important ones)
      const memoryCount = await pruneOldConversationMemories(userId, daysOld);

      console.log(`✅ Pruned ${sessionResult.deletedCount} sessions and ${memoryCount} memories`);

      return {
        sessions: sessionResult.deletedCount,
        memories: memoryCount,
      };
    } catch (error) {
      console.error("Error pruning conversations:", error);
      return {
        sessions: 0,
        memories: 0,
      };
    }
  }

  /**
   * Estimate token count for messages
   */
  estimateTokenCount(messages) {
    // Rough estimate: ~4 characters per token
    const totalChars = messages.reduce((sum, msg) => {
      return sum + (msg.content ? msg.content.length : 0);
    }, 0);
    return Math.ceil(totalChars / 4);
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(userId, limit = 10) {
    try {
      const sessions = await Session.find({ userId })
        .sort({ lastActiveAt: -1 })
        .limit(limit)
        .select("sessionId lastActiveAt messages")
        .lean();

      return sessions.map((s) => ({
        sessionId: s.sessionId,
        lastActive: s.lastActiveAt,
        messageCount: s.messages.length,
      }));
    } catch (error) {
      console.error("Error getting user sessions:", error);
      return [];
    }
  }
}

// Create and export a single instance
export const memoryStore = new MongoMemoryStore();
