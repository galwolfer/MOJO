/*
 * File: src/controllers/Users.js
 * Purpose: Basic user listing and creation (mostly used by admin/CLI)
 */
import { User } from "../models/User.js";
import bcrypt from "bcryptjs";

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

    const user = new User({
      username,
      email,
      passwordHash,
      profile: {
        name: displayName || "",
        tone: "friendly",
        persona: "assistant",
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
