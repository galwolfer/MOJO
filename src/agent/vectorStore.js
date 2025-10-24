import { User } from "../models/index.js";

/**
 * Vector Store - Manages embeddings within User model
 * Memories are now stored directly in User documents with their embeddings
 * User-level embedding is updated dynamically based on all memories
 *
 * Primary Memory - Profile, preferences, facts about the user
 * Conversation Memory - Important information from conversations
 */

/**
 * Normalize text for embedding by removing stop words
 * This improves semantic matching by focusing on keywords
 */
function normalizeTextForEmbedding(text) {
  if (!text) return "";
  
  let normalized = text.toLowerCase();
  normalized = normalized.replace(/[.,?!;:()[\]{}'"]/g, ' ');
  
  // Stop words (English + Hebrew)
  const stopWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 
    'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 
    'to', 'was', 'will', 'with', 'you', 'your', 'do', 'does', 'did',
    'i', 'me', 'my', 'we', 'our', 'where', 'when', 'what', 'who', 'how',
    'this', 'these', 'those', 'can', 'could', 'would', 'should', 'may',
    'am', 'have', 'had', 'remember', 'recall', 'know', 'tell',
    'את', 'של', 'על', 'אני', 'זה', 'היא', 'הוא', 'שלי', 'לא', 'כן',
    'אבל', 'או', 'גם', 'רק', 'עוד', 'יש', 'היה', 'הייתי',
    'אתה', 'אתם', 'אנחנו', 'הם', 'הן', 'מה', 'איפה', 'מתי', 'איך',
    'למה', 'כי', 'אם', 'אז', 'כל', 'כבר', 'עדיין', 'פה', 'שם',
    'תזכור', 'לזכור', 'תזכרי', 'אתזכר'
  ]);
  
  const words = normalized.split(/\s+/)
    .filter(word => word.length > 2)
    .filter(word => !stopWords.has(word));
  
  return words.join(' ');
}

/**
 * Simple local embedding generator (deterministic) for development.
 * NOW WITH KEYWORD EXTRACTION for better semantic matching!
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

  // Extract keywords (remove stop words)
  const keywords = normalizeTextForEmbedding(text);
  if (!keywords) return vec;

  // Simple rolling hash to fill the vector
  for (let i = 0; i < keywords.length; i++) {
    const code = keywords.charCodeAt(i);
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
 * Update user-level embedding based on all memories
 * This creates a weighted average of all memory embeddings
 * Higher importance memories have more weight
 *
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} Success status
 */
async function updateUserEmbedding(userId, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Reload user to get latest version
      const user = await User.findById(userId);
      if (!user) {
        console.error("User not found for embedding update:", userId);
        return false;
      }

      // Get all memories with embeddings
      const memoriesWithEmbeddings = user.memories.filter((m) => m.embedding && m.embedding.length > 0);

      if (memoriesWithEmbeddings.length === 0) {
        console.log("No memories with embeddings found for user:", userId);
        return false;
      }

      // Calculate weighted average embedding
      const dim = memoriesWithEmbeddings[0].embedding.length;
      const weightedSum = new Array(dim).fill(0);
      let totalWeight = 0;

      for (const memory of memoriesWithEmbeddings) {
        // Weight by importance and recency
        const weight = memory.importance * memory.recencyWeight;
        totalWeight += weight;

        for (let i = 0; i < dim; i++) {
          weightedSum[i] += memory.embedding[i] * weight;
        }
      }

      // Normalize
      const userEmbedding = weightedSum.map((v) => v / totalWeight);

      // Normalize to unit vector
      const norm = Math.sqrt(userEmbedding.reduce((s, v) => s + v * v, 0)) || 1;
      const normalizedEmbedding = userEmbedding.map((v) => v / norm);

      // Update user embedding
      user.embedding = normalizedEmbedding;
      user.memoryStats.lastEmbeddingUpdate = new Date();
      await user.save();

      console.log(`✅ User embedding updated for user ${userId} based on ${memoriesWithEmbeddings.length} memories`);
      return true;
    } catch (error) {
      if (error.name === "VersionError" && attempt < retries - 1) {
        // Retry on version conflict
        console.log(`Retrying updateUserEmbedding (attempt ${attempt + 2}/${retries})...`);
        await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1))); // Exponential backoff
        continue;
      }
      console.error("Error updating user embedding:", error);
      return false;
    }
  }
  return false;
}

/**
 * Store primary memory (Primary Memory)
 * Profile, preferences, facts about the user
 * Stored directly in User.memories array
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

    // Find user and add memory
    const user = await User.findById(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // Create memory object
    const memory = {
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
      sessionId: null,
    };

    // Add to user's memories array
    user.memories.push(memory);

    // Update memory stats
    user.memoryStats.primaryCount = user.memories.filter((m) => m.category === "primary").length;
    user.memoryStats.lastMemoryUpdate = new Date();

    await user.save();

    // Get the newly added memory's ID
    const newMemory = user.memories[user.memories.length - 1];
    const memoryId = newMemory._id.toString();

    console.log(`✅ Primary memory stored for user ${userId} [type: ${type}]`);

    // Run post-save operations sequentially to avoid race conditions
    // First enforce limits, then update embedding
    enforceUserMemoryLimit(userId)
      .then(() => updateUserEmbedding(userId))
      .catch((err) => console.error("Error in post-save operations:", err));

    return memoryId;
  } catch (error) {
    console.error("Error storing primary memory:", error);
    throw error;
  }
}

/**
 * Store conversation memory (Conversation Memory)
 * Important information from conversations, tasks, notes
 * Stored directly in User.memories array
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

    // Find user and add memory
    const user = await User.findById(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // Create memory object
    const memory = {
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
    };

    // Add to user's memories array
    user.memories.push(memory);

    // Update memory stats
    user.memoryStats.conversationCount = user.memories.filter((m) => m.category === "conversation").length;
    user.memoryStats.lastMemoryUpdate = new Date();

    await user.save();

    // Get the newly added memory's ID
    const newMemory = user.memories[user.memories.length - 1];
    const memoryId = newMemory._id.toString();

    console.log(`✅ Conversation memory stored for user ${userId} [type: ${type}]`);

    // Run post-save operations sequentially to avoid race conditions
    // First enforce limits, then update embedding
    enforceUserMemoryLimit(userId)
      .then(() => updateUserEmbedding(userId))
      .catch((err) => console.error("Error in post-save operations:", err));

    return memoryId;
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
 * Retrieve relevant PRIMARY memories (Primary Memory)
 * Semantic search in user profile, preferences, and facts
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

    // Fetch user with memories
    const user = await User.findById(userId).lean();
    if (!user || !user.memories) {
      return [];
    }

    // Filter primary memories with embeddings
    const primaryMemories = user.memories.filter(
      (m) => m.category === "primary" && m.embedding && m.embedding.length > 0
    );

    if (primaryMemories.length === 0) {
      return [];
    }

    // Calculate similarities and rank
    const scored = primaryMemories
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
 * Retrieve relevant CONVERSATION memories (Conversation Memory)
 * Semantic search in conversation history
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

    // Fetch user with memories
    const user = await User.findById(userId).lean();
    if (!user || !user.memories) {
      return [];
    }

    // Filter conversation memories with embeddings
    let conversationMemories = user.memories.filter(
      (m) => m.category === "conversation" && m.importance >= minImportance && m.embedding && m.embedding.length > 0
    );

    // Filter by session if provided
    if (sessionId) {
      conversationMemories = conversationMemories.filter((m) => m.sessionId === sessionId);
    }

    if (conversationMemories.length === 0) {
      return [];
    }

    // Calculate similarities and rank
    const scored = conversationMemories
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
    const user = await User.findById(userId).lean();
    if (!user || !user.memories) {
      return [];
    }

    // Filter by category if provided
    let memories = user.memories;
    if (category) {
      memories = memories.filter((m) => m.category === category);
    }

    // Sort by importance and creation date
    memories = memories
      .sort((a, b) => {
        if (a.importance !== b.importance) {
          return b.importance - a.importance;
        }
        return new Date(b.createdAt) - new Date(a.createdAt);
      })
      .slice(0, limit);

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
export async function updateMemoryImportance(userId, memoryId, newImportance) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    const memory = user.memories.id(memoryId);
    if (!memory) {
      throw new Error(`Memory not found: ${memoryId}`);
    }

    memory.importance = newImportance;
    memory.priority = newImportance * memory.recencyWeight;
    await user.save();

    console.log(`✅ Memory importance updated: ${memoryId}`);

    // Update user embedding (async)
    updateUserEmbedding(userId).catch((err) => console.error("Error updating user embedding:", err));
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

    const user = await User.findById(userId);
    if (!user) {
      return 0;
    }

    // Filter out old, low-importance conversation memories
    const initialCount = user.memories.length;
    user.memories = user.memories.filter((m) => {
      if (m.category !== "conversation") return true; // Keep all non-conversation
      if (m.importance >= 6) return true; // Keep important memories
      if (new Date(m.createdAt) >= cutoffDate) return true; // Keep recent memories
      return false; // Remove old, low-importance conversation memories
    });

    const prunedCount = initialCount - user.memories.length;

    if (prunedCount > 0) {
      // Update stats
      user.memoryStats.conversationCount = user.memories.filter((m) => m.category === "conversation").length;
      await user.save();

      console.log(`✅ Pruned ${prunedCount} old conversation memories`);

      // Update user embedding (async)
      updateUserEmbedding(userId).catch((err) => console.error("Error updating user embedding:", err));
    }

    return prunedCount;
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
export async function updateUserMemoryPriorities(userId, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Reload user to get latest version
      const user = await User.findById(userId);
      if (!user) {
        return;
      }

      let updated = false;
      for (const mem of user.memories) {
        if (["primary", "conversation"].includes(mem.category)) {
          const newPriority = calculatePriority(mem.importance, mem.createdAt);
          const newRecencyWeight = Math.exp(
            -(Date.now() - new Date(mem.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30)
          );

          if (mem.priority !== newPriority || mem.recencyWeight !== newRecencyWeight) {
            mem.priority = newPriority;
            mem.recencyWeight = newRecencyWeight;
            updated = true;
          }
        }
      }

      if (updated) {
        await user.save();
        console.log(`✅ Updated priorities for user ${userId}`);
      }
      return; // Success
    } catch (error) {
      if (error.name === "VersionError" && attempt < retries - 1) {
        // Retry on version conflict
        console.log(`Retrying updateUserMemoryPriorities (attempt ${attempt + 2}/${retries})...`);
        await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1))); // Exponential backoff
        continue;
      }
      console.error("Error updating memory priorities:", error);
      return;
    }
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
export async function enforceUserMemoryLimit(
  userId,
  maxPrimaryMemories = 100,
  maxConversationMemories = 200,
  retries = 3
) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Update priorities first
      await updateUserMemoryPriorities(userId);

      // Reload user to get latest version
      const user = await User.findById(userId);
      if (!user) {
        return false;
      }

      let pruned = false;

      // Prune primary memories
      const primaryMemories = user.memories.filter((m) => m.category === "primary");
      if (primaryMemories.length > maxPrimaryMemories) {
        const toDelete = primaryMemories.length - maxPrimaryMemories;

        // Sort by priority (ascending) and remove lowest
        const sortedPrimary = primaryMemories.sort((a, b) => a.priority - b.priority);
        const idsToDelete = sortedPrimary.slice(0, toDelete).map((m) => m._id.toString());

        user.memories = user.memories.filter((m) => !idsToDelete.includes(m._id.toString()));
        pruned = true;

        console.log(`✅ Pruned ${toDelete} low-priority primary memories for user ${userId}`);
      }

      // Prune conversation memories
      const conversationMemories = user.memories.filter((m) => m.category === "conversation");
      if (conversationMemories.length > maxConversationMemories) {
        const toDelete = conversationMemories.length - maxConversationMemories;

        // Sort by priority (ascending) and remove lowest
        const sortedConversation = conversationMemories.sort((a, b) => a.priority - b.priority);
        const idsToDelete = sortedConversation.slice(0, toDelete).map((m) => m._id.toString());

        user.memories = user.memories.filter((m) => !idsToDelete.includes(m._id.toString()));
        pruned = true;

        console.log(`✅ Pruned ${toDelete} low-priority conversation memories for user ${userId}`);
      }

      if (pruned) {
        // Update stats
        user.memoryStats.primaryCount = user.memories.filter((m) => m.category === "primary").length;
        user.memoryStats.conversationCount = user.memories.filter((m) => m.category === "conversation").length;
        await user.save();
      }

      return true; // Success
    } catch (error) {
      if (error.name === "VersionError" && attempt < retries - 1) {
        // Retry on version conflict
        console.log(`Retrying enforceUserMemoryLimit (attempt ${attempt + 2}/${retries})...`);
        await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1))); // Exponential backoff
        continue;
      }
      console.error("Error enforcing memory limit:", error);
      return false;
    }
  }
  return false;
}

/**
 * Get user-level embedding
 * Returns the user's overall profile embedding
 *
 * @param {string} userId - User ID
 * @returns {Promise<Array|null>} User embedding vector or null
 */
export async function getUserEmbedding(userId) {
  try {
    const user = await User.findById(userId).select("embedding").lean();
    return user?.embedding || null;
  } catch (error) {
    console.error("Error getting user embedding:", error);
    return null;
  }
}

/**
 * Get user memory statistics
 *
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Memory statistics
 */
export async function getUserMemoryStats(userId) {
  try {
    const user = await User.findById(userId).select("memoryStats memories").lean();
    if (!user) {
      return {
        primaryCount: 0,
        conversationCount: 0,
        totalCount: 0,
        lastMemoryUpdate: null,
        lastEmbeddingUpdate: null,
      };
    }

    return {
      primaryCount: user.memoryStats.primaryCount || 0,
      conversationCount: user.memoryStats.conversationCount || 0,
      totalCount: user.memories?.length || 0,
      lastMemoryUpdate: user.memoryStats.lastMemoryUpdate,
      lastEmbeddingUpdate: user.memoryStats.lastEmbeddingUpdate,
    };
  } catch (error) {
    console.error("Error getting user memory stats:", error);
    return {
      primaryCount: 0,
      conversationCount: 0,
      totalCount: 0,
      lastMemoryUpdate: null,
      lastEmbeddingUpdate: null,
    };
  }
}
