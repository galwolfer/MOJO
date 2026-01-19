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
import { getUserStats } from "../controllers/userController.js";
import { listOjoTypes, getOjoTypeByName } from "../controllers/ojoTypeController.js";
import { requireAuth } from "../middlewares/auth.js";

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

// ==================== OJOTYPES — ROUTES (START) ====================
// Public endpoints to read available OjoTypes (for the onboarding UI)
router.get("/ojo-types", listOjoTypes);
router.get("/ojo-types/:name", getOjoTypeByName);
// ==================== OJOTYPES — ROUTES (END) ======================

// ==================== PRIORITY — ROUTES (START) ====================
router.post("/priority/coach/next", priorityNext);
router.post("/priority/coach/feedback", priorityFeedback);

router.get("/priority/stats", priorityStats);
router.post("/priority/job", priorityTriggerJob);
// ==================== PRIORITY — ROUTES (END) ======================

// ==================== USER — ROUTES (START) ========================
// User stats and gamification endpoints
router.get("/user/stats", requireAuth, getUserStats);
// ==================== USER — ROUTES (END) ==========================

export default router;
