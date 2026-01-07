import { z } from "zod";
import { LightMission } from "./LightMission.js";
import { memoryStore } from "../../services/memoryService.js";

const searchMemoriesMission = new LightMission({
  name: "search_memories",
  group: "memory",
  description: "Retrieve saved memories",
  missionInfo: "To recall past info about user not in recent context",
  schema: z.object({
    query: z.string().describe("What to search for in memories"),
    category: z
      .enum(["primary", "conversation", "all"])
      .optional()
      .default("all")
      .describe("Which category to search: primary (user facts), conversation (past discussions), or all"),
  }),
  execute: async ({ userId, args }) => {
    const { query, category = "all" } = args;
    try {
      let memories;
      // Search different categories based on user request
      if (category === "primary") {
        memories = await memoryStore.retrievePrimaryMemories(userId, query, 5);
      } else if (category === "conversation") {
        memories = await memoryStore.retrieveConversationMemories(userId, query, 5);
      } else {
        // Search both categories
        const result = await memoryStore.retrieveRelevantMemories(userId, query, 5);
        memories = result.all;
      }

      if (memories.length === 0) {
        return `ok=true\nmsg="No memories"\ncount=0`;
      }

      // Format results as structured TOML format
      const items = memories
        .map(
          (m) =>
            `[[mem]]\ntext="${m.text}"\ntype="${m.type}"\nimp=${m.importance}`
        )
        .join("\n");
      return `ok=true\ncount=${memories.length}\n${items}`;
    } catch (error) {
      return `ok=false\nerr="${error.message}"`;
    }
  },
});

export default searchMemoriesMission;
