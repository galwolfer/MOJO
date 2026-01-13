/*
 * File: src/controllers/Users.js
 * Purpose: Basic user listing and creation (mostly used by admin/CLI)
 */
import { User } from "../models/User.js";
import bcrypt from "bcryptjs";
import { getDefaultOjoType } from "../utils/ojoTypeUtils.js";

// Get all users
export async function list(_req, res, next) {
  try {
    const items = await User.find().lean();
    res.json(items);
  } catch (e) {
    next(e);
  }
}

// Create a new user
export async function create(req, res, next) {
  try {
    const { username, email, password, displayName } = req.body;

    // Basic validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: "username, email and password are required" });
    }

    if (typeof password === "string" && password.length < 6) {
      return res.status(400).json({ error: "password must be at least 6 characters" });
    }

    // Check uniqueness
    const existing = await User.findOne({ $or: [{ username }, { email }] });
    if (existing) return res.status(409).json({ error: "username or email already exists" });

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Get default OjoType
    const defaultOjoType = await getDefaultOjoType();

    const user = new User({
      username,
      email,
      passwordHash,
      profile: {
        name: displayName || "",
        ojoTypeId: defaultOjoType ? defaultOjoType._id : null,
        settings: {},
      },
    });

    await user.save();

    const out = user.toObject();
    delete out.passwordHash;

    res.status(201).json(out);
  } catch (e) {
    next(e);
  }
}

// GET /api/users/:id/subcategories?category=<optional>
// Returns user-saved subcategories, optionally filtered by category index
export async function getSubcategories(req, res, next) {
  try {
    const { id } = req.params;
    const { category } = req.query;
    if (!id) return res.status(400).json({ error: "user id is required" });

    const user = await User.findById(id).lean();
    if (!user) return res.status(404).json({ error: "user not found" });

    let subs = Array.isArray(user.subCategories)
      ? user.subCategories.map((s) => ({ name: s.name, category: s.category }))
      : [];

    // Optional category filter by index
    if (category !== undefined && category !== "") {
      try {
        const catIdx = parseInt(category, 10);
        if (!Number.isNaN(catIdx)) {
          subs = subs.filter((s) => s.category === catIdx);
        }
      } catch (err) {
        // Ignore parse errors, return all
      }
    }

    res.json({ success: true, subCategories: subs });
  } catch (e) {
    next(e);
  }
}

// GET /api/users/:id/subcategories-available?category=<optional>
// Returns merged and deduplicated subcategories (user-saved + historical task labels)
// Mirrors the get_subcategories mission behavior for frontend consumption
export async function getAvailableSubcategories(req, res, next) {
  try {
    const { id } = req.params;
    const { category } = req.query;
    if (!id) return res.status(400).json({ error: "user id is required" });

    const user = await User.findById(id).lean();
    if (!user) return res.status(404).json({ error: "user not found" });

    let userSubs = [];
    let taskSubs = [];

    // If category is specified, filter by numeric index
    if (category !== undefined && category !== "") {
      try {
        const catIdx = parseInt(category, 10);
        if (!Number.isNaN(catIdx) && catIdx >= 0 && catIdx <= 17) {
          // User-saved subs filtered by category
          userSubs = (user.subCategories || [])
            .filter((s) => s && typeof s.name === "string" && s.category === catIdx)
            .map((s) => s.name.trim());

          // Task-derived subs filtered by category (need to query tasks)
          const categoryMap = {
            0: "study_and_education",
            1: "skill_building",
            2: "workout",
            3: "reflection",
            4: "home_and_chores",
            5: "family",
            6: "life_management",
            7: "work_and_career",
            8: "creative_projects",
            9: "hobbies",
            10: "relationship",
            11: "goals",
            12: "mindfulness",
            13: "health",
            14: "social_activity",
            15: "recovery",
            16: "exploration",
            17: "uncategorized",
          };
          const catKey = categoryMap[catIdx];
          if (catKey) {
            const { Task } = await import("../../models/Task.js");
            const tasks = await Task.find({ userId: id, category: catKey }).select("subCategory.label").lean();
            taskSubs = tasks
              .filter((t) => t.subCategory && t.subCategory.label && typeof t.subCategory.label === "string")
              .map((t) => t.subCategory.label.trim())
              .filter((label) => label.length > 0);
          }
        }
      } catch (err) {
        // Ignore parse/import errors
      }
    } else {
      // No category filter: return all user-saved subs and all task-derived subs
      userSubs = (user.subCategories || []).filter((s) => s && typeof s.name === "string").map((s) => s.name.trim());

      const { Task } = await import("../../models/Task.js");
      const tasks = await Task.find({ userId: id }).select("subCategory.label").lean();
      taskSubs = tasks
        .filter((t) => t.subCategory && t.subCategory.label && typeof t.subCategory.label === "string")
        .map((t) => t.subCategory.label.trim())
        .filter((label) => label.length > 0);
    }

    // Merge and dedupe
    const combined = new Set([...userSubs, ...taskSubs]);
    const available = Array.from(combined).sort();

    res.json({ success: true, available });
  } catch (e) {
    next(e);
  }
}
