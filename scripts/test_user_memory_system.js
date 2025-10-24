/**
 * Test Script: User Memory System
 *
 * Tests the new user-centric memory architecture
 */

import mongoose from "mongoose";
import { config } from "../src/config/env.js";
import { User } from "../src/models/index.js";
import {
  storePrimaryMemory,
  storeConversationMemory,
  retrievePrimaryMemories,
  retrieveConversationMemories,
  retrieveRelevantMemories,
  getAllMemories,
  getUserMemoryStats,
  getUserEmbedding,
  updateMemoryImportance,
} from "../src/agent/vectorStore.js";

async function testUserMemorySystem() {
  try {
    console.log("🧪 Testing User Memory System\n");

    // Connect to MongoDB
    await mongoose.connect(config.database.uri);
    console.log("✅ Connected to MongoDB\n");

    // Find or create test user
    let testUser = await User.findOne({ username: "test_memory_user" });

    if (!testUser) {
      console.log("Creating test user...");
      testUser = new User({
        username: "test_memory_user",
        email: "test_memory@example.com",
        passwordHash: "test_hash",
        profile: {
          name: "Test User",
          tone: "friendly",
        },
      });
      await testUser.save();
      console.log("✅ Test user created\n");
    } else {
      console.log("✅ Using existing test user\n");
      // Clear existing memories for clean test
      testUser.memories = [];
      await testUser.save();
      console.log("✅ Cleared existing memories\n");
    }

    const userId = testUser._id.toString();

    // Test 1: Store Primary Memory
    console.log("📝 Test 1: Store Primary Memory");
    const mem1 = await storePrimaryMemory(userId, "User prefers formal communication", {
      type: "preference",
      importance: 9,
      metadata: { source: "chat" },
    });
    console.log(`   ✅ Memory stored: ${mem1}\n`);

    // Test 2: Store Another Primary Memory
    console.log("📝 Test 2: Store Another Primary Memory");
    const mem2 = await storePrimaryMemory(userId, "User is a software developer", {
      type: "user_fact",
      importance: 8,
      metadata: { source: "profile" },
    });
    console.log(`   ✅ Memory stored: ${mem2}\n`);

    // Test 3: Store Conversation Memory
    console.log("📝 Test 3: Store Conversation Memory");
    const mem3 = await storeConversationMemory(userId, "Discussed project deadline", {
      type: "conversation",
      importance: 6,
      sessionId: "test-session-123",
      metadata: { topic: "project" },
    });
    console.log(`   ✅ Memory stored: ${mem3}\n`);

    // Test 4: Get User Embedding
    console.log("📝 Test 4: Get User Embedding");
    const userEmbedding = await getUserEmbedding(userId);
    console.log(`   ✅ User embedding exists: ${userEmbedding ? "Yes" : "No"}`);
    if (userEmbedding) {
      console.log(`   📊 Embedding dimension: ${userEmbedding.length}`);
      console.log(
        `   📊 First 5 values: ${userEmbedding
          .slice(0, 5)
          .map((v) => v.toFixed(3))
          .join(", ")}\n`
      );
    }

    // Test 5: Get Memory Stats
    console.log("📝 Test 5: Get Memory Stats");
    const stats = await getUserMemoryStats(userId);
    console.log(`   📊 Primary memories: ${stats.primaryCount}`);
    console.log(`   📊 Conversation memories: ${stats.conversationCount}`);
    console.log(`   📊 Total memories: ${stats.totalCount}`);
    console.log(`   📊 Last update: ${stats.lastMemoryUpdate}\n`);

    // Test 6: Retrieve Primary Memories
    console.log("📝 Test 6: Retrieve Primary Memories");
    const primaryMems = await retrievePrimaryMemories(userId, "communication preferences", 5);
    console.log(`   ✅ Retrieved ${primaryMems.length} primary memories:`);
    primaryMems.forEach((m, i) => {
      console.log(`      ${i + 1}. ${m.text} (importance: ${m.importance}, similarity: ${m.similarity.toFixed(3)})`);
    });
    console.log();

    // Test 7: Retrieve Conversation Memories
    console.log("📝 Test 7: Retrieve Conversation Memories");
    const convMems = await retrieveConversationMemories(userId, "project deadline", 5);
    console.log(`   ✅ Retrieved ${convMems.length} conversation memories:`);
    convMems.forEach((m, i) => {
      console.log(`      ${i + 1}. ${m.text} (importance: ${m.importance}, similarity: ${m.similarity.toFixed(3)})`);
    });
    console.log();

    // Test 8: Retrieve All Relevant Memories
    console.log("📝 Test 8: Retrieve All Relevant Memories");
    const allMems = await retrieveRelevantMemories(userId, "tell me about the user", 10);
    console.log(`   ✅ Retrieved:`);
    console.log(`      Primary: ${allMems.primary.length}`);
    console.log(`      Conversation: ${allMems.conversation.length}`);
    console.log(`      All: ${allMems.all.length}`);
    console.log(`   📄 Combined results:`);
    allMems.all.forEach((m, i) => {
      console.log(`      ${i + 1}. [${m.category}] ${m.text} (similarity: ${m.similarity.toFixed(3)})`);
    });
    console.log();

    // Test 9: Get All Memories
    console.log("📝 Test 9: Get All Memories");
    const allMemsRaw = await getAllMemories(userId, null, 100);
    console.log(`   ✅ Retrieved ${allMemsRaw.length} total memories\n`);

    // Test 10: Update Memory Importance
    console.log("📝 Test 10: Update Memory Importance");
    const firstMemId = testUser.memories[0]._id.toString();
    await updateMemoryImportance(userId, firstMemId, 10);
    console.log(`   ✅ Updated memory importance to 10`);

    // Check if user embedding was updated
    const newEmbedding = await getUserEmbedding(userId);
    const embeddingChanged = JSON.stringify(userEmbedding) !== JSON.stringify(newEmbedding);
    console.log(`   ✅ User embedding updated: ${embeddingChanged ? "Yes" : "No"}\n`);

    // Test 11: Verify User Document
    console.log("📝 Test 11: Verify User Document Structure");
    const updatedUser = await User.findById(userId).lean();
    console.log(`   ✅ User has ${updatedUser.memories.length} memories`);
    console.log(`   ✅ User embedding dimension: ${updatedUser.embedding?.length || 0}`);
    console.log(`   ✅ Memory stats:`, updatedUser.memoryStats);
    console.log(`   ✅ Metadata keys:`, Array.from(updatedUser.metadata?.keys() || []));
    console.log();

    console.log("✅ All tests completed successfully!\n");

    // Cleanup
    console.log("🧹 Cleanup: Removing test user...");
    await User.findByIdAndDelete(userId);
    console.log("✅ Test user removed\n");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

// Run tests
testUserMemorySystem()
  .then(() => {
    console.log("\n🎉 All tests passed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
