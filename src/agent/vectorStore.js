import { Memory } from "../models/index.js";

/**
 * Vector Store - Manages embeddings within MongoDB Memory model
 * זיכרון ראשי (Primary Memory) - הגדרות, העדפות, עובדות על המשתמש
 * זיכרון שיחות (Conversation Memory) - מידע חשוב מהשיחות
 */

/**
 * Simple local embedding generator (deterministic) for development.
 * It converts text to a fixed-size numeric vector without calling external APIs.
 *
 * TODO: Replace with real embedding calls (Gemini Embeddings API) in production
 * @param {string} text - Text to embed
 * @param {number} dim - Dimension of the vector (default: 128)
 * @returns {number[]} Normalized vector
 */
function generateDeterministicVector(text, dim = 128) {
  const vec = new Array(dim).fill(0);
  if (!text) return vec;

  // Simple rolling hash to fill the vector
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const idx = i % dim;
    vec[idx] = (vec[idx] + (code % 97)) / 2 + Math.sin(code) * 0.0001;
  }

  // Normalize vector
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;

  let dot = 0;
  let na = 0;
  let nb = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }

  na = Math.sqrt(na) || 1;
  nb = Math.sqrt(nb) || 1;
  return dot / (na * nb);
}

/**
 * Store primary memory (זיכרון ראשי)
 * הגדרות, העדפות, עובדות על המשתמש
 *
 * @param {string} userId - User ID
 * @param {string} memoryText - Memory text to store
 * @param {Object} options - Options
 * @param {string} options.type - Memory type (profile, preference, user_fact)
 * @param {number} options.importance - Importance (1-10), default 8
 * @param {Object} options.metadata - Additional metadata
 * @returns {Promise<string>} Memory ID
 */
export async function storePrimaryMemory(userId, memoryText, options = {}) {
  try {
    const { type = "user_fact", importance = 8, metadata = {} } = options;

    // Validate type
    const validPrimaryTypes = ["profile", "preference", "user_fact"];
    if (!validPrimaryTypes.includes(type)) {
      throw new Error(`Invalid primary memory type: ${type}`);
    }

    // Generate embedding
    const embedding = generateDeterministicVector(memoryText, 128);

    // Calculate initial priority
    const priority = importance * 1.0; // recencyWeight = 1.0 at creation

    // Create memory
    const memory = new Memory({
      userId,
      text: memoryText,
      type,
      category: "primary",
      importance,
      priority,
      recencyWeight: 1.0,
      lastAccessedAt: new Date(),
      embedding,
      source: metadata.source || "chat",
      metadata: metadata || {},
    });

    await memory.save();
    console.log(`✅ Primary memory stored for user ${userId} [type: ${type}]`);

    // Enforce user memory limit (async, non-blocking)
    enforceUserMemoryLimit(userId).catch((err) => console.error("Error enforcing memory limit:", err));

    return memory._id.toString();
  } catch (error) {
    console.error("Error storing primary memory:", error);
    throw error;
  }
}

/**
 * Store conversation memory (זיכרון שיחות)
 * מידע חשוב מהשיחות, משימות, הערות
 *
 * @param {string} userId - User ID
 * @param {string} memoryText - Memory text to store
 * @param {Object} options - Options
 * @param {string} options.type - Memory type (conversation, conversation_summary, task, note)
 * @param {string} options.sessionId - Session ID (optional)
 * @param {number} options.importance - Importance (1-10), default 5
 * @param {Object} options.metadata - Additional metadata
 * @returns {Promise<string>} Memory ID
 */
export async function storeConversationMemory(userId, memoryText, options = {}) {
  try {
    const { type = "conversation", sessionId = null, importance = 5, metadata = {} } = options;

    // Validate type
    const validConversationTypes = ["conversation", "conversation_summary", "task", "note"];
    if (!validConversationTypes.includes(type)) {
      throw new Error(`Invalid conversation memory type: ${type}`);
    }

    // Generate embedding
    const embedding = generateDeterministicVector(memoryText, 128);

    // Calculate initial priority
    const priority = importance * 1.0;

    // Create memory
    const memory = new Memory({
      userId,
      text: memoryText,
      type,
      category: "conversation",
      importance,
      priority,
      recencyWeight: 1.0,
      lastAccessedAt: new Date(),
      embedding,
      sessionId,
      source: metadata.source || "chat",
      metadata: metadata || {},
    });

    await memory.save();
    console.log(`✅ Conversation memory stored for user ${userId} [type: ${type}]`);

    // Enforce memory limit
    enforceUserMemoryLimit(userId).catch((err) => console.error("Error enforcing memory limit:", err));

    return memory._id.toString();
  } catch (error) {
    console.error("Error storing conversation memory:", error);
    throw error;
  }
}

/**
 * Generic store memory function (backward compatibility)
 * @deprecated Use storePrimaryMemory or storeConversationMemory instead
 */
export async function storeMemory(userId, memoryText, metadata = {}) {
  const type = metadata.memoryType || "general";
  const category = metadata.category || "conversation";

  if (category === "primary") {
    return storePrimaryMemory(userId, memoryText, { type, ...metadata });
  } else {
    return storeConversationMemory(userId, memoryText, { type, ...metadata });
  }
}

/**
 * Retrieve relevant PRIMARY memories (זיכרון ראשי)
 * חיפוש סמנטי בהגדרות, העדפות, עובדות על המשתמש
 *
 * @param {string} userId - User ID
 * @param {string} query - Search query
 * @param {number} topK - Number of results to return
 * @returns {Promise<Array>} Relevant memories
 */
export async function retrievePrimaryMemories(userId, query, topK = 5) {
  try {
    if (!query) return [];

    const qvec = generateDeterministicVector(query, 128);

    // Fetch primary memories with embeddings
    const memories = await Memory.find({
      userId,
      category: "primary",
      embedding: { $exists: true, $ne: null },
    })
      .sort({ importance: -1, createdAt: -1 })
      .limit(100)
      .lean();

    if (memories.length === 0) {
      return [];
    }

    // Calculate similarities and rank
    const scored = memories
      .map((m) => {
        const sim = cosineSimilarity(qvec, m.embedding || []);
        return {
          id: m._id.toString(),
          text: m.text,
          type: m.type,
          importance: m.importance,
          timestamp: m.createdAt,
          metadata: m.metadata || {},
          similarity: sim,
          distance: 1 - (sim || 0),
        };
      })
      .sort((a, b) => {
        // Sort by importance first, then similarity
        if (a.importance !== b.importance) {
          return b.importance - a.importance;
        }
        return a.distance - b.distance;
      })
      .slice(0, topK);

    console.log(`✅ Retrieved ${scored.length} relevant primary memories`);
    return scored;
  } catch (error) {
    console.error("Error retrieving primary memories:", error);
    return [];
  }
}

/**
 * Retrieve relevant CONVERSATION memories (זיכרון שיחות)
 * חיפוש סמנטי במידע מהשיחות הקודמות
 *
 * @param {string} userId - User ID
 * @param {string} query - Search query
 * @param {number} topK - Number of results to return
 * @param {Object} options - Options
 * @param {string} options.sessionId - Filter by session ID
 * @param {number} options.minImportance - Minimum importance threshold
 * @returns {Promise<Array>} Relevant memories
 */
export async function retrieveConversationMemories(userId, query, topK = 10, options = {}) {
  try {
    if (!query) return [];

    const { sessionId = null, minImportance = 3 } = options;
    const qvec = generateDeterministicVector(query, 128);

    // Build filter
    const filter = {
      userId,
      category: "conversation",
      importance: { $gte: minImportance },
      embedding: { $exists: true, $ne: null },
    };

    if (sessionId) {
      filter.sessionId = sessionId;
    }

    // Fetch conversation memories with embeddings
    const memories = await Memory.find(filter).sort({ importance: -1, createdAt: -1 }).limit(200).lean();

    if (memories.length === 0) {
      return [];
    }

    // Calculate similarities and rank
    const scored = memories
      .map((m) => {
        const sim = cosineSimilarity(qvec, m.embedding || []);
        return {
          id: m._id.toString(),
          text: m.text,
          type: m.type,
          importance: m.importance,
          sessionId: m.sessionId,
          timestamp: m.createdAt,
          metadata: m.metadata || {},
          similarity: sim,
          distance: 1 - (sim || 0),
        };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, topK);

    console.log(`✅ Retrieved ${scored.length} relevant conversation memories`);
    return scored;
  } catch (error) {
    console.error("Error retrieving conversation memories:", error);
    return [];
  }
}

/**
 * Retrieve ALL relevant memories (זיכרון ראשי + שיחות)
 * חיפוש סמנטי בכל סוגי הזיכרון
 *
 * @param {string} userId - User ID
 * @param {string} query - Search query
 * @param {number} topK - Number of results to return
 * @returns {Promise<Object>} Object with primary and conversation memories
 */
export async function retrieveRelevantMemories(userId, query, topK = 10) {
  try {
    if (!query) {
      return {
        primary: [],
        conversation: [],
        all: [],
      };
    }

    // Retrieve both types in parallel
    const [primaryMemories, conversationMemories] = await Promise.all([
      retrievePrimaryMemories(userId, query, Math.ceil(topK * 0.3)), // 30% primary
      retrieveConversationMemories(userId, query, Math.ceil(topK * 0.7)), // 70% conversation
    ]);

    // Combine and sort by relevance
    const allMemories = [
      ...primaryMemories.map((m) => ({ ...m, category: "primary" })),
      ...conversationMemories.map((m) => ({ ...m, category: "conversation" })),
    ]
      .sort((a, b) => a.distance - b.distance)
      .slice(0, topK);

    return {
      primary: primaryMemories,
      conversation: conversationMemories,
      all: allMemories,
    };
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
 * Get all memories for a user by category
 */
export async function getAllMemories(userId, category = null, limit = 100) {
  try {
    const filter = { userId };
    if (category) {
      filter.category = category;
    }

    const memories = await Memory.find(filter).sort({ importance: -1, createdAt: -1 }).limit(limit).lean();

    return memories.map((m) => ({
      id: m._id.toString(),
      text: m.text,
      type: m.type,
      category: m.category,
      importance: m.importance,
      metadata: m.metadata || {},
      timestamp: m.createdAt,
    }));
  } catch (error) {
    console.error("Error getting all memories:", error);
    return [];
  }
}

/**
 * Update memory importance
 */
export async function updateMemoryImportance(memoryId, newImportance) {
  try {
    await Memory.findByIdAndUpdate(memoryId, { importance: newImportance });
    console.log(`✅ Memory importance updated: ${memoryId}`);
  } catch (error) {
    console.error("Error updating memory importance:", error);
    throw error;
  }
}

/**
 * Delete old conversation memories
 */
export async function pruneOldConversationMemories(userId, daysOld = 90) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await Memory.deleteMany({
      userId,
      category: "conversation",
      importance: { $lt: 6 }, // Keep important memories
      createdAt: { $lt: cutoffDate },
    });

    console.log(`✅ Pruned ${result.deletedCount} old conversation memories`);
    return result.deletedCount;
  } catch (error) {
    console.error("Error pruning memories:", error);
    return 0;
  }
}

/**
 * Calculate priority score: importance * recencyWeight
 * recencyWeight decays exponentially over time
 */
function calculatePriority(importance, createdAt, decayDays = 30) {
  const ageInDays = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
  const recencyWeight = Math.exp(-ageInDays / decayDays); // exponential decay
  return importance * recencyWeight;
}

/**
 * Update all memory priorities for a user
 * Should be called periodically (e.g., daily cron job)
 */
export async function updateUserMemoryPriorities(userId) {
  try {
    const memories = await Memory.find({
      userId,
      category: { $in: ["primary", "conversation"] },
    });

    for (const mem of memories) {
      const newPriority = calculatePriority(mem.importance, mem.createdAt);
      const newRecencyWeight = Math.exp(-(Date.now() - new Date(mem.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30));

      await Memory.findByIdAndUpdate(mem._id, {
        priority: newPriority,
        recencyWeight: newRecencyWeight,
      });
    }

    console.log(`✅ Updated priorities for user ${userId}`);
  } catch (error) {
    console.error("Error updating memory priorities:", error);
  }
}

/**
 * Enforce user-level memory limit (priority queue)
 * Keeps only top N memories by priority, removes lowest priority items
 *
 * @param {string} userId - User ID
 * @param {number} maxPrimaryMemories - Max primary memories (default: 100)
 * @param {number} maxConversationMemories - Max conversation memories (default: 200)
 */
export async function enforceUserMemoryLimit(userId, maxPrimaryMemories = 100, maxConversationMemories = 200) {
  try {
    // Update priorities first
    await updateUserMemoryPriorities(userId);

    // Prune primary memories
    const primaryCount = await Memory.countDocuments({ userId, category: "primary" });
    if (primaryCount > maxPrimaryMemories) {
      const toDelete = primaryCount - maxPrimaryMemories;

      // Find lowest priority memories
      const lowPriorityMemories = await Memory.find({ userId, category: "primary" })
        .sort({ priority: 1 }) // ascending (lowest first)
        .limit(toDelete)
        .select("_id");

      const idsToDelete = lowPriorityMemories.map((m) => m._id);
      await Memory.deleteMany({ _id: { $in: idsToDelete } });

      console.log(`✅ Pruned ${toDelete} low-priority primary memories for user ${userId}`);
    }

    // Prune conversation memories
    const conversationCount = await Memory.countDocuments({ userId, category: "conversation" });
    if (conversationCount > maxConversationMemories) {
      const toDelete = conversationCount - maxConversationMemories;

      const lowPriorityConversations = await Memory.find({ userId, category: "conversation" })
        .sort({ priority: 1 })
        .limit(toDelete)
        .select("_id");

      const idsToDelete = lowPriorityConversations.map((m) => m._id);
      await Memory.deleteMany({ _id: { $in: idsToDelete } });

      console.log(`✅ Pruned ${toDelete} low-priority conversation memories for user ${userId}`);
    }

    return true;
  } catch (error) {
    console.error("Error enforcing memory limit:", error);
    return false;
  }
}

/**
 * Prune old session messages (raw conversation logs)
 * These should be deleted after a short period (7-14 days) or summarized
 */
export async function pruneOldSessionMessages(userId, daysOld = 7) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await Memory.deleteMany({
      userId,
      category: "session_message",
      createdAt: { $lt: cutoffDate },
    });

    console.log(`✅ Pruned ${result.deletedCount} old session messages for user ${userId}`);
    return result.deletedCount;
  } catch (error) {
    console.error("Error pruning session messages:", error);
    return 0;
  }
}
