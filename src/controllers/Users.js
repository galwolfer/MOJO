// Notes are in English as requested.
import User from "../models/User.js";

// Get all users
export async function list(_req, res, next) {
  try {
    const items = await User.find().lean();
    res.json(items);
  } catch (e) { next(e); }
}

// Create a new user
export async function create(req, res, next) {
  try {
    const item = await User.create(req.body);
    res.status(201).json(item);
  } catch (e) { next(e); }
}
