import mongoose from "mongoose";

/**
 * DataLake Schema - Stores references to user's external data sources
 */
const dataLakeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sourceType: {
      type: String,
      enum: ["file", "url", "api", "database", "note", "document"],
      required: true,
    },
    uri: {
      type: String,
      required: true,
    },
    metadata: {
      filename: String,
      fileType: String,
      size: Number,
      description: String,
      tags: [String],
      custom: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
      },
    },
    indexed: {
      type: Boolean,
      default: false,
    },
    indexedAt: {
      type: Date,
    },
    embeddingIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Embedding",
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes
dataLakeSchema.index({ userId: 1, createdAt: -1 });
dataLakeSchema.index({ userId: 1, sourceType: 1 });
dataLakeSchema.index({ userId: 1, indexed: 1 });

export const DataLake = mongoose.model("DataLake", dataLakeSchema);
