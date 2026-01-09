import { User } from "../models/User.js";
import { getCategoryKey } from "../config/categories.js";

/**
 * Return the user-defined importance for the given category key (string) if available.
 * Falls back to the user's priority mapping or middle value (3) as default.
 */
export async function getUserCategoryImportance(userId, categoryKey) {
  if (!userId) return 3;
  try {
    const user = await User.findById(userId).lean();
    if (!user || !user.profile) return 3;

    // Normalize the category key
    const key =
      typeof categoryKey === "number" ? getCategoryKey(categoryKey) : (categoryKey || "").toLowerCase().trim();

    const priorities = user.profile.priorities || {};
    const val = priorities[key];
    if (typeof val === "number" && val >= 1 && val <= 5) return val;
    return 3; // middle default
  } catch (err) {
    return 3;
  }
}
