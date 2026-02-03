/*
 * File: src/controllers/Users.js
 * Purpose: Basic user listing and creation (mostly used by admin/CLI)
 */
import { User } from "../models/User.js";
import { Subcategory } from "../models/Subcategory.js";
import { CATEGORY_INDEX_TO_KEY, isValidCategory } from "../config/categories.js";
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

    const query = { userId: id };
    if (category !== undefined && category !== "") {
      let categoryKey = "";
      const parsed = parseInt(category, 10);
      if (!Number.isNaN(parsed)) {
        categoryKey = CATEGORY_INDEX_TO_KEY[parsed] || "";
      } else if (typeof category === "string") {
        categoryKey = category.toLowerCase().replace(/[^a-z_]/g, "");
      }

      if (categoryKey && isValidCategory(categoryKey)) {
        query.parent = categoryKey;
      }
    }

    const subs = await Subcategory.find(query).sort({ parent: 1, nameLower: 1 }).lean();
    const payload = subs.map((s) => ({
      id: s._id,
      name: s.name,
      parent: s.parent,
      icon: s.icon || null,
      color: s.color || null,
      source: s.source,
      confidence: s.confidence,
    }));

    res.json({ success: true, subCategories: payload });
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

    const query = { userId: id };

    if (category !== undefined && category !== "") {
      let categoryKey = "";
      const parsed = parseInt(category, 10);
      if (!Number.isNaN(parsed)) {
        categoryKey = CATEGORY_INDEX_TO_KEY[parsed] || "";
      } else if (typeof category === "string") {
        categoryKey = category.toLowerCase().replace(/[^a-z_]/g, "");
      }

      if (categoryKey && isValidCategory(categoryKey)) {
        query.parent = categoryKey;
      }
    }

    const subs = await Subcategory.find(query).select("name").lean();
    const available = Array.from(new Set(subs.map((s) => s.name).filter(Boolean))).sort();

    res.json({ success: true, available });
  } catch (e) {
    next(e);
  }
}
