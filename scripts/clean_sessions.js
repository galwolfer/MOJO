import mongoose from "mongoose";
import dotenv from "dotenv";
import { Session } from "../src/models/index.js";

dotenv.config();

async function cleanSessions() {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/mojo");
    console.log("✅ Connected to MongoDB\n");

    // Count existing sessions
    const before = await Session.countDocuments({});
    console.log(`🗂️  Found ${before} sessions before cleanup`);

    // Delete all sessions
    const del = await Session.deleteMany({});
    console.log(`🧹 Deleted ${del.deletedCount} sessions from the database`);

    const after = await Session.countDocuments({});
    console.log(`✅ Sessions remaining: ${after}`);

    await mongoose.disconnect();
    console.log("\n✅ Session cleanup complete");
  } catch (error) {
    console.error("Error cleaning sessions:", error);
    process.exit(1);
  }
}

cleanSessions();
