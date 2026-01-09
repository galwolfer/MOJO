import { z } from "zod";
import { LightMission } from "./LightMission.js";
import { Task } from "../../models/Task.js";

const getSubcategories = new LightMission({
  name: "get_subcategories",
  group: "task",
  description: "Get list of existing subcategories for a given category used by the user.",
  schema: z.object({
    category: z.string().describe("The category to filter by (one of the 18 standard categories)"),
  }),
  execute: async ({ userId, args }) => {
    const { category } = args;
    try {
      // Use direct mongoose query here for simplicity, or move to taskService if reused
      const subcategories = await Task.distinct("subCategory.label", { userId: userId, category: category });
      const validSubcategories = subcategories.filter((s) => s && typeof s === "string" && s.trim().length > 0);

      return `ok=true\nsubcategories=${JSON.stringify(validSubcategories)}`;
    } catch (error) {
      return `ok=false\nerr="${error.message}"`;
    }
  },
});

export default getSubcategories;
