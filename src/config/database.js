/*
 * File: src/config/database.js
 * Purpose: MongoDB connection helper
 */
import mongoose from "mongoose";
import { env } from "./env.js";

/**
 * MongoDB Connection
 */
export async function connectDatabase() {
  try {
    const mongoUri = env.MONGODB_URI || "mongodb://localhost:27017/mojo";

    await mongoose.connect(mongoUri, {
      // useNewUrlParser and useUnifiedTopology are default in Mongoose 6+
    });

    console.log("✅ MongoDB connected successfully");

    // Handle connection events
    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.log("⚠️ MongoDB disconnected");
    });

    return mongoose.connection;
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
    throw error;
  }
}

/**
 * Disconnect from MongoDB
 */
export async function disconnectDatabase() {
  try {
    await mongoose.disconnect();
    console.log("🔌 MongoDB disconnected successfully");
  } catch (error) {
    console.error("❌ Failed to disconnect MongoDB:", error);
    throw error;
  }
}

export default mongoose;
