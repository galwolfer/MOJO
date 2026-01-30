/**
 * Notification Routes
 * 
 * API endpoints for push notification management:
 * - Register/unregister push tokens
 * - Update notification preferences
 * - Send test notifications
 */

import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import {
  registerPushToken,
  unregisterPushToken,
  updateNotificationPreferences,
  getNotificationPreferences,
  sendTestNotification,
  startPeriodicTestNotifications,
  stopPeriodicTestNotifications,
  isTestModeActive,
} from "../services/notificationService.js";

const router = Router();

// All notification routes require authentication
router.use(requireAuth);

/**
 * POST /api/notifications/register
 * Register or update push token for the authenticated user
 * 
 * Body: { token: string, platform?: 'ios' | 'android' }
 */
router.post("/register", async (req, res) => {
  try {
    const { token, platform } = req.body;
    
    if (!token) {
      return res.status(400).json({ 
        success: false, 
        error: "Push token is required" 
      });
    }

    const result = await registerPushToken(req.user.userId, token, platform);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json({ 
      success: true, 
      message: "Push token registered successfully" 
    });
  } catch (error) {
    console.error("Error registering push token:", error);
    return res.status(500).json({ 
      success: false, 
      error: "Failed to register push token" 
    });
  }
});

/**
 * POST /api/notifications/unregister
 * Remove push token and disable notifications for the authenticated user
 */
router.post("/unregister", async (req, res) => {
  try {
    const result = await unregisterPushToken(req.user.userId);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json({ 
      success: true, 
      message: "Push token unregistered successfully" 
    });
  } catch (error) {
    console.error("Error unregistering push token:", error);
    return res.status(500).json({ 
      success: false, 
      error: "Failed to unregister push token" 
    });
  }
});

/**
 * GET /api/notifications/preferences
 * Get notification preferences for the authenticated user
 */
router.get("/preferences", async (req, res) => {
  try {
    const result = await getNotificationPreferences(req.user.userId);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error("Error getting notification preferences:", error);
    return res.status(500).json({ 
      success: false, 
      error: "Failed to get notification preferences" 
    });
  }
});

/**
 * PUT /api/notifications/preferences
 * Update notification preferences for the authenticated user
 * 
 * Body: {
 *   enabled?: boolean,
 *   morningDigest?: {
 *     enabled?: boolean,
 *     hour?: number (0-23),
 *     minute?: number (0-59)
 *   },
 *   taskReminders?: {
 *     enabled?: boolean,
 *     defaultReminderMinutes?: number,
 *     useSmartReminders?: boolean
 *   },
 *   timezone?: string (IANA timezone)
 * }
 */
router.put("/preferences", async (req, res) => {
  try {
    const preferences = req.body;
    
    // Validate morningDigest hour/minute if provided
    if (preferences.morningDigest) {
      if (preferences.morningDigest.hour !== undefined) {
        const hour = preferences.morningDigest.hour;
        if (typeof hour !== "number" || hour < 0 || hour > 23) {
          return res.status(400).json({ 
            success: false, 
            error: "Hour must be between 0 and 23" 
          });
        }
      }
      if (preferences.morningDigest.minute !== undefined) {
        const minute = preferences.morningDigest.minute;
        if (typeof minute !== "number" || minute < 0 || minute > 59) {
          return res.status(400).json({ 
            success: false, 
            error: "Minute must be between 0 and 59" 
          });
        }
      }
    }

    // Validate defaultReminderMinutes if provided
    if (preferences.taskReminders?.defaultReminderMinutes !== undefined) {
      const minutes = preferences.taskReminders.defaultReminderMinutes;
      if (typeof minutes !== "number" || minutes < 5 || minutes > 1440) {
        return res.status(400).json({ 
          success: false, 
          error: "Default reminder minutes must be between 5 and 1440" 
        });
      }
    }

    const result = await updateNotificationPreferences(req.user.userId, preferences);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error("Error updating notification preferences:", error);
    return res.status(500).json({ 
      success: false, 
      error: "Failed to update notification preferences" 
    });
  }
});

/**
 * POST /api/notifications/test
 * Send a test notification to verify push notification setup
 */
router.post("/test", async (req, res) => {
  try {
    const result = await sendTestNotification(req.user.userId);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json({ 
      success: true, 
      message: "Test notification sent successfully" 
    });
  } catch (error) {
    console.error("Error sending test notification:", error);
    return res.status(500).json({ 
      success: false, 
      error: "Failed to send test notification" 
    });
  }
});

/**
 * POST /api/notifications/test/start
 * Start periodic test notifications (every 1 minute)
 */
router.post("/test/start", async (req, res) => {
  try {
    const result = await startPeriodicTestNotifications(req.user.userId);
    return res.json(result);
  } catch (error) {
    console.error("Error starting periodic test:", error);
    return res.status(500).json({ 
      success: false, 
      error: "Failed to start periodic test notifications" 
    });
  }
});

/**
 * POST /api/notifications/test/stop
 * Stop periodic test notifications
 */
router.post("/test/stop", async (req, res) => {
  try {
    const result = stopPeriodicTestNotifications(req.user.userId);
    return res.json(result);
  } catch (error) {
    console.error("Error stopping periodic test:", error);
    return res.status(500).json({ 
      success: false, 
      error: "Failed to stop periodic test notifications" 
    });
  }
});

/**
 * GET /api/notifications/test/status
 * Check if periodic test mode is active
 */
router.get("/test/status", (req, res) => {
  const isActive = isTestModeActive(req.user.userId);
  return res.json({ 
    success: true, 
    testModeActive: isActive 
  });
});

/**
 * POST /api/notifications/test/morning-digest
 * Manually trigger morning digest for testing (ignores daily limit)
 */
router.post("/test/morning-digest", async (req, res) => {
  try {
    const { testMorningDigestNotifications } = await import("../services/notificationService.js");
    const result = await testMorningDigestNotifications();
    return res.json({ 
      success: true, 
      message: "Morning digest test triggered (ignores daily limit)",
      result 
    });
  } catch (error) {
    console.error("Error triggering morning digest test:", error);
    return res.status(500).json({ 
      success: false, 
      error: "Failed to trigger morning digest test" 
    });
  }
});

export default router;
