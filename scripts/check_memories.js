import mongoose from "mongoose";
import dotenv from "dotenv";
import { Memory } from "../src/models/index.js";

dotenv.config();

async function checkMemories() {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/mojo");
    console.log("✅ Connected to MongoDB\n");

    // Get recent memories
    const memories = await Memory.find({}).sort({ createdAt: -1 }).limit(15).lean();

    console.log(`📊 Found ${memories.length} recent memories:\n`);

    memories.forEach((m, i) => {
      console.log(`${i + 1}. [${m.category}/${m.type}] ${m.text.substring(0, 80)}`);
      console.log(`   User: ${m.userId}, Importance: ${m.importance}, Created: ${m.createdAt}`);
      console.log("");
    });

    await mongoose.disconnect();
    console.log("✅ Disconnected");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkMemories();
