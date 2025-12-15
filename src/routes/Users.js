// Notes are in English as requested.
import { Router } from "express";
import * as users from "../controllers/Users.js";

const r = Router();

// GET /api/users
r.get("/", users.list);

// POST /api/users
r.post("/", users.create);

export default r;
