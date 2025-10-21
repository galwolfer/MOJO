import mongoose from "mongoose";

/**
 * Embedding Schema - Stores vector embeddings for semantic search
 */
const embeddingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sessionId: {
      type: String,
      index: true,
    },
    text: {
      type: String,
      required: true,
    },
    vector: {
      type: [Number],
      required: true,
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    memoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Memory",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
embeddingSchema.index({ userId: 1, createdAt: -1 });
embeddingSchema.index({ userId: 1, sessionId: 1 });

// Note: For production vector search, consider MongoDB Atlas Vector Search
// or integrate with a dedicated vector DB (Pinecone, Milvus, etc.)

export const Embedding = mongoose.model("Embedding", embeddingSchema);
