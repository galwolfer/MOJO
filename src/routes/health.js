/*
 * File: src/routes/health.js
 * Purpose: Simple health check route
 */
import { Router } from "express";
import { generalLimiter } from "../middlewares/rateLimiter.js";
const router = Router();

// Simple healthcheck
router.get("/health", generalLimiter, (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

export default router;
