import { z } from "zod";
import { LightMission } from "./LightMission.js";
import { Task } from "../../models/Task.js";
import { User } from "../../models/User.js";
import { getCategoryIndex, CATEGORY_DISPLAY_NAMES } from "../../config/categories.js";
import { okFalse, okTrue } from "../lib/errorFormatter.js";

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
      // Normalize incoming category key or display name
      let categoryKey = (category || "").toLowerCase().replace(/[^a-z_]/g, "");

      // If it's not a valid category key, try to match display names
      try {
        // getCategoryIndex throws on invalid key
        if (categoryKey) getCategoryIndex(categoryKey);
      } catch (err) {
        const normalize = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const found = Object.entries(CATEGORY_DISPLAY_NAMES).find(
          ([, display]) => normalize(display) === normalize(category),
        );
        if (found) categoryKey = found[0];
      }

      // 1) Get user-specific subcategories from User.subCategories (stored as {name, category})
      let userSubs = [];
      try {
        const idx = getCategoryIndex(categoryKey || category);
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

      // Return as a structured ok=true payload (subcategories key is JSON-encoded by okTrue)
      return okTrue({ subcategories: final });
    } catch (error) {
      return okFalse(error.message);
    }
  },
});

export default getSubcategories;
