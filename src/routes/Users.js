/*
 * File: src/routes/Users.js
 * Purpose: User listing and creation routes
 */
import { Router } from "express";
import * as users from "../controllers/Users.js";

const r = Router();

// GET /api/users
r.get("/", users.list);

// POST /api/users
r.post("/", users.create);

// GET /api/users/:id/subcategories - user-saved subcategories (optionally filtered by ?category=<index>)
r.get("/:id/subcategories", users.getSubcategories);

// GET /api/users/:id/subcategories-available - merged/deduped user + historical task subcategories
r.get("/:id/subcategories-available", users.getAvailableSubcategories);

export default r;
