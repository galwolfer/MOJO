import mongoose from "mongoose";
import dotenv from "dotenv";
import { User, Session } from "../src/models/index.js";

dotenv.config();

/**
 * deep_clean.js
 * Removes all embedded memories from users and deletes all sessions.
 * Use with caution: this is destructive and will remove conversation history and stored memories.
 */
async function deepCleanAll() {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/mojo");
    console.log("✅ Connected to MongoDB\n");

    // Count memories and sessions before
    const memBeforeAgg = await User.aggregate([
      { $unwind: { path: "$memories", preserveNullAndEmptyArrays: true } },
      { $match: { memories: { $exists: true, $ne: null } } },
      { $count: "n" },
    ]);
    const memBefore = (memBeforeAgg[0] && memBeforeAgg[0].n) || 0;
    const sessBefore = await Session.countDocuments({});

    console.log(`🗂️  Embedded memories before: ${memBefore}`);
    console.log(`🗂️  Sessions before: ${sessBefore}`);

    // Clear all user memories
    const userRes = await User.updateMany(
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

    // Delete all sessions
    const delSess = await Session.deleteMany({});

    // Count after
    const memAfterAgg = await User.aggregate([
      { $unwind: { path: "$memories", preserveNullAndEmptyArrays: true } },
      { $match: { memories: { $exists: true, $ne: null } } },
      { $count: "n" },
    ]);
    const memAfter = (memAfterAgg[0] && memAfterAgg[0].n) || 0;
    const sessAfter = await Session.countDocuments({});

    console.log(`\n🧹 Users updated (memories cleared): ${userRes.matchedCount}`);
    console.log(`🧹 Sessions deleted: ${delSess.deletedCount}`);
    console.log(`\n✅ Embedded memories after: ${memAfter}`);
    console.log(`✅ Sessions after: ${sessAfter}`);

    await mongoose.disconnect();
    console.log("\n✅ Deep clean complete");
  } catch (error) {
    console.error("Error during deep clean:", error);
    process.exit(1);
  }
}

deepCleanAll();
