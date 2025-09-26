// Notes are in English as requested.
import { Router } from "express";
const router = Router();

// Simple healthcheck
router.get("/health", (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

export default router;
