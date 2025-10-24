/**
 * Migration Script: Move memories from Memory collection to User.memories
 *
 * This script migrates all existing memories from the standalone Memory collection
 * to embedded memories within User documents, and updates user-level embeddings.
 *
 * Run this script once to migrate from the old structure to the new structure.
 */

import mongoose from "mongoose";
import { User, Memory } from "../src/models/index.js";
import { config } from "../src/config/env.js";

/**
 * Generate deterministic vector for migration
 */
function generateDeterministicVector(text, dim = 128) {
  const vec = new Array(dim).fill(0);
  if (!text) return vec;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const idx = i % dim;
    vec[idx] = (vec[idx] + (code % 97)) / 2 + Math.sin(code) * 0.0001;
  }

  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

/**
 * Update user-level embedding based on all memories
 */
function calculateUserEmbedding(memories) {
  const memoriesWithEmbeddings = memories.filter((m) => m.embedding && m.embedding.length > 0);

  if (memoriesWithEmbeddings.length === 0) {
    return null;
  }

  const dim = memoriesWithEmbeddings[0].embedding.length;
  const weightedSum = new Array(dim).fill(0);
  let totalWeight = 0;

  for (const memory of memoriesWithEmbeddings) {
    const weight = memory.importance * (memory.recencyWeight || 1.0);
    totalWeight += weight;

    for (let i = 0; i < dim; i++) {
      weightedSum[i] += memory.embedding[i] * weight;
    }
  }

  const userEmbedding = weightedSum.map((v) => v / totalWeight);
  const norm = Math.sqrt(userEmbedding.reduce((s, v) => s + v * v, 0)) || 1;
  return userEmbedding.map((v) => v / norm);
}

async function migrateMemories() {
  try {
    console.log("🚀 Starting memory migration...\n");

    // Connect to MongoDB
    await mongoose.connect(config.database.uri);
    console.log("✅ Connected to MongoDB\n");

    // Get all users
    const users = await User.find({});
    console.log(`📊 Found ${users.length} users\n`);

    let totalMigrated = 0;
    let totalSkipped = 0;

    for (const user of users) {
      console.log(`\n👤 Processing user: ${user.username} (${user._id})`);

      // Get all memories for this user from Memory collection
      const oldMemories = await Memory.find({ userId: user._id }).lean();

      if (oldMemories.length === 0) {
        console.log(`   ⏭️  No memories found, skipping...`);
        continue;
      }

      console.log(`   📦 Found ${oldMemories.length} memories in old collection`);

      // Check if user already has memories (to avoid duplicate migration)
      if (user.memories && user.memories.length > 0) {
        console.log(`   ⚠️  User already has ${user.memories.length} memories, skipping...`);
        totalSkipped += oldMemories.length;
        continue;
      }

      // Initialize memories array if not exists
      if (!user.memories) {
        user.memories = [];
      }

      // Migrate each memory
      for (const oldMemory of oldMemories) {
        // Ensure embedding exists
        let embedding = oldMemory.embedding;
        if (!embedding || embedding.length === 0) {
          embedding = generateDeterministicVector(oldMemory.text, 128);
        }

        const newMemory = {
          text: oldMemory.text,
          type: oldMemory.type || "general",
          category: oldMemory.category || "conversation",
          importance: oldMemory.importance || 5,
          priority: oldMemory.priority || 5,
          recencyWeight: oldMemory.recencyWeight || 1.0,
          lastAccessedAt: oldMemory.lastAccessedAt || oldMemory.createdAt || new Date(),
          source: oldMemory.source || "chat",
          sessionId: oldMemory.sessionId || null,
          embedding: embedding,
          metadata: oldMemory.metadata || {},
          createdAt: oldMemory.createdAt || new Date(),
          updatedAt: oldMemory.updatedAt || new Date(),
        };

        user.memories.push(newMemory);
        totalMigrated++;
      }

      // Calculate user-level embedding
      const userEmbedding = calculateUserEmbedding(user.memories);
      if (userEmbedding) {
        user.embedding = userEmbedding;
      }

      // Update memory stats
      user.memoryStats = {
        primaryCount: user.memories.filter((m) => m.category === "primary").length,
        conversationCount: user.memories.filter((m) => m.category === "conversation").length,
        lastMemoryUpdate: new Date(),
        lastEmbeddingUpdate: new Date(),
      };

      // Save user with embedded memories
      await user.save();

      console.log(`   ✅ Migrated ${oldMemories.length} memories to user document`);
      console.log(
        `   📊 Primary: ${user.memoryStats.primaryCount}, Conversation: ${user.memoryStats.conversationCount}`
      );
      console.log(`   🎯 User embedding: ${userEmbedding ? "Updated" : "Not available"}`);
    }

    console.log("\n\n📊 Migration Summary:");
    console.log(`   ✅ Total memories migrated: ${totalMigrated}`);
    console.log(`   ⏭️  Total memories skipped: ${totalSkipped}`);
    console.log(`   👥 Users processed: ${users.length}`);

    console.log("\n\n⚠️  IMPORTANT:");
    console.log("   The old Memory collection has NOT been deleted.");
    console.log("   Once you verify the migration is successful, you can manually drop it:");
    console.log("   > db.memories.drop()");
    console.log("\n   The Embedding collection is deprecated and can also be dropped:");
    console.log("   > db.embeddings.drop()");

    console.log("\n✅ Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

// Run migration
migrateMemories()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
