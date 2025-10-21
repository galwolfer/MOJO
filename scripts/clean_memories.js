import mongoose from "mongoose";
import dotenv from "dotenv";
import { Memory } from "../src/models/index.js";

dotenv.config();

async function cleanBadMemories() {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/mojo");
    console.log("✅ Connected to MongoDB\n");

    // Delete memories that are clearly assistant responses saved as user facts
    const result = await Memory.deleteMany({
      category: "primary",
      type: { $in: ["user_fact", "preference"] },
      $or: [
        { text: /^(?:אני בסדר גמור|אני שמח לעזור|אני יכול להביא|בטח, אני|שלום אופק)/u },
        { text: /^(?:I can help|I'm happy to|Sure, I|Hello|Hi there)/ },
      ],
    });

    console.log(`🗑️  Deleted ${result.deletedCount} bad memories (assistant responses saved as user facts)\n`);

    // Show remaining memories
    const remaining = await Memory.find({}).sort({ createdAt: -1 }).limit(10).lean();

    console.log(`📊 Remaining ${remaining.length} recent memories:\n`);
    remaining.forEach((m, i) => {
      console.log(`${i + 1}. [${m.category}/${m.type}] ${m.text.substring(0, 60)}`);
    });

    await mongoose.disconnect();
    console.log("\n✅ Cleanup complete!");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

cleanBadMemories();
