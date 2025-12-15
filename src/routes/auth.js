import express from "express";
import { register, login, getMe, updateProfile } from "../controllers/authController.js";
import { requireAuth } from "../middlewares/auth.js";

const router = express.Router();

/**
 * Authentication Routes
 */

// Register new user
router.post("/register", register);

// Login user
router.post("/login", login);

// Get current user (protected)
router.get("/me", requireAuth, getMe);

// Update user profile (protected)
router.patch("/profile", requireAuth, updateProfile);

export default router;
