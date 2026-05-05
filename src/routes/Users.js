/*
 * File: src/routes/Users.js
 * Purpose: User listing and creation routes
 */
import { Router } from "express";
import { generalLimiter, strictLimiter } from "../middlewares/rateLimiter.js";
import * as users from "../controllers/Users.js";

const r = Router();

// GET /api/users
r.get("/", generalLimiter, users.list);

// POST /api/users
r.post("/", strictLimiter, users.create);

// GET /api/users/:id/subcategories - user-saved subcategories (optionally filtered by ?category=<index>)
r.get("/:id/subcategories", generalLimiter, users.getSubcategories);

// GET /api/users/:id/subcategories-available - merged/deduped user + historical task subcategories
r.get("/:id/subcategories-available", generalLimiter, users.getAvailableSubcategories);

export default r;
