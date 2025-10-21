import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/mojo";

async function inspect() {
  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    const dbName = db.databaseName || "(unknown)";
    console.log("Connected to DB name:", dbName);

    const colls = await db.listCollections().toArray();
    const collNames = colls.map((c) => c.name);
    console.log("Collections found:", collNames.length ? collNames : "(none)");

    const targets = [
      "users",
      "sessions",
      "memories",
      "embeddings",
      "conversationmessages",
      "conversations",
      "datareferences",
      "datalakes",
    ];
    for (const t of targets) {
      if (collNames.includes(t)) {
        const cnt = await db.collection(t).countDocuments();
        console.log(`- ${t}: ${cnt} documents`);
      } else {
        console.log(`- ${t}: collection not found`);
      }
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error("Inspect error:", err);
    process.exit(1);
  }
}

inspect();
