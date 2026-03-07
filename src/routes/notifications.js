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
import { SentReminder } from "../models/SentReminder.js";
import { InAppNotification } from "../models/InAppNotification.js";
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
        error: "Push token is required",
      });
    }

    const result = await registerPushToken(req.user.userId, token, platform);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json({
      success: true,
      message: "Push token registered successfully",
    });
  } catch (error) {
    console.error("Error registering push token:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to register push token",
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
      message: "Push token unregistered successfully",
    });
  } catch (error) {
    console.error("Error unregistering push token:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to unregister push token",
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
      error: "Failed to get notification preferences",
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
 *   ojoNotifications?: {
 *     enabled?: boolean,
 *     selectedOjoType?: string (mentorjo|brojo|bestojo|strictojo)
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
            error: "Hour must be between 0 and 23",
          });
        }
      }
      if (preferences.morningDigest.minute !== undefined) {
        const minute = preferences.morningDigest.minute;
        if (typeof minute !== "number" || minute < 0 || minute > 59) {
          return res.status(400).json({
            success: false,
            error: "Minute must be between 0 and 59",
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
          error: "Default reminder minutes must be between 5 and 1440",
        });
      }
    }

    // Validate ojoNotifications settings if provided
    if (preferences.ojoNotifications) {
      const validOjoTypes = ["mentorjo", "brojo", "bestojo", "strictojo", "chat", "auto", null];
      if (preferences.ojoNotifications.selectedOjoType !== undefined) {
        const ojoType = preferences.ojoNotifications.selectedOjoType;
        if (!validOjoTypes.includes(ojoType)) {
          return res.status(400).json({
            success: false,
            error: "Invalid Ojo type. Must be one of: mentorjo, brojo, bestojo, strictojo, chat, auto",
          });
        }
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
      error: "Failed to update notification preferences",
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
      message: "Test notification sent successfully",
    });
  } catch (error) {
    console.error("Error sending test notification:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to send test notification",
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
      error: "Failed to start periodic test notifications",
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
      error: "Failed to stop periodic test notifications",
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
    testModeActive: isActive,
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
      result,
    });
  } catch (error) {
    console.error("Error triggering morning digest test:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to trigger morning digest test",
    });
  }
});

/**
 * POST /api/notifications/test/task-reminder
 * Test task reminder notification for the authenticated user
 *
 * Body: {
 *   useSmartReminders?: boolean (default: true)
 * }
 */
router.post("/test/task-reminder", async (req, res) => {
  try {
    const { useSmartReminders = true } = req.body;
    const { testTaskReminderNotification } = await import("../services/notificationService.js");

    const result = await testTaskReminderNotification(req.user.userId, { useSmartReminders });

    return res.json(result);
  } catch (error) {
    console.error("Error testing task reminder:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to test task reminder",
    });
  }
});

/**
 * POST /api/notifications/test/subtask-reminder
 * Test subtask reminder notification for the authenticated user
 *
 * Body: {
 *   useSmartReminders?: boolean (default: true)
 * }
 */
router.post("/test/subtask-reminder", async (req, res) => {
  try {
    const { useSmartReminders = true } = req.body;
    const { testSubtaskReminderNotification } = await import("../services/notificationService.js");

    const result = await testSubtaskReminderNotification(req.user.userId, { useSmartReminders });

    return res.json(result);
  } catch (error) {
    console.error("Error testing subtask reminder:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to test subtask reminder",
    });
  }
});

/**
 * POST /api/notifications/test/smart-reminder
 * Test smart reminder calculation (shows ML prediction without sending notification)
 *
 * Body: {
 *   taskId?: string (optional - uses first upcoming task if not provided)
 * }
 */
router.post("/test/smart-reminder", async (req, res) => {
  try {
    const { taskId } = req.body;
    const { testSmartReminderCalculation } = await import("../services/notificationService.js");

    const result = await testSmartReminderCalculation(req.user.userId, taskId);

    return res.json(result);
  } catch (error) {
    console.error("Error testing smart reminder calculation:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to test smart reminder calculation",
    });
  }
});

/**
 * POST /api/notifications/test/ojo-reminder
 * Test Ojo-powered notification with AI-generated content
 *
 * Body: {
 *   ojoType?: string (optional - mentorjo|brojo|bestojo|strictojo)
 *                    If not provided and smart reminders enabled, auto-selects based on ML prediction
 *                    If not provided and smart reminders disabled, uses user's selected Ojo or mentorjo
 * }
 */
router.post("/test/ojo-reminder", async (req, res) => {
  try {
    const { ojoType } = req.body;
    const { testOjoReminderNotification } = await import("../services/notificationService.js");

    // Validate ojoType if provided
    if (ojoType) {
      const validOjoTypes = ["mentorjo", "brojo", "bestojo", "strictojo", "chat"];
      if (!validOjoTypes.includes(ojoType)) {
        return res.status(400).json({
          success: false,
          error: "Invalid Ojo type. Must be one of: mentorjo, brojo, bestojo, strictojo, chat",
        });
      }
    }

    const result = await testOjoReminderNotification(req.user.userId, { ojoType });

    return res.json(result);
  } catch (error) {
    console.error("Error testing Ojo reminder:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to test Ojo reminder notification",
    });
  }
});

/**
 * GET /api/notifications/sent-reminders
 * View all sent reminders for the authenticated user (from MongoDB).
 * Returns entries that haven't expired yet (TTL = 6 hours).
 */
router.get("/sent-reminders", async (req, res) => {
  try {
    const reminders = await SentReminder.find({ userId: req.user.userId })
      .sort({ sentAt: -1 })
      .populate("taskId", "taskname dueDate status predictedCompletionCategory")
      .lean();

    return res.json({
      success: true,
      count: reminders.length,
      reminders: reminders.map((r) => ({
        key: r.key,
        taskId: r.taskId?._id || r.taskId,
        taskName: r.taskId?.taskname || null,
        taskDueDate: r.taskId?.dueDate || null,
        predictionCategory: r.taskId?.predictedCompletionCategory || null,
        subtaskIndex: r.subtaskIndex,
        windowMinutes: r.windowMinutes,
        targetTime: r.targetTime,
        source: r.source,
        sentAt: r.sentAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching sent reminders:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch sent reminders",
    });
  }
});

// ─── In-App Notification Inbox ─────────────────────────────────────────

/**
 * GET /api/notifications/inbox
 * Fetch in-app notifications for the authenticated user.
 *
 * Query params:
 *   limit  – max items to return (default 50, max 100)
 *   before – ISO date cursor for pagination (fetch items older than this)
 *   unreadOnly – if "true", only return unread notifications
 */
router.get("/inbox", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const filter = { userId: req.user.userId };

    if (req.query.before) {
      filter.createdAt = { $lt: new Date(req.query.before) };
    }
    if (req.query.unreadOnly === "true") {
      filter.read = false;
    }

    const notifications = await InAppNotification.find(filter).sort({ createdAt: -1 }).limit(limit).lean();

    const unreadCount = await InAppNotification.countDocuments({
      userId: req.user.userId,
      read: false,
    });

    return res.json({ success: true, notifications, unreadCount });
  } catch (error) {
    console.error("Error fetching in-app notifications:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch notifications" });
  }
});

/**
 * GET /api/notifications/inbox/unread-count
 * Quick endpoint that returns only the unread badge count.
 */
router.get("/inbox/unread-count", async (req, res) => {
  try {
    const unreadCount = await InAppNotification.countDocuments({
      userId: req.user.userId,
      read: false,
    });
    return res.json({ success: true, unreadCount });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch unread count" });
  }
});

/**
 * PATCH /api/notifications/inbox/:id/read
 * Mark a single notification as read.
 */
router.patch("/inbox/:id/read", async (req, res) => {
  try {
    const notification = await InAppNotification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      { $set: { read: true } },
      { new: true },
    );

    if (!notification) {
      return res.status(404).json({ success: false, error: "Notification not found" });
    }

    return res.json({ success: true, notification });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return res.status(500).json({ success: false, error: "Failed to mark notification as read" });
  }
});

/**
 * PATCH /api/notifications/inbox/read-all
 * Mark all notifications as read for the authenticated user.
 */
router.patch("/inbox/read-all", async (req, res) => {
  try {
    const result = await InAppNotification.updateMany(
      { userId: req.user.userId, read: false },
      { $set: { read: true } },
    );

    return res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    return res.status(500).json({ success: false, error: "Failed to mark notifications as read" });
  }
});

/**
 * DELETE /api/notifications/inbox/:id
 * Delete a single in-app notification.
 */
router.delete("/inbox/:id", async (req, res) => {
  try {
    const result = await InAppNotification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!result) {
      return res.status(404).json({ success: false, error: "Notification not found" });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("Error deleting notification:", error);
    return res.status(500).json({ success: false, error: "Failed to delete notification" });
  }
});

export default router;
