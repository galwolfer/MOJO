import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "../src/models/index.js";

dotenv.config();

/**
 * clean_memories.js
 * Clears all embedded memories for every user in the database.
 * This will set each User.memories = [] and reset related memoryStats and embedding.
 */
async function cleanAllMemories() {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/mojo");
    console.log("✅ Connected to MongoDB\n");

    // Count total embedded memories before
    const beforeAgg = await User.aggregate([
      { $unwind: { path: "$memories", preserveNullAndEmptyArrays: true } },
      { $match: { memories: { $exists: true, $ne: null } } },
      { $count: "n" },
    ]);
    const before = (beforeAgg[0] && beforeAgg[0].n) || 0;
    console.log(`🗂️  Total embedded memories before cleanup: ${before}`);

    // Clear memories and reset basic stats on all users
    const res = await User.updateMany(
      {},
      {
        $set: {
          memories: [],
          "memoryStats.primaryCount": 0,
          "memoryStats.conversationCount": 0,
          "memoryStats.lastMemoryUpdate": new Date(),
          embedding: null,
        },
      }
    );

    console.log(`🧹 Updated ${res.matchedCount} user documents (memories cleared)`);

    // Count total embedded memories after
    const afterAgg = await User.aggregate([
      { $unwind: { path: "$memories", preserveNullAndEmptyArrays: true } },
      { $match: { memories: { $exists: true, $ne: null } } },
      { $count: "n" },
    ]);
    const after = (afterAgg[0] && afterAgg[0].n) || 0;
    console.log(`✅ Total embedded memories after cleanup: ${after}`);

    await mongoose.disconnect();
    console.log("\n✅ Memory cleanup complete!");
  } catch (error) {
    console.error("Error during memory cleanup:", error);
    process.exit(1);
  }
}

cleanAllMemories();
