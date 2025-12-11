// Notes are in English as requested.
import dotenv from "dotenv";
dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number(process.env.PORT || 3000),
  MONGODB_URI: process.env.MONGODB_URI || "mongodb://localhost:27017/mojo",
  JWT_SECRET: process.env.JWT_SECRET || "your-secret-key-change-in-production",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
};

export const config = {
  geminiApiKey: process.env.GEMINI_API_KEY,
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3000),
  mongodbUri: process.env.MONGODB_URI || "mongodb://localhost:27017/mojo",
  jwtSecret: process.env.JWT_SECRET || "your-secret-key-change-in-production",
};