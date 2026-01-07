import { z } from "zod";
import { LightMission } from "./LightMission.js";
import { memoryStore } from "../../services/memoryService.js";

const saveUserFactMission = new LightMission({
  name: "save_user_fact",
  group: "memory",
  description: "Save a concise personal fact (2-5 words)",
  missionInfo: "When user shares personal info (name, location, education, work, preferences)",
  behavior: ["Write concisely (2-5 words for facts)."],
  schema: z.object({
    fact: z.string().describe("Concise fact about user (2-5 words, e.g., 'studies at Bar Ilan')"),
    category: z
      .enum(["name", "age", "location", "education", "work", "preference", "skill", "other"])
      .describe("Category of the fact"),
    importance: z.number().min(1).max(10).optional().default(7).describe("Importance level 1-10 (default: 7)"),
  }),
  execute: async ({ userId, args }) => {
    const { fact, category, importance = 7 } = args;
    try {
      // Map category to memory type for storage and retrieval
      let type = "user_fact";
      if (category === "preference") {
        type = "preference"; // Preferences are treated specially
      } else if (["name", "age", "location"].includes(category)) {
        type = "profile"; // Profile-related facts
      }

      // Save to database with importance score
      // Higher importance = more likely to be retrieved in future conversations
      await memoryStore.savePrimaryMemory(userId, fact, type, importance, {
        source: "llm_tool",
        category,
      });

      return `ok=true\nmsg="Saved: ${fact}"\ncat="${category}"\nimp=${importance}`;
    } catch (error) {
      return `ok=false\nerr="${error.message}"`;
    }
  },
});

export default saveUserFactMission;
