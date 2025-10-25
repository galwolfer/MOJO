// Notes are in English as requested.
// A single router that exposes subpaths per teammate.
// Each block is delimited so Ofek / Gal / Joni can work safely in parallel.

import { Router } from "express";
import healthRouter from "./health.js";
import chatRouter from "./chat.js";
import authRouter from "./auth.js";
import tasksRouter from "./tasks.js";
import {
  // Ofek controllers
  ofekListItems,
  ofekCreateItem,
  // Gal controllers
  galGetProfile,
  galUpdateProfile,
  // Joni controllers
  joniStats,
  joniTriggerJob,
} from "../controllers/index.js";

const router = Router();

// Shared/infra routes
router.use(healthRouter);

// Authentication routes (public)
router.use("/auth", authRouter);

// ==================== OFEK — ROUTES (START) ====================
// Base path for Ofek's feature-set

// Chat/Agent routes
router.use("/chat", chatRouter);

// Tasks routes
router.use("/tasks", tasksRouter);

// ==================== OFEK — ROUTES (END) ======================

// ==================== GAL — ROUTES (START) =====================
// Base path for Gal's feature-set
router.get("/gal/profile", galGetProfile);
router.put("/gal/profile", galUpdateProfile);
// Add more Gal routes below
// router.get('/gal/things', ...);
// ==================== GAL — ROUTES (END) =======================

// ==================== JONI — ROUTES (START) ====================
// Base path for Joni's feature-set
router.get("/joni/stats", joniStats);
router.post("/joni/job", joniTriggerJob);
// Add more Joni routes below
// router.delete('/joni/resource/:id', ...);
// ==================== JONI — ROUTES (END) ======================

export default router;
