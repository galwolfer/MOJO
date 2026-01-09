import mongoose from "mongoose";
import { startInMemoryMongo, stopInMemoryMongo, clearDatabase as clearInMemory } from "./mongoMemoryServer.js";

let started = false;

export async function connectDB() {
  if (!started) {
    await startInMemoryMongo();
    started = true;
    console.log("✅ Connected to in-memory MongoDB (test fixture)");
  }
  return mongoose.connection;
}

export async function disconnectDB() {
  if (started) {
    await stopInMemoryMongo();
    started = false;
    console.log("✅ Disconnected in-memory MongoDB (test fixture)");
  }
}

export async function clearDatabase() {
  await clearInMemory();
}
