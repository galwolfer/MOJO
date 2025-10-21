import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/mojo";

async function printDocs() {
  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    console.log("Connected to DB:", db.databaseName);

    const users = await db.collection("users").find().limit(5).toArray();
    console.log("\n--- users (sample) ---");
    console.dir(users, { depth: 4 });

    const sessions = await db.collection("sessions").find().limit(5).toArray();
    console.log("\n--- sessions (sample) ---");
    console.dir(sessions, { depth: 4 });

    const embeddings = await db.collection("embeddings").find().limit(3).toArray();
    console.log("\n--- embeddings (sample) ---");
    console.dir(embeddings, { depth: 4 });

    await mongoose.disconnect();
  } catch (err) {
    console.error("Error reading DB:", err);
    process.exit(1);
  }
}

printDocs();
