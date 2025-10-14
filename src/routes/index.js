// Notes are in English as requested.
// A single router that exposes subpaths per teammate.
// Each block is delimited so Ofek / Gal / Joni can work safely in parallel.

import { Router } from "express";
import healthRouter from "./health.js";
import chatRouter from "./chat.js";
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

// Chat/Agent routes
router.use("/chat", chatRouter);

// ==================== OFEK — ROUTES (START) ====================
// Base path for Ofek's feature-set
router.get("/ofek/items", ofekListItems);
router.post("/ofek/items", ofekCreateItem);
// Add more Ofek routes below
// router.put('/ofek/items/:id', ...);
// router.delete('/ofek/items/:id', ...);
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
