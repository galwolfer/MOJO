import mongoose from "mongoose";
import { config } from "../config/env.js";
import { User, Session } from "../models/index.js";

async function migrate() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(config.mongodbUri);
    console.log("Connected.");

    const users = await User.find({});
    console.log(`Found ${users.length} users.`);

    for (const user of users) {
      console.log(`Processing user ${user.username} (${user._id})...`);

      // Find last 5 sessions for this user
      const sessions = await Session.find({ userId: user._id }).sort({ lastActiveAt: -1 }).limit(5);

      if (sessions.length === 0) {
        console.log(`  No sessions found.`);
        continue;
      }

      const summaries = sessions.map((s) => {
        // Get preview from last message
        const lastMsg = s.messages && s.messages.length > 0 ? s.messages[s.messages.length - 1] : null;
        const preview = lastMsg && lastMsg.content ? String(lastMsg.content).slice(0, 200) : "";

        return {
          sessionId: s.sessionId,
          lastActiveAt: s.lastActiveAt,
          createdAt: s.createdAt,
          messageCount: s.messageCount || (s.messages ? s.messages.length : 0),
          preview,
        };
      });

      user.sessions = summaries;
      await user.save();
      console.log(`  Updated with ${summaries.length} sessions.`);
    }

    console.log("Migration complete.");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await mongoose.disconnect();
  }
}

migrate();
