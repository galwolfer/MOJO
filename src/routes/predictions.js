// src/routes/predictions.js
// API routes for task predictions

import { Router } from "express";
import { predictNextCategory, getPredictionProbabilities } from "../services/ml/mlPredictor.js";
import { getPredictionForUser, triggerPredictionJob } from "../services/ml/scheduledPrediction.js";
import Task from "../models/Task.js";
import { logger } from "../utils/logger.js";

const router = Router();

/**
 * GET /api/predictions
 * Get a task category prediction for the current user
 */
router.get("/", async (req, res, next) => {
  try {
    const userId = req.user?._id || req.query.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "User ID required",
      });
    }

    const prediction = await getPredictionForUser(userId);

    if (!prediction) {
      return res.status(404).json({
        success: false,
        error: "Could not generate prediction",
      });
    }

    res.json({
      success: true,
      data: prediction,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/predictions/calculate
 * Calculate prediction with provided priorities and recent counts
 * Useful for testing or when user data isn't in the database yet
 */
router.post("/calculate", async (req, res, next) => {
  try {
    const { priorities, recentCounts, timestamp } = req.body;

    const prediction = await predictNextCategory({
      priorities: priorities || {},
      recentCounts: recentCounts || {},
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    });

    res.json({
      success: true,
      data: prediction,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/predictions/probabilities
 * Get probability distribution across all categories
 */
router.get("/probabilities", async (req, res, next) => {
  try {
    const userId = req.user?._id || req.query.userId;

    // Get user priorities (from query or defaults)
    const priorities = req.query.priorities
      ? JSON.parse(req.query.priorities)
      : {
          work: 3,
          study: 3,
          health: 3,
          social: 3,
          finance: 3,
          household: 3,
          creative: 3,
          misc: 3,
        };

    // Get recent task counts
    let recentCounts = {};
    if (userId) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const tasks = await Task.find({
        user: userId,
        createdAt: { $gte: sevenDaysAgo },
      }).lean();

      for (const task of tasks) {
        const category = (task.category || "misc").toLowerCase();
        recentCounts[category] = (recentCounts[category] || 0) + 1;
      }
    }

    const result = await getPredictionProbabilities({
      priorities,
      recentCounts,
      timestamp: new Date(),
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/predictions/trigger
 * Manually trigger the prediction job (admin only)
 */
router.post("/trigger", async (req, res, next) => {
  try {
    // Add admin check here if needed
    // if (!req.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });

    logger.info("Manual prediction job triggered via API");
    
    // Run async - don't wait for completion
    triggerPredictionJob().catch((err) => {
      logger.error(`Triggered prediction job failed: ${err.message}`);
    });

    res.json({
      success: true,
      message: "Prediction job triggered",
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/predictions/feedback
 * Record user feedback on a prediction (for training data)
 */
router.post("/feedback", async (req, res, next) => {
  try {
    const userId = req.user?._id || req.body.userId;
    const { predictionId, accepted, actualCategory, timestamp } = req.body;

    // Store feedback for future model training
    // This could go to EventLog or a dedicated Feedback collection
    logger.info(`Prediction feedback: user=${userId}, accepted=${accepted}, actual=${actualCategory}`);

    // TODO: Save to database for model retraining
    /*
    await Feedback.create({
      userId,
      predictionId,
      accepted,
      predictedCategory: req.body.predictedCategory,
      actualCategory,
      timestamp: timestamp || new Date(),
    });
    */

    res.json({
      success: true,
      message: "Feedback recorded",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
