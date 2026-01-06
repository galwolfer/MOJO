/*
 * File: src/routes/index.js
 * Purpose: Central router that mounts feature routers and team endpoints
 */
// A single router that exposes subpaths per feature.
// Each block is delimited so teams can work safely in parallel.

import { Router } from "express";
import healthRouter from "./health.js";
import chatRouter from "./chat.js";
import authRouter from "./auth.js";
import tasksRouter from "./tasks.js";
import {
  // Profile controllers
  profileGet,
  profileUpdate,
  // Priority controllers
  priorityNext,
  priorityFeedback,
  priorityStats,
  priorityTriggerJob,
} from "../controllers/index.js";

const router = Router();

// Shared/infra routes
router.use(healthRouter);

// Authentication routes (public)
router.use("/auth", authRouter);

// ==================== INFRA — CORE ROUTES (START) ====================
// Core routes: chat, tasks and other shared feature routers

// Chat/Agent routes
router.use("/chat", chatRouter);

// Tasks routes
router.use("/tasks", tasksRouter);

// ==================== INFRA — CORE ROUTES (END) ======================

// ==================== PROFILE — ROUTES (START) =====================
// Base path for profile feature
router.get("/profile", profileGet);
router.put("/profile", profileUpdate);
// Add more profile routes below
// router.get('/profile/things', ...);
// ==================== PROFILE — ROUTES (END) =======================

// ==================== PRIORITY — ROUTES (START) ====================
router.post("/priority/coach/next", priorityNext);
router.post("/priority/coach/feedback", priorityFeedback);

router.get("/priority/stats", priorityStats);
router.post("/priority/job", priorityTriggerJob);
// ==================== PRIORITY — ROUTES (END) ======================

export default router;