import mongoose from "mongoose";
import dotenv from "dotenv";
import { Memory } from "../src/models/index.js";

dotenv.config();

async function deepClean() {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/mojo");
    console.log("✅ Connected");

    // Delete ALL primary memories for this user (fresh start)
    const result = await Memory.deleteMany({
      category: "primary",
    });

    console.log(`🗑️  Deleted ${result.deletedCount} primary memories`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

deepClean();
