/*
 * File: src/config/env.js
 * Purpose: Environment variables and runtime configuration
 */
import dotenv from "dotenv";
dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number(process.env.PORT || 3000),
  MONGODB_URI: process.env.MONGODB_URI || "mongodb://localhost:27017/mojo",
  JWT_SECRET: process.env.JWT_SECRET || "your-secret-key-change-in-production",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL || "gemini-2.0-flash",
};

export const config = {
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.0-flash",
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3000),
  mongodbUri: process.env.MONGODB_URI || "mongodb://localhost:27017/mojo",
  jwtSecret: process.env.JWT_SECRET || "your-secret-key-change-in-production",
};
