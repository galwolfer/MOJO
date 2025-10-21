import { Embedding } from "../models/index.js";

/**
 * Simple local embedding generator (deterministic) for development.
 * It converts text to a fixed-size numeric vector without calling external APIs.
 * Replace with real embedding calls (Gemini/OpenAI) in production.
 */
function generateDeterministicVector(text, dim = 64) {
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

function cosineSimilarity(a, b) {
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
 * Store memory: create an embedding doc and save it
 */
export async function storeMemory(userId, memoryText, metadata = {}) {
  try {
    const vector = generateDeterministicVector(memoryText, 64);

    const emb = new Embedding({
      userId,
      sessionId: metadata.sessionId || null,
      text: memoryText,
      vector,
      metadata: metadata || {},
      memoryId: metadata.memoryId || null,
    });

    await emb.save();
    console.log(`✅ Embedding stored for user ${userId}`);
    return emb._id.toString();
  } catch (error) {
    console.error("Error storing embedding:", error);
    throw error;
  }
}

/**
 * Retrieve relevant memories for a user by approximate cosine similarity.
 * This is a naive in-memory approach: it fetches recent embeddings and ranks them.
 */
export async function retrieveRelevantMemories(userId, query, topK = 5) {
  try {
    if (!query) return [];
    const qvec = generateDeterministicVector(query, 64);

    // Fetch recent embeddings for the user (limit to 500 for performance)
    const rows = await Embedding.find({ userId }).sort({ createdAt: -1 }).limit(500).lean();

    const scored = rows
      .map((r) => {
        const sim = cosineSimilarity(qvec, r.vector || []);
        return {
          id: r._id.toString(),
          text: r.text,
          timestamp: r.createdAt,
          metadata: r.metadata || {},
          distance: 1 - (sim || 0), // lower is better
        };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, topK);

    return scored;
  } catch (error) {
    console.error("Error retrieving relevant memories:", error);
    return [];
  }
}

export async function getAllMemories(userId, limit = 100) {
  try {
    const rows = await Embedding.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean();
    return rows.map((r) => ({
      id: r._id.toString(),
      text: r.text,
      metadata: r.metadata || {},
      timestamp: r.createdAt,
    }));
  } catch (error) {
    console.error("Error getting all memories:", error);
    return [];
  }
}
