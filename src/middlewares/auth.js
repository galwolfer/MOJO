import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const JWT_SECRET = env.JWT_SECRET || "your-secret-key-change-in-production";

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user info to req.user
 */
export function requireAuth(req, res, next) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "No token provided. Please login first.",
      });
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
    };

    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        error: "Invalid token",
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        error: "Token expired. Please login again.",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Authentication failed",
    });
  }
}

/**
 * Optional Authentication Middleware
 * Attaches user info if token is valid, but doesn't block request if not
 */
export function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET);

      req.user = {
        userId: decoded.userId,
        username: decoded.username,
      };
    }

    next();
  } catch (error) {
    // If token is invalid, just continue without user info
    next();
  }
}
