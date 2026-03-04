import { z } from "zod";
import { LightMission } from "./LightMission.js";
import { Subcategory } from "../../models/Subcategory.js";
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

      // Fetch user-specific subcategories from the Subcategory collection
      let subcategories = [];
      try {
        getCategoryIndex(categoryKey || category);
        const subs = await Subcategory.find({ userId, parent: categoryKey }).select("name").lean();
        subcategories = (subs || []).map((s) => s.name).filter(Boolean);
      } catch (err) {
        // If category is invalid, fall through with empty list
      }

      // Return as a structured ok=true payload (subcategories key is JSON-encoded by okTrue)
      return okTrue({ subcategories });
    } catch (error) {
      return okFalse(error.message);
    }
  },
});

export default getSubcategories;
