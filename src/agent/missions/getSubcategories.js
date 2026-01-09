import { z } from "zod";
import { LightMission } from "./LightMission.js";
import { Task } from "../../models/Task.js";
import { User } from "../../models/User.js";
import { getCategoryIndex } from "../../config/categories.js";

const getSubcategories = new LightMission({
  name: "get_subcategories",
  group: "task",
  description:
    "Get list of existing subcategories for a given category used by the user (combines user saved and task-derived subcategories).",
  schema: z.object({
    category: z.string().describe("The category to filter by (one of the 18 standard categories)"),
  }),
  execute: async ({ userId, args }) => {
    const { category } = args;
    try {
      // Normalize incoming category key
      const categoryKey = (category || "").toLowerCase().replace(/[^a-z_]/g, "");

      // 1) Get user-specific subcategories from User.subCategories (stored as {name, category})
      let userSubs = [];
      try {
        const idx = getCategoryIndex(category);
        const user = await User.findById(userId).lean();
        if (user && Array.isArray(user.subCategories)) {
          userSubs = user.subCategories
            .filter((s) => s && typeof s.name === "string" && Number.isInteger(s.category) && s.category === idx)
            .map((s) => s.name.trim());
        }
      } catch (err) {
        // If category is invalid, userSubs remains empty; we'll still fall back to task-derived subs
      }

      // 2) Get historic subcategories seen on tasks (task-level subCategory.label)
      const taskSubs = await Task.distinct("subCategory.label", { userId: userId, category: categoryKey });
      const validTaskSubs = (taskSubs || [])
        .filter((s) => s && typeof s === "string" && s.trim().length > 0)
        .map((s) => s.trim());

      // Combine and dedupe
      const combined = new Set([...userSubs, ...validTaskSubs]);
      const final = Array.from(combined);

      return `ok=true\nsubcategories=${JSON.stringify(final)}`;
    } catch (error) {
      return `ok=false\nerr="${error.message}"`;
    }
  },
});

export default getSubcategories;
