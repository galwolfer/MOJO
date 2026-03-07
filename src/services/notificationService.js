/**
 * Push Notification Service
 *
 * Handles Expo Push Notifications for:
 * - Morning task digest (8 AM daily)
 * - Smart task reminders based on ML predictions
 * - Deadline warnings
 * - Ojo-powered personalized notifications
 *
 * Works with both development APKs and production builds.
 */

import { User } from "../models/User.js";
import { Task } from "../models/Task.js";
import { SubTask } from "../models/SubTask.js";
import { TaskSchedule } from "../models/TaskSchedule.js";
import { SentReminder } from "../models/SentReminder.js";
import { InAppNotification } from "../models/InAppNotification.js";
import { logger } from "../utils/logger.js";
import { startOfDay, addDays } from "../utils/dateUtils.js";
import {
  generateOjoNotification,
  determineOjoTypeForNotification,
  getOjoTypeOptions,
} from "./ojoNotificationService.js";

// Expo Push Notification API endpoint
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Get emoji for Ojo type (for push notification titles)
 * Only use for concrete resolved types (mentorjo, brojo, bestojo, strictojo)
 * @param {string} ojoTypeName - Ojo type name (must be concrete)
 * @returns {string} Emoji
 */
function getOjoTypeEmoji(ojoTypeName) {
  const emojis = {
    mentorjo: "🧙",
    brojo: "💪",
    bestojo: "💖",
    strictojo: "⚡",
  };
  return emojis[ojoTypeName] || "✨";
}

/**
 * Get display name for Ojo type (for push notification titles)
 * Only use for concrete resolved types (mentorjo, brojo, bestojo, strictojo)
 * @param {string} ojoTypeName - Ojo type name (must be concrete)
 * @returns {string} Display name
 */
function getOjoTypeDisplayName(ojoTypeName) {
  const names = {
    mentorjo: "Mentorjo",
    brojo: "Brojo",
    bestojo: "Bestojo",
    strictojo: "StrictOjo",
  };
  return names[ojoTypeName] || ojoTypeName;
}

/**
 * Get the Android notification channel ID for an Ojo type.
 * Each Ojo type gets its own channel with a distinct accent color.
 */
function getOjoChannelId(ojoTypeName) {
  const channels = {
    mentorjo: "ojo-mentorjo",
    brojo: "ojo-brojo",
    bestojo: "ojo-bestojo",
    strictojo: "ojo-strictojo",
  };
  return channels[ojoTypeName] || "task-reminders";
}

/**
 * Get the publicly accessible URL for an Ojo type's logo image.
 * The backend serves frontend/assets/ at /notification-icons.
 * The device must be able to reach this URL — uses DEFAULT_MACHINE_IP when set.
 * @param {string} ojoTypeName - concrete Ojo type
 * @returns {string|null} Absolute URL or null if BASE_URL is not configured
 */
function getOjoTypeIconUrl(ojoTypeName) {
  const machineIp = process.env.DEFAULT_MACHINE_IP;
  const port = process.env.PORT || 3000;
  // Prefer an explicit override; fall back to local machine IP if available
  const base = process.env.NOTIFICATION_ICON_BASE_URL || (machineIp ? `http://${machineIp}:${port}` : null);

  if (!base) return null;

  const files = {
    mentorjo: "mentorojo-icon.png",
    brojo: "brojo-icon.png",
    bestojo: "bestojo-icon.png",
    strictojo: "strictojo-icon.png",
  };
  const file = files[ojoTypeName];
  return file ? `${base}/notification-icons/${file}` : null;
}

/**
 * Build the dedup key for a sent reminder.
 * Includes the target time (rounded to minute) so rescheduling a task creates a fresh key.
 * Key format: "<taskId>-<targetMinuteEpoch>-<windowMinutes>" (or with "-sub<index>" for subtasks)
 */
function getSentReminderKey(taskId, minutesBefore, subtaskIndex = null, targetTimeMs = 0) {
  // Round target time to the nearest minute to keep key stable across cron ticks
  const targetMinute = Math.round(targetTimeMs / 60000);
  return subtaskIndex != null
    ? `${taskId}-sub${subtaskIndex}-${targetMinute}-${minutesBefore}`
    : `${taskId}-${targetMinute}-${minutesBefore}`;
}

/**
 * Check if a reminder has already been sent (persisted in MongoDB).
 */
async function hasReminderBeenSent(dedupeKey) {
  const existing = await SentReminder.findOne({ key: dedupeKey }).lean();
  return !!existing;
}

/**
 * Record a sent reminder in MongoDB (auto-expires via TTL index after 6 hours).
 */
async function recordSentReminder({
  dedupeKey,
  taskId,
  userId,
  taskName,
  subtaskIndex,
  subtaskTitle,
  windowMinutes,
  source,
  targetTime,
}) {
  try {
    await SentReminder.updateOne(
      { key: dedupeKey },
      {
        $setOnInsert: {
          key: dedupeKey,
          taskId,
          userId,
          taskName: taskName ?? null,
          subtaskIndex: subtaskIndex ?? null,
          subtaskTitle: subtaskTitle ?? null,
          windowMinutes,
          targetTime: targetTime ? new Date(targetTime) : null,
          source,
          sentAt: new Date(),
        },
      },
      { upsert: true },
    );
  } catch (error) {
    logger.warn(`Failed to record sent reminder ${dedupeKey}:`, error.message);
  }
}

/**
 * Store an in-app copy of a notification so the user can view it inside the app.
 * Fire-and-forget – failures are logged but never block push delivery.
 */
async function storeInAppNotification({ userId, title, body, type, data, ojoType }) {
  try {
    await InAppNotification.create({
      userId,
      type: type || data?.type || "general",
      title: title || "",
      body: body || "",
      data: data || {},
      ojoType: ojoType || data?.ojoType || null,
    });
  } catch (error) {
    logger.warn("Failed to store in-app notification:", error.message);
  }
}

/**
 * Validate Expo Push Token format
 * @param {string} token - The token to validate
 * @returns {boolean} Whether the token is valid
 */
export function isValidExpoPushToken(token) {
  if (!token || typeof token !== "string") return false;
  // Expo tokens start with ExponentPushToken[ or ExpoPushToken[
  return token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[");
}

/**
 * Send push notifications using Expo Push API
 * Supports batching for multiple recipients
 *
 * @param {Array<Object>} messages - Array of message objects
 * @returns {Promise<Object>} Response from Expo Push API
 */
export async function sendPushNotifications(messages) {
  if (!messages || messages.length === 0) {
    return { success: true, data: [] };
  }

  // Filter out invalid tokens
  const validMessages = messages.filter((msg) => isValidExpoPushToken(msg.to));

  if (validMessages.length === 0) {
    logger.warn("No valid push tokens in batch");
    return { success: true, data: [] };
  }

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(validMessages),
    });

    const result = await response.json();

    if (!response.ok) {
      logger.error("Expo Push API error:", result);
      return { success: false, error: result };
    }

    // Log any failed notifications
    if (result.data) {
      result.data.forEach((ticket, index) => {
        if (ticket.status === "error") {
          logger.warn(`Push notification failed for token ${validMessages[index]?.to}: ${ticket.message}`);

          // Handle device not registered error - should remove invalid token
          if (ticket.details?.error === "DeviceNotRegistered") {
            handleInvalidToken(validMessages[index]?.to);
          }
        }
      });
    }

    logger.info(`Sent ${validMessages.length} push notifications`);
    return { success: true, data: result.data };
  } catch (error) {
    logger.error("Failed to send push notifications:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle invalid/expired push tokens by removing them from the user
 * @param {string} token - The invalid token
 */
async function handleInvalidToken(token) {
  try {
    await User.updateOne(
      { "pushNotifications.expoPushToken": token },
      {
        $set: {
          "pushNotifications.expoPushToken": null,
          "pushNotifications.enabled": false,
        },
      },
    );
    logger.info(`Removed invalid push token: ${token.substring(0, 30)}...`);
  } catch (error) {
    logger.error("Failed to remove invalid token:", error);
  }
}

/**
 * Send a single push notification to a user
 *
 * @param {string} userId - User ID
 * @param {Object} notification - Notification content
 * @returns {Promise<Object>} Result of the send operation
 */
export async function sendNotificationToUser(userId, notification) {
  try {
    const user = await User.findById(userId).lean();

    if (!user) {
      return { success: false, error: "User not found" };
    }

    const token = user.pushNotifications?.expoPushToken;

    const message =
      token && isValidExpoPushToken(token)
        ? {
            to: token,
            sound: notification.sound || "default",
            title: notification.title,
            body: notification.body,
            data: notification.data || {},
            badge: notification.badge,
            priority: notification.priority || "high",
            channelId: notification.channelId || "general",
            ...(notification.imageUrl ? { imageUrl: notification.imageUrl } : {}),
          }
        : null;

    // Always store an in-app copy so web users and users without push tokens
    // still receive notifications in the inbox.
    try {
      await storeInAppNotification({
        userId,
        title: notification.title,
        body: notification.body,
        type: notification.data?.type,
        data: notification.data,
        ojoType: notification.data?.ojoType,
      });
    } catch (e) {
      logger.warn("Failed to store in-app notification (non-blocking):", e.message);
    }

    // If we don't have a valid push token or user has disabled push, return success
    // indicating the in-app notification was stored.
    if (!message) {
      return { success: true, message: "Stored in-app notification (push not sent)" };
    }

    // If push available, attempt to send
    const pushResult = await sendPushNotifications([message]);
    if (pushResult.success) return pushResult;

    // Push failed but in-app was stored
    return { success: true, message: "In-app stored; push send failed", error: pushResult.error };
  } catch (error) {
    logger.error(`Failed to send notification to user ${userId}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Get tasks scheduled for today for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of tasks for today
 */
async function getTodaysTasks(userId) {
  // Get user to access their timezone
  const user = await User.findById(userId).select("pushNotifications.timezone").lean();
  const userTimezone = user?.pushNotifications?.timezone || "UTC";

  // Get today's date in user's local timezone
  const now = new Date();
  const userLocalNow = new Date(now.toLocaleString("en-US", { timeZone: userTimezone }));

  // Get start and end of today in user's timezone as UTC times
  const todayLocalStart = new Date(userLocalNow);
  todayLocalStart.setHours(0, 0, 0, 0);

  const todayLocalEnd = new Date(userLocalNow);
  todayLocalEnd.setHours(23, 59, 59, 999);

  // Convert these local times to ISO strings to compare with MongoDB UTC dates
  // We need to query for tasks where dueDate falls within today's range in the user's timezone
  const todayStart = new Date(todayLocalStart);
  const todayEnd = new Date(todayLocalEnd);

  // Get all non-done tasks for the user, then filter in-memory by timezone-aware date
  const allTasks = await Task.find({
    userId,
    status: { $ne: "done" },
  }).lean();

  // Filter tasks that are due today or created today in user's local timezone
  const todaysTasks = allTasks.filter((task) => {
    if (!task.dueDate) return false;

    // Convert task's dueDate to user's local timezone
    const taskDueDate = new Date(task.dueDate);
    const taskLocalDate = new Date(taskDueDate.toLocaleString("en-US", { timeZone: userTimezone }));
    taskLocalDate.setHours(0, 0, 0, 0);

    const todayLocalDate = new Date(userLocalNow);
    todayLocalDate.setHours(0, 0, 0, 0);

    return taskLocalDate.getTime() === todayLocalDate.getTime();
  });

  // Also get tasks with scheduled sessions today
  const scheduledSessions = await TaskSchedule.find({
    userId,
    start: { $gte: todayStart, $lte: todayEnd },
    status: { $ne: "completed" },
  }).lean();

  const scheduledTaskIds = [...new Set(scheduledSessions.map((s) => s.taskId.toString()))];

  // Add scheduled tasks that aren't already in the list
  const existingTaskIds = new Set(todaysTasks.map((t) => t._id.toString()));
  const additionalTaskIds = scheduledTaskIds.filter((id) => !existingTaskIds.has(id));

  if (additionalTaskIds.length > 0) {
    const additionalTasks = await Task.find({
      _id: { $in: additionalTaskIds },
      status: { $ne: "done" },
    }).lean();
    todaysTasks.push(...additionalTasks);
  }

  return todaysTasks;
}

/**
 * Build morning digest notification content
 * @param {Object} user - User document
 * @param {Array} tasks - Today's tasks
 * @returns {Object} Notification content
 */
function buildMorningDigestNotification(user, tasks) {
  const displayName = user.profile?.name || user.username;
  const taskCount = tasks.length;

  if (taskCount === 0) {
    return {
      title: "🌅 Good Morning!",
      body: `Have a great day, ${displayName}! No tasks scheduled for today.`,
      data: { type: "morning_digest", taskCount: 0 },
    };
  }

  // Build task summary
  const highPriorityTasks = tasks.filter((t) => t.importance >= 4);
  const totalEstimatedMinutes = tasks.reduce((sum, t) => sum + (t.estimatedDuration || 30), 0);
  const hours = Math.floor(totalEstimatedMinutes / 60);
  const minutes = totalEstimatedMinutes % 60;
  const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  let body = `You have ${taskCount} task${taskCount > 1 ? "s" : ""} today (~${timeStr} total).`;

  if (highPriorityTasks.length > 0) {
    body += ` ${highPriorityTasks.length} high priority!`;
  }

  // Add first task name as a teaser
  if (tasks[0]?.taskname) {
    body += `\n📌 ${tasks[0].taskname}`;
    if (taskCount > 1) {
      body += ` and ${taskCount - 1} more...`;
    }
  }

  return {
    title: `🌅 Good Morning, ${displayName}!`,
    body,
    data: {
      type: "morning_digest",
      taskCount,
      highPriorityCount: highPriorityTasks.length,
      taskIds: tasks.map((t) => t._id.toString()),
    },
  };
}

/**
 * Send morning digest notification to all eligible users
 * Runs daily - called by the scheduler
 *
 * @returns {Promise<Object>} Results summary
 */
export async function sendMorningDigestNotifications() {
  const now = new Date();
  const currentUTCHour = now.getUTCHours();
  const currentUTCMinute = now.getUTCMinutes();

  logger.info(`Running morning digest check at ${currentUTCHour}:${String(currentUTCMinute).padStart(2, "0")} UTC`);

  // Find users who should receive morning digest (include web users without push tokens)
  const users = await User.find({
    "pushNotifications.enabled": true,
    "pushNotifications.morningDigest.enabled": true,
    // Check if we haven't sent a digest today
    $or: [
      { "pushNotifications.lastMorningDigest": null },
      { "pushNotifications.lastMorningDigest": { $lt: startOfDay(now) } },
    ],
  }).lean();

  logger.info(`Found ${users.length} users eligible for morning digest`);

  const results = {
    total: users.length,
    sent: 0,
    failed: 0,
    skipped: 0,
  };

  const messages = [];
  const userUpdates = [];
  const inAppItems = []; // parallel array for in-app storage

  for (const user of users) {
    try {
      // Get user's preferred time
      const userHour = user.pushNotifications?.morningDigest?.hour || 8;
      const userMinute = user.pushNotifications?.morningDigest?.minute || 0;
      const userTimezone = user.pushNotifications?.timezone || "UTC";

      // Get current time in user's timezone
      const userLocalTime = new Date(now.toLocaleString("en-US", { timeZone: userTimezone }));
      const currentUserHour = userLocalTime.getHours();
      const currentUserMinute = userLocalTime.getMinutes();

      logger.info(
        `User ${user._id}: Local time ${currentUserHour}:${String(currentUserMinute).padStart(2, "0")} ${userTimezone}, Preferred ${userHour}:${String(userMinute).padStart(2, "0")}`,
      );

      // Check if current local time matches user's preferred time
      if (currentUserHour !== userHour || currentUserMinute !== userMinute) {
        results.skipped++;
        continue;
      }

      // Get today's tasks for this user
      const tasks = await getTodaysTasks(user._id);
      let notification = buildMorningDigestNotification(user, tasks);

      // Apply Ojo personality if the user has it enabled
      const ojoDecision = await determineOjoTypeForNotification(user, null);
      if (ojoDecision.useOjo && ojoDecision.ojoType && tasks.length > 0) {
        try {
          const userName = user.profile?.name || user.username;
          const syntheticTask = {
            taskname: `${tasks.length} task${tasks.length > 1 ? "s" : ""} today`,
            description: tasks
              .map((t) => t.taskname)
              .slice(0, 3)
              .join(", "),
            importance: Math.max(...tasks.map((t) => t.importance || 3)),
            dueDate: tasks[0]?.dueDate,
          };
          const ojoNotification = await generateOjoNotification(ojoDecision.ojoType, syntheticTask, {
            timing: { urgency: "normal" },
            source: "morning_digest",
            userName,
          });

          // Enhance title with Ojo type name and emoji for push notifications
          const ojoEmoji = getOjoTypeEmoji(ojoDecision.ojoType);
          const ojoName = getOjoTypeDisplayName(ojoDecision.ojoType);
          const enhancedTitle = `${ojoEmoji} ${ojoNotification.title} (${ojoName})`;

          notification = {
            title: enhancedTitle,
            body: ojoNotification.body,
            channelId: getOjoChannelId(ojoDecision.ojoType),
            imageUrl: getOjoTypeIconUrl(ojoDecision.ojoType),
            data: {
              ...notification.data,
              ojoType: ojoDecision.ojoType,
              ojoGenerated: ojoNotification.generated,
            },
          };
        } catch (ojoError) {
          logger.warn(`Ojo morning digest failed for user ${user._id}, using standard:`, ojoError.message);
        }
      }

      // Always queue an in-app copy (works for web + native)
      inAppItems.push({
        userId: user._id,
        title: notification.title,
        body: notification.body,
        type: "morning_digest",
        data: notification.data,
        ojoType: notification.data?.ojoType,
      });
      userUpdates.push(user._id);

      // Only add to push batch if user has a valid Expo token (native)
      const token = user.pushNotifications?.expoPushToken;
      if (isValidExpoPushToken(token)) {
        messages.push({
          to: token,
          sound: "default",
          title: notification.title,
          body: notification.body,
          data: notification.data,
          priority: "high",
          channelId: notification.channelId || "morning-digest",
          ...(notification.imageUrl ? { imageUrl: notification.imageUrl } : {}),
        });
      }
    } catch (error) {
      logger.error(`Failed to prepare digest for user ${user._id}:`, error);
      results.failed++;
    }
  }

  // Always store in-app copies for ALL eligible users (web + native)
  for (const item of inAppItems) {
    storeInAppNotification(item);
  }
  results.sent = inAppItems.length;

  // Send push notifications to users with valid tokens (native)
  if (messages.length > 0) {
    const sendResult = await sendPushNotifications(messages);
    if (!sendResult.success) {
      logger.warn("Push batch for morning digest failed (in-app copies were still stored)");
    }
  }

  // Update lastMorningDigest for ALL processed users
  if (userUpdates.length > 0) {
    await User.updateMany({ _id: { $in: userUpdates } }, { $set: { "pushNotifications.lastMorningDigest": now } });
  }

  logger.info(`Morning digest results: ${JSON.stringify(results)}`);
  return results;
}

/**
 * Test morning digest notifications (ignores lastMorningDigest check)
 * Used for testing purposes to allow multiple sends in one day
 *
 * @returns {Promise<Object>} Results object with sent, failed, skipped counts
 */
export async function testMorningDigestNotifications() {
  const now = new Date();
  const currentUTCHour = now.getUTCHours();
  const currentUTCMinute = now.getUTCMinutes();

  logger.info(`🧪 Running MORNING DIGEST TEST at ${currentUTCHour}:${String(currentUTCMinute).padStart(2, "0")} UTC`);

  // Find all users with morning digest enabled (no lastMorningDigest check, include web users)
  const users = await User.find({
    "pushNotifications.enabled": true,
    "pushNotifications.morningDigest.enabled": true,
  }).lean();

  logger.info(`Found ${users.length} users for morning digest test`);

  const results = {
    total: users.length,
    sent: 0,
    failed: 0,
    skipped: 0,
  };

  const messages = [];
  const inAppItems = [];

  for (const user of users) {
    try {
      // Get user's preferred time
      const userHour = user.pushNotifications?.morningDigest?.hour || 8;
      const userMinute = user.pushNotifications?.morningDigest?.minute || 0;
      const userTimezone = user.pushNotifications?.timezone || "UTC";

      // Get current time in user's timezone
      const userLocalTime = new Date(now.toLocaleString("en-US", { timeZone: userTimezone }));
      const currentUserHour = userLocalTime.getHours();
      const currentUserMinute = userLocalTime.getMinutes();

      logger.info(
        `🧪 User ${user._id}: Local time ${currentUserHour}:${String(currentUserMinute).padStart(2, "0")} ${userTimezone}, Preferred ${userHour}:${String(userMinute).padStart(2, "0")}`,
      );

      // For testing, skip the time check - send to all users with digest enabled

      // Get today's tasks for this user
      const tasks = await getTodaysTasks(user._id);
      let notification = buildMorningDigestNotification(user, tasks);

      // Apply Ojo personality if the user has it enabled
      const ojoDecision = await determineOjoTypeForNotification(user, null);
      if (ojoDecision.useOjo && ojoDecision.ojoType && tasks.length > 0) {
        try {
          const userName = user.profile?.name || user.username;
          const syntheticTask = {
            taskname: `${tasks.length} task${tasks.length > 1 ? "s" : ""} today`,
            description: tasks
              .map((t) => t.taskname)
              .slice(0, 3)
              .join(", "),
            importance: Math.max(...tasks.map((t) => t.importance || 3)),
            dueDate: tasks[0]?.dueDate,
          };
          const ojoNotification = await generateOjoNotification(ojoDecision.ojoType, syntheticTask, {
            timing: { urgency: "normal" },
            source: "morning_digest",
            userName,
          });

          // Enhance title with Ojo type name and emoji for push notifications
          const ojoEmoji = getOjoTypeEmoji(ojoDecision.ojoType);
          const ojoName = getOjoTypeDisplayName(ojoDecision.ojoType);
          const enhancedTitle = `${ojoEmoji} ${ojoNotification.title} (${ojoName})`;

          notification = {
            title: enhancedTitle,
            body: ojoNotification.body,
            channelId: getOjoChannelId(ojoDecision.ojoType),
            imageUrl: getOjoTypeIconUrl(ojoDecision.ojoType),
            data: {
              ...notification.data,
              ojoType: ojoDecision.ojoType,
              ojoGenerated: ojoNotification.generated,
            },
          };
        } catch (ojoError) {
          logger.warn(`🧪 Ojo morning digest failed for user ${user._id}, using standard:`, ojoError.message);
        }
      }

      // Always queue in-app copy (web + native)
      inAppItems.push({
        userId: user._id,
        title: notification.title,
        body: notification.body,
        type: "morning_digest",
        data: notification.data,
        ojoType: notification.data?.ojoType,
      });

      // Only push if user has a valid Expo token
      const token = user.pushNotifications?.expoPushToken;
      if (isValidExpoPushToken(token)) {
        messages.push({
          to: token,
          sound: "default",
          title: notification.title,
          body: notification.body,
          data: notification.data,
          priority: "high",
          channelId: notification.channelId || "morning-digest",
          ...(notification.imageUrl ? { imageUrl: notification.imageUrl } : {}),
        });
      }
    } catch (error) {
      logger.error(`🧪 Failed to prepare test digest for user ${user._id}:`, error);
      results.failed++;
    }
  }

  // Always store in-app copies for ALL eligible users (web + native)
  for (const item of inAppItems) {
    storeInAppNotification(item);
  }
  results.sent = inAppItems.length;

  // Send push notifications to users with valid Expo tokens (native)
  if (messages.length > 0) {
    const sendResult = await sendPushNotifications(messages);
    if (!sendResult.success) {
      logger.warn("🧪 Push batch for morning digest test failed (in-app copies were still stored)");
    }
  }

  logger.info(`🧪 Morning digest TEST results: ${JSON.stringify(results)}`);
  return results;
}

/**
 * Calculate optimal reminder time based on ML prediction
 * Uses the pre-calculated predictedCompletionCategory from the task if available,
 * otherwise falls back to making a new ML prediction.
 *
 * @param {Object} task - Task document
 * @param {Object} user - User document
 * @returns {Promise<Object>} Reminder timing info
 */
async function calculateSmartReminderTiming(task, user) {
  const defaultMinutes = user.pushNotifications?.taskReminders?.defaultReminderMinutes || 60;

  try {
    // Only use pre-calculated prediction stored on the task — never call the ML model at runtime
    const category = task.predictedCompletionCategory || null;
    const score = task.predictionScore || 0.5;

    if (!category) {
      logger.info(`No pre-calculated prediction for task ${task._id}, using defaults`);
      return {
        minutesBefore: defaultMinutes,
        urgency: "normal",
        remindCount: 1,
        reminderWindows: [defaultMinutes],
      };
    }

    logger.info(`Using pre-calculated prediction for task ${task._id}: category=${category}, score=${score}`);

    // prediction category: 1=very quick completion, 5=unlikely to complete
    // Higher category = more reminders and earlier start

    let minutesBefore = defaultMinutes;
    let remindCount = 1;
    let urgency = "normal";

    switch (category) {
      case 1: // Very quick - single reminder close to deadline
        minutesBefore = Math.min(30, defaultMinutes);
        remindCount = 1;
        urgency = "low";
        break;
      case 2: // Quick - standard reminder
        minutesBefore = defaultMinutes;
        remindCount = 1;
        urgency = "normal";
        break;
      case 3: // Moderate - remind earlier with follow-up
        minutesBefore = Math.max(defaultMinutes, 120);
        remindCount = 2;
        urgency = "normal";
        break;
      case 4: // Slow - multiple reminders, start early
        minutesBefore = Math.max(defaultMinutes * 2, 180);
        remindCount = 3;
        urgency = "high";
        break;
      case 5: // Very slow/unlikely - aggressive reminders
        minutesBefore = Math.max(defaultMinutes * 3, 240);
        remindCount = 4;
        urgency = "critical";
        break;
    }

    // Adjust based on task importance
    if (task.importance >= 4) {
      remindCount = Math.min(remindCount + 1, 5);
      urgency = urgency === "low" ? "normal" : urgency;
    }

    // Build evenly-spaced reminder windows, each rounded to the nearest 30-min multiple.
    // e.g. remindCount=3, minutesBefore=180 => [180, 90, 30]
    // e.g. remindCount=4, minutesBefore=240 => [240, 150, 90, 30]
    const reminderWindows = [];
    if (remindCount === 1) {
      reminderWindows.push(minutesBefore);
    } else {
      const finalReminder = Math.min(30, defaultMinutes);
      const step = (minutesBefore - finalReminder) / (remindCount - 1);
      for (let i = 0; i < remindCount; i++) {
        const raw = minutesBefore - step * i;
        const rounded = Math.round(raw / 30) * 30 || 30; // snap to nearest 30, minimum 30
        if (!reminderWindows.includes(rounded)) {
          reminderWindows.push(rounded);
        }
      }
    }

    return {
      minutesBefore,
      remindCount,
      urgency,
      reminderWindows,
      predictionScore: score,
      predictionCategory: category,
    };
  } catch (error) {
    logger.warn(`Smart reminder calculation failed for task ${task._id}:`, error.message);
    return {
      minutesBefore: defaultMinutes,
      remindCount: 1,
      urgency: "normal",
      reminderWindows: [defaultMinutes],
    };
  }
}

/**
 * Build task reminder notification content
 * @param {Object} task - Task document
 * @param {Object} timing - Reminder timing info
 * @param {string} source - Source of the reminder date ('schedule' or 'dueDate')
 * @returns {Object} Notification content
 */
function buildTaskReminderNotification(task, timing, source = "dueDate") {
  const { urgency, minutesBefore } = timing;

  let emoji = "📝";
  let prefix = "";

  switch (urgency) {
    case "critical":
      emoji = "🚨";
      prefix = "URGENT: ";
      break;
    case "high":
      emoji = "⚠️";
      prefix = "Important: ";
      break;
    case "normal":
      emoji = "⏰";
      break;
    case "low":
      emoji = "📝";
      break;
  }

  const timeStr =
    minutesBefore >= 60 ? `${Math.floor(minutesBefore / 60)}h ${minutesBefore % 60}m` : `${minutesBefore}m`;

  const actionStr = source === "schedule" ? "scheduled" : "due";
  const timeContext = ` ${actionStr} in ${timeStr}`;

  return {
    title: `${emoji} ${prefix}Task Reminder`,
    body: `${task.taskname}${timeContext}`,
    data: {
      type: "task_reminder",
      taskId: task._id.toString(),
      urgency,
      source,
      ...timing,
    },
  };
}

/**
 * Build subtask reminder notification content
 * @param {Object} task - Parent task document
 * @param {number} subtaskIndex - Subtask index within the task
 * @param {string} subtaskTitle - Subtask title
 * @param {Object} timing - Reminder timing info
 * @param {string} source - Source of the reminder date ('schedule' or 'dueDate')
 * @returns {Object} Notification content
 */
function buildSubtaskReminderNotification(task, subtaskIndex, subtaskTitle, timing, source = "dueDate") {
  const { urgency, minutesBefore } = timing;

  let emoji = "📋";
  let prefix = "";

  switch (urgency) {
    case "critical":
      emoji = "🚨";
      prefix = "URGENT: ";
      break;
    case "high":
      emoji = "⚠️";
      prefix = "Important: ";
      break;
    case "normal":
      emoji = "⏰";
      break;
    case "low":
      emoji = "📋";
      break;
  }

  const timeStr =
    minutesBefore >= 60 ? `${Math.floor(minutesBefore / 60)}h ${minutesBefore % 60}m` : `${minutesBefore}m`;

  const actionStr = source === "schedule" ? "scheduled" : "due";
  const displayTitle = subtaskTitle || `Part ${subtaskIndex}`;

  return {
    title: `${emoji} ${prefix}Subtask Reminder`,
    body: `${task.taskname} - ${displayTitle} ${actionStr} in ${timeStr}`,
    data: {
      type: "subtask_reminder",
      taskId: task._id.toString(),
      subtaskIndex,
      subtaskTitle: displayTitle,
      urgency,
      source,
      ...timing,
    },
  };
}

/**
 * Build notification with Ojo personality if enabled
 * Falls back to standard notification if Ojo is disabled or generation fails
 *
 * @param {Object} user - User document
 * @param {Object} task - Task document
 * @param {Object} options - Options for building notification
 * @param {Object} options.subtask - Subtask info (optional)
 * @param {Object} options.timing - Timing information
 * @param {string} options.source - 'schedule' or 'dueDate'
 * @param {boolean} options.isSubtask - Whether this is a subtask
 * @returns {Promise<Object>} Notification content
 */
async function buildNotificationWithOjo(user, task, options = {}) {
  const { subtask, timing, source, isSubtask } = options;

  // Determine if we should use Ojo and which type
  const ojoDecision = await determineOjoTypeForNotification(user, timing);

  if (!ojoDecision.useOjo) {
    // Ojo disabled - use standard notification
    return isSubtask
      ? buildSubtaskReminderNotification(task, subtask?.index, subtask?.title, timing, source)
      : buildTaskReminderNotification(task, timing, source);
  }

  // Generate Ojo-styled notification
  try {
    const userName = user.profile?.name || user.username;

    const ojoNotification = await generateOjoNotification(ojoDecision.ojoType, task, {
      subtask: isSubtask ? subtask : null,
      timing,
      source,
      userName,
    });

    // Enhance title with Ojo type name and emoji for push notifications
    const ojoEmoji = getOjoTypeEmoji(ojoDecision.ojoType);
    const ojoName = getOjoTypeDisplayName(ojoDecision.ojoType);
    const enhancedTitle = `${ojoEmoji} ${ojoNotification.title} (${ojoName})`;

    return {
      title: enhancedTitle,
      body: ojoNotification.body,
      channelId: getOjoChannelId(ojoDecision.ojoType),
      imageUrl: getOjoTypeIconUrl(ojoDecision.ojoType),
      data: {
        type: isSubtask ? "subtask_reminder" : "task_reminder",
        taskId: task._id.toString(),
        subtaskIndex: isSubtask ? subtask?.index : undefined,
        subtaskTitle: isSubtask ? subtask?.title || `Part ${subtask?.index}` : undefined,
        urgency: timing?.urgency,
        source,
        ojoType: ojoDecision.ojoType,
        ojoSource: ojoDecision.source,
        ojoGenerated: ojoNotification.generated,
        ...timing,
      },
    };
  } catch (error) {
    logger.warn(`Ojo notification generation failed, using fallback:`, error.message);
    // Fall back to standard notification
    return isSubtask
      ? buildSubtaskReminderNotification(task, subtask?.index, subtask?.title, timing, source)
      : buildTaskReminderNotification(task, timing, source);
  }
}

/**
 * Check and send task reminders for all users
 * Runs periodically - called by the scheduler
 * Supports both tasks and subtasks, prioritizes schedule date over due date
 *
 * @returns {Promise<Object>} Results summary
 */
export async function sendTaskReminderNotifications() {
  const now = new Date();

  logger.info("Running task reminder check (tasks + subtasks)");

  const fourHoursFromNow = new Date(now.getTime() + 4 * 60 * 60 * 1000);

  // Get all scheduled sessions in the next 4 hours (these take priority)
  const upcomingSessions = await TaskSchedule.find({
    start: {
      $gte: now,
      $lte: fourHoursFromNow,
    },
    status: { $ne: "completed" },
  })
    .populate("taskId")
    .lean();

  // Build reminder items from scheduled sessions
  // Each item has: task, subtaskIndex (optional), reminderDate (schedule start or due date)
  const reminderItems = [];
  const processedTaskIds = new Set();
  const processedSubtaskKeys = new Set(); // "taskId-subtaskIndex"

  // Process scheduled sessions first (they have explicit schedule dates)
  for (const session of upcomingSessions) {
    if (!session.taskId || session.taskId.status === "done") continue;

    const task = session.taskId;
    const reminderDate = session.start; // Use schedule date

    if (session.subtaskIndex) {
      // This is a subtask session
      const key = `${task._id}-${session.subtaskIndex}`;
      if (!processedSubtaskKeys.has(key)) {
        processedSubtaskKeys.add(key);
        reminderItems.push({
          task,
          subtaskIndex: session.subtaskIndex,
          subtaskTitle: session.subtaskTitle,
          reminderDate,
          isSubtask: true,
          source: "schedule",
        });
      }
    } else {
      // This is a task-level session
      const taskIdStr = task._id.toString();
      if (!processedTaskIds.has(taskIdStr)) {
        processedTaskIds.add(taskIdStr);
        reminderItems.push({
          task,
          reminderDate,
          isSubtask: false,
          source: "schedule",
        });
      }
    }
  }

  // Find tasks with due dates in the next 4 hours that don't have schedule sessions
  const upcomingTasks = await Task.find({
    status: { $ne: "done" },
    dueDate: {
      $gte: now,
      $lte: fourHoursFromNow,
    },
  }).lean();

  for (const task of upcomingTasks) {
    const taskIdStr = task._id.toString();
    if (!processedTaskIds.has(taskIdStr)) {
      processedTaskIds.add(taskIdStr);
      reminderItems.push({
        task,
        reminderDate: task.dueDate, // Fall back to due date
        isSubtask: false,
        source: "dueDate",
      });
    }
  }

  // Also find incomplete subtasks whose parent tasks have due dates coming up
  // but no specific schedule (they inherit from parent task dueDate)
  const subtasksWithUpcomingTasks = await SubTask.find({
    status: { $ne: "done" },
    taskId: { $in: upcomingTasks.map((t) => t._id) },
  }).lean();

  for (const subtask of subtasksWithUpcomingTasks) {
    const key = `${subtask.taskId}-${subtask.index}`;
    if (!processedSubtaskKeys.has(key)) {
      const parentTask = upcomingTasks.find((t) => t._id.toString() === subtask.taskId.toString());
      if (parentTask) {
        processedSubtaskKeys.add(key);
        reminderItems.push({
          task: parentTask,
          subtaskIndex: subtask.index,
          subtaskTitle: subtask.title,
          reminderDate: parentTask.dueDate, // Inherit from parent
          isSubtask: true,
          source: "dueDate",
        });
      }
    }
  }

  logger.info(`Found ${reminderItems.length} reminder items (tasks + subtasks) for reminder check`);

  const results = {
    total: reminderItems.length,
    sent: 0,
    failed: 0,
    skipped: 0,
  };

  for (const item of reminderItems) {
    const { task, subtaskIndex, subtaskTitle, reminderDate, isSubtask, source } = item;

    try {
      const user = await User.findById(task.userId).lean();

      if (!user) {
        results.skipped++;
        continue;
      }

      // Check if reminders are enabled
      if (!user.pushNotifications?.enabled || !user.pushNotifications?.taskReminders?.enabled) {
        results.skipped++;
        continue;
      }

      // NOTE: We intentionally do NOT skip users without a push token here.
      // sendNotificationToUser() stores an in-app copy for web/tokenless users
      // and only attempts push delivery when a valid Expo token exists.

      // Calculate smart reminder timing (uses task's pre-calculated prediction)
      const useSmartReminders = user.pushNotifications?.taskReminders?.useSmartReminders !== false;
      const timing = useSmartReminders
        ? await calculateSmartReminderTiming(task, user)
        : {
            minutesBefore: user.pushNotifications?.taskReminders?.defaultReminderMinutes || 60,
            remindCount: 1,
            urgency: "normal",
            reminderWindows: [user.pushNotifications?.taskReminders?.defaultReminderMinutes || 60],
          };

      // Check each reminder window (e.g. [180, 90, 30] for a category-4 task)
      const windows = timing.reminderWindows || [timing.minutesBefore];
      const targetTime = new Date(reminderDate).getTime();
      let sentForThisItem = false;

      for (const windowMinutes of windows) {
        const reminderTime = targetTime - windowMinutes * 60 * 1000;

        // Allow 2 minute window (tight because cron runs every minute)
        if (now.getTime() < reminderTime - 2 * 60 * 1000 || now.getTime() > reminderTime + 2 * 60 * 1000) {
          continue;
        }

        // Deduplicate: skip if we already sent this exact reminder level
        const dedupeKey = getSentReminderKey(
          task._id.toString(),
          windowMinutes,
          isSubtask ? subtaskIndex : null,
          targetTime,
        );
        if (await hasReminderBeenSent(dedupeKey)) {
          continue;
        }

        // Build notification with Ojo if enabled, otherwise use standard format
        const subtaskInfo = isSubtask ? { index: subtaskIndex, title: subtaskTitle } : null;
        const windowTiming = { ...timing, minutesBefore: windowMinutes };
        const notification = await buildNotificationWithOjo(user, task, {
          subtask: subtaskInfo,
          timing: windowTiming,
          source,
          isSubtask,
        });

        const sendResult = await sendNotificationToUser(task.userId, {
          ...notification,
          channelId: "task-reminders",
        });

        if (sendResult.success) {
          results.sent++;
          sentForThisItem = true;

          // Record that this reminder was sent so it won't fire again
          await recordSentReminder({
            dedupeKey,
            taskId: task._id,
            userId: task.userId,
            taskName: task.taskname,
            subtaskIndex: isSubtask ? subtaskIndex : null,
            subtaskTitle: isSubtask ? subtaskTitle : null,
            windowMinutes,
            source,
            targetTime,
          });

          // Update last reminder timestamp
          await User.updateOne({ _id: task.userId }, { $set: { "pushNotifications.lastTaskReminder": now } });
        } else {
          results.failed++;
        }
      }

      if (!sentForThisItem) {
        results.skipped++;
      }
    } catch (error) {
      logger.error(`Failed to send reminder for ${isSubtask ? "subtask" : "task"} ${task._id}:`, error);
      results.failed++;
    }
  }

  logger.info(`Task reminder results: ${JSON.stringify(results)}`);
  return results;
}

/**
 * Test task reminder for a specific user
 * Sends a reminder notification immediately, ignoring timing checks
 *
 * @param {string} userId - User ID to test
 * @param {Object} options - Test options
 * @param {boolean} options.useSmartReminders - Whether to use ML-based smart reminders
 * @param {boolean} options.useOjo - Whether to use Ojo notifications (auto if not specified)
 * @param {string} options.ojoType - Specific Ojo type to use (for testing)
 * @returns {Promise<Object>} Test result
 */
export async function testTaskReminderNotification(userId, options = {}) {
  // useOjo defaults to false - tests should explicitly enable Ojo if needed
  const { useSmartReminders = true, useOjo = false, ojoType: forceOjoType } = options;

  logger.info(`🧪 Testing task reminder for user ${userId}, smartReminders=${useSmartReminders}, useOjo=${useOjo}`);

  try {
    const user = await User.findById(userId).lean();

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // No token check — sendNotificationToUser stores in-app for web users

    // Find user's next upcoming task (or most recent incomplete task)
    const now = new Date();
    let task = await Task.findOne({
      userId,
      status: { $ne: "done" },
      dueDate: { $gte: now },
    })
      .sort({ dueDate: 1 })
      .lean();

    // If no upcoming task, find any incomplete task
    if (!task) {
      task = await Task.findOne({
        userId,
        status: { $ne: "done" },
      })
        .sort({ createdAt: -1 })
        .lean();
    }

    // If still no task, create a mock task for testing
    if (!task) {
      task = {
        _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
        taskname: "Sample Test Task",
        description: "A test task to demonstrate notifications",
        importance: 3,
        dueDate: new Date(now.getTime() + 60 * 60 * 1000), // 1 hour from now
        userId,
      };
      logger.info("🧪 No tasks found, using mock task for testing");
    }

    // Calculate timing based on settings
    let timing;
    if (useSmartReminders) {
      timing = await calculateSmartReminderTiming(task, user);
      logger.info(`🧪 Smart reminder timing: ${JSON.stringify(timing)}`);
    } else {
      timing = {
        minutesBefore: user.pushNotifications?.taskReminders?.defaultReminderMinutes || 60,
        remindCount: 1,
        urgency: "normal",
      };
      logger.info(`🧪 Default reminder timing: ${JSON.stringify(timing)}`);
    }

    // Check for scheduled sessions for this task
    const nextSchedule = await TaskSchedule.findOne({
      taskId: task._id,
      start: { $gte: now },
      status: { $ne: "completed" },
    })
      .sort({ start: 1 })
      .lean();

    // Determine the reminder source: schedule takes priority over due date
    const source = nextSchedule ? "schedule" : "dueDate";

    // Determine Ojo settings for test
    // useOjo parameter takes precedence - if explicitly false, don't use Ojo
    const ojoDecision = await determineOjoTypeForNotification(user, timing);
    const shouldUseOjo = useOjo === true ? true : useOjo === false ? false : ojoDecision.useOjo;
    const selectedOjoType = shouldUseOjo ? forceOjoType || ojoDecision.ojoType : null;

    let notification;
    if (shouldUseOjo && selectedOjoType) {
      // Generate Ojo notification
      const userName = user.profile?.name || user.username;
      const ojoNotification = await generateOjoNotification(selectedOjoType, task, {
        timing,
        source,
        userName,
      });

      notification = {
        title: `🧪 TEST: ${ojoNotification.title}`,
        body: ojoNotification.body,
        data: {
          type: "task_reminder",
          taskId: task._id.toString(),
          urgency: timing?.urgency,
          source,
          ojoType: selectedOjoType,
          ojoGenerated: ojoNotification.generated,
          isTest: true,
          testType: useSmartReminders ? "smart_reminder" : "default_reminder",
          ...timing,
        },
      };
    } else {
      // Build standard notification
      notification = buildTaskReminderNotification(task, timing, source);
      notification.title = `🧪 TEST: ${notification.title}`;
      notification.data = {
        ...notification.data,
        isTest: true,
        testType: useSmartReminders ? "smart_reminder" : "default_reminder",
      };
    }

    // Send the notification
    const sendResult = await sendNotificationToUser(userId, {
      ...notification,
      channelId: "task-reminders",
    });

    return {
      success: sendResult.success,
      message: sendResult.success
        ? `Task reminder test sent (${useSmartReminders ? "smart" : "default"} mode, Ojo: ${shouldUseOjo ? selectedOjoType : "disabled"})`
        : "Failed to send test notification",
      task: {
        id: task._id,
        name: task.taskname,
        description: task.description,
        importance: task.importance,
        dueDate: task.dueDate,
        predictedCompletionCategory: task.predictedCompletionCategory,
        predictionScore: task.predictionScore,
      },
      scheduling: {
        source,
        hasSchedule: !!nextSchedule,
        nextScheduleStart: nextSchedule?.start,
      },
      ojoSettings: {
        useOjo: shouldUseOjo,
        ojoType: selectedOjoType,
        ojoSource: ojoDecision.source,
        availableOjoTypes: getOjoTypeOptions(),
      },
      timing,
      notification: {
        title: notification.title,
        body: notification.body,
      },
    };
  } catch (error) {
    logger.error(`🧪 Task reminder test failed for user ${userId}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Test subtask reminder for a specific user
 * Sends a subtask reminder notification immediately, ignoring timing checks
 *
 * @param {string} userId - User ID to test
 * @param {Object} options - Test options
 * @param {boolean} options.useSmartReminders - Whether to use ML-based smart reminders
 * @returns {Promise<Object>} Test result
 */
export async function testSubtaskReminderNotification(userId, options = {}) {
  const { useSmartReminders = true } = options;

  logger.info(`🧪 Testing subtask reminder for user ${userId}, smartReminders=${useSmartReminders}`);

  try {
    const user = await User.findById(userId).lean();

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // No token check — sendNotificationToUser stores in-app for web users

    // Find user's first incomplete subtask with its parent task
    const now = new Date();
    const subtask = await SubTask.findOne({
      userId,
      status: { $ne: "done" },
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!subtask) {
      return {
        success: false,
        error: "No subtasks found",
        hint: "Create a task with subtasks (taskType: 'in_parts' or 'leaky') first to test subtask reminders",
      };
    }

    // Get the parent task
    const task = await Task.findById(subtask.taskId).lean();
    if (!task) {
      return { success: false, error: "Parent task not found" };
    }

    // Calculate timing based on settings (uses parent task's prediction)
    let timing;
    if (useSmartReminders) {
      timing = await calculateSmartReminderTiming(task, user);
      logger.info(`🧪 Smart reminder timing for subtask: ${JSON.stringify(timing)}`);
    } else {
      timing = {
        minutesBefore: user.pushNotifications?.taskReminders?.defaultReminderMinutes || 60,
        remindCount: 1,
        urgency: "normal",
      };
      logger.info(`🧪 Default reminder timing for subtask: ${JSON.stringify(timing)}`);
    }

    // Check for scheduled sessions for this subtask
    const nextSchedule = await TaskSchedule.findOne({
      taskId: task._id,
      subtaskIndex: subtask.index,
      start: { $gte: now },
      status: { $ne: "completed" },
    })
      .sort({ start: 1 })
      .lean();

    // Determine the reminder source: schedule takes priority over due date
    const source = nextSchedule ? "schedule" : "dueDate";

    // Build subtask notification with source
    const notification = buildSubtaskReminderNotification(task, subtask.index, subtask.title, timing, source);

    // Add test indicator to title
    notification.title = `🧪 TEST: ${notification.title}`;
    notification.data = {
      ...notification.data,
      isTest: true,
      testType: useSmartReminders ? "smart_reminder" : "default_reminder",
    };

    // Send the notification
    const sendResult = await sendNotificationToUser(userId, {
      ...notification,
      channelId: "task-reminders",
    });

    return {
      success: sendResult.success,
      message: sendResult.success
        ? `Subtask reminder test sent (${useSmartReminders ? "smart" : "default"} mode)`
        : "Failed to send test notification",
      parentTask: {
        id: task._id,
        name: task.taskname,
        importance: task.importance,
        dueDate: task.dueDate,
        predictedCompletionCategory: task.predictedCompletionCategory,
        predictionScore: task.predictionScore,
      },
      subtask: {
        index: subtask.index,
        title: subtask.title,
        status: subtask.status,
        minutes: subtask.minutes,
      },
      scheduling: {
        source,
        hasSchedule: !!nextSchedule,
        nextScheduleStart: nextSchedule?.start,
      },
      timing,
      notification: {
        title: notification.title,
        body: notification.body,
      },
    };
  } catch (error) {
    logger.error(`🧪 Subtask reminder test failed for user ${userId}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Test Ojo-powered notification for a specific user
 * Generates and sends an AI-crafted notification in the Ojo's personality style
 *
 * @param {string} userId - User ID to test
 * @param {Object} options - Test options
 * @param {string} options.ojoType - Force specific Ojo type (optional)
 * @returns {Promise<Object>} Test result
 */
export async function testOjoReminderNotification(userId, options = {}) {
  const { ojoType: forceOjoType } = options;

  logger.info(`🧪 Testing Ojo reminder for user ${userId}, forceOjoType=${forceOjoType || "auto"}`);

  try {
    const user = await User.findById(userId).lean();

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // No token check — sendNotificationToUser stores in-app for web users

    // Find user's next upcoming task (or most recent incomplete task)
    const now = new Date();
    let task = await Task.findOne({
      userId,
      status: { $ne: "done" },
      dueDate: { $gte: now },
    })
      .sort({ dueDate: 1 })
      .lean();

    // If no upcoming task, find any incomplete task
    if (!task) {
      task = await Task.findOne({
        userId,
        status: { $ne: "done" },
      })
        .sort({ createdAt: -1 })
        .lean();
    }

    // If still no task, create a mock task for testing
    if (!task) {
      task = {
        _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
        taskname: "Sample Test Task",
        description: "A test task to demonstrate Ojo-powered notifications",
        importance: 3,
        dueDate: new Date(now.getTime() + 60 * 60 * 1000), // 1 hour from now
        userId,
        category: "work",
      };
      logger.info("🧪 No tasks found, using mock task for Ojo testing");
    }

    // Use default timing (NOT smart/prediction-based) for Ojo test
    // Ojo notification test is purely about the AI-generated content, not timing optimization
    const timing = {
      minutesBefore: user.pushNotifications?.taskReminders?.defaultReminderMinutes || 60,
      remindCount: 1,
      urgency: "normal",
    };

    // Check for scheduled sessions for this task
    const nextSchedule = await TaskSchedule.findOne({
      taskId: task._id,
      start: { $gte: now },
      status: { $ne: "completed" },
    })
      .sort({ start: 1 })
      .lean();

    // Determine the reminder source: schedule takes priority over due date
    const source = nextSchedule ? "schedule" : "dueDate";

    // Determine Ojo type
    // If a specific type is forced via the test parameter, use it directly.
    // Otherwise delegate to determineOjoTypeForNotification so "auto" and "chat" resolve correctly.
    let selectedOjoType;
    let ojoSelectionMethod;

    if (forceOjoType) {
      selectedOjoType = forceOjoType;
      ojoSelectionMethod = "forced";
    } else {
      const ojoDecision = await determineOjoTypeForNotification(user, timing);
      selectedOjoType = ojoDecision.ojoType || "mentorjo";
      ojoSelectionMethod = ojoDecision.source || "default";
    }

    // Generate Ojo notification
    const userName = user.profile?.name || user.username;
    const ojoNotification = await generateOjoNotification(selectedOjoType, task, {
      timing,
      source,
      userName,
    });

    // Build the notification
    const notification = {
      title: `🧪 OJO TEST: ${ojoNotification.title}`,
      body: ojoNotification.body,
      data: {
        type: "task_reminder",
        taskId: task._id.toString(),
        urgency: timing?.urgency,
        source,
        ojoType: selectedOjoType,
        ojoGenerated: ojoNotification.generated,
        isTest: true,
        testType: "ojo_reminder",
      },
    };

    // Send the notification
    const sendResult = await sendNotificationToUser(userId, {
      ...notification,
      channelId: "task-reminders",
    });

    return {
      success: sendResult.success,
      message: sendResult.success
        ? `Ojo reminder test sent (${selectedOjoType})`
        : "Failed to send Ojo test notification",
      task: {
        id: task._id,
        name: task.taskname,
        description: task.description,
        category: task.category,
        importance: task.importance,
        dueDate: task.dueDate,
        predictedCompletionCategory: task.predictedCompletionCategory,
      },
      ojoType: selectedOjoType,
      ojoSelectionMethod,
      predictionCategory: timing?.predictionCategory,
      notification: {
        title: notification.title,
        body: notification.body,
        ojoGenerated: ojoNotification.generated,
      },
      availableOjoTypes: getOjoTypeOptions(),
    };
  } catch (error) {
    logger.error(`🧪 Ojo reminder test failed for user ${userId}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Test smart reminder calculation without sending notification
 * Returns the ML prediction and calculated timing for a task
 *
 * @param {string} userId - User ID
 * @param {string} taskId - Optional task ID (uses first upcoming task if not provided)
 * @returns {Promise<Object>} Calculation result
 */
export async function testSmartReminderCalculation(userId, taskId = null) {
  logger.info(`🧪 Testing smart reminder calculation for user ${userId}`);

  try {
    const user = await User.findById(userId).lean();

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Find the task
    let task;
    if (taskId) {
      task = await Task.findOne({ _id: taskId, userId }).lean();
      if (!task) {
        return { success: false, error: "Task not found" };
      }
    } else {
      // Find first upcoming task
      const now = new Date();
      task = await Task.findOne({
        userId,
        status: { $ne: "done" },
        dueDate: { $gte: now },
      })
        .sort({ dueDate: 1 })
        .lean();

      if (!task) {
        task = await Task.findOne({
          userId,
          status: { $ne: "done" },
        })
          .sort({ createdAt: -1 })
          .lean();
      }
    }

    if (!task) {
      return {
        success: false,
        error: "No tasks found for testing",
        hint: "Create a task first to test smart reminder calculation",
      };
    }

    // Check for scheduled sessions for this task
    const now = new Date();
    const nextSchedule = await TaskSchedule.findOne({
      taskId: task._id,
      start: { $gte: now },
      status: { $ne: "completed" },
    })
      .sort({ start: 1 })
      .lean();

    // Determine the reminder date: schedule takes priority over due date
    const reminderDate = nextSchedule?.start || task.dueDate;
    const source = nextSchedule ? "schedule" : "dueDate";

    // Get subtasks for this task
    const subtasks = await SubTask.find({ taskId: task._id }).sort({ index: 1 }).lean();

    // Calculate smart timing (uses pre-calculated prediction from task)
    const smartTiming = await calculateSmartReminderTiming(task, user);

    // Calculate default timing for comparison
    const defaultTiming = {
      minutesBefore: user.pushNotifications?.taskReminders?.defaultReminderMinutes || 60,
      remindCount: 1,
      urgency: "normal",
    };

    // Build sample notifications for both
    const smartNotification = buildTaskReminderNotification(task, smartTiming, source);
    const defaultNotification = buildTaskReminderNotification(task, defaultTiming, source);

    return {
      success: true,
      task: {
        id: task._id,
        name: task.taskname,
        category: task.category,
        importance: task.importance,
        estimatedDuration: task.estimatedDuration,
        dueDate: task.dueDate,
        status: task.status,
        // Show pre-calculated prediction from task (used for smart reminders)
        predictedCompletionCategory: task.predictedCompletionCategory,
        predictionScore: task.predictionScore,
      },
      scheduling: {
        source,
        reminderDate,
        hasSchedule: !!nextSchedule,
        nextScheduleStart: nextSchedule?.start,
        nextScheduleEnd: nextSchedule?.end,
      },
      subtasks: subtasks.map((st) => ({
        index: st.index,
        title: st.title,
        status: st.status,
        minutes: st.minutes,
      })),
      comparison: {
        smart: {
          timing: smartTiming,
          notification: {
            title: smartNotification.title,
            body: smartNotification.body,
          },
        },
        default: {
          timing: defaultTiming,
          notification: {
            title: defaultNotification.title,
            body: defaultNotification.body,
          },
        },
      },
      mlPrediction: {
        source: task.predictedCompletionCategory ? "pre-calculated" : "live-prediction",
        category: smartTiming.predictionCategory,
        score: smartTiming.predictionScore,
        interpretation: getCategoryInterpretation(smartTiming.predictionCategory),
      },
    };
  } catch (error) {
    logger.error(`🧪 Smart reminder calculation test failed:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Get human-readable interpretation of ML prediction category
 */
function getCategoryInterpretation(category) {
  const interpretations = {
    1: "Very quick completion expected - minimal reminders needed",
    2: "Quick completion expected - standard reminder timing",
    3: "Moderate completion time - may need earlier reminders",
    4: "Slow completion expected - multiple earlier reminders recommended",
    5: "Unlikely to complete quickly - aggressive reminder strategy",
  };
  return interpretations[category] || "Unknown category";
}

/**
 * Register or update user's push token
 *
 * @param {string} userId - User ID
 * @param {string} token - Expo Push Token
 * @param {string} platform - Device platform (ios/android)
 * @returns {Promise<Object>} Update result
 */
export async function registerPushToken(userId, token, platform = null) {
  if (!isValidExpoPushToken(token)) {
    return { success: false, error: "Invalid Expo push token format" };
  }

  try {
    const result = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          "pushNotifications.expoPushToken": token,
          "pushNotifications.platform": platform,
          "pushNotifications.enabled": true,
        },
      },
      { new: true },
    );

    if (!result) {
      return { success: false, error: "User not found" };
    }

    logger.info(`Registered push token for user ${userId}`);
    return { success: true };
  } catch (error) {
    logger.error(`Failed to register push token for user ${userId}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Update notification preferences for a user
 *
 * @param {string} userId - User ID
 * @param {Object} preferences - Notification preferences to update
 * @returns {Promise<Object>} Update result
 */
export async function updateNotificationPreferences(userId, preferences) {
  try {
    const updateFields = {};

    if (preferences.enabled !== undefined) {
      updateFields["pushNotifications.enabled"] = preferences.enabled;
    }

    if (preferences.morningDigest !== undefined) {
      if (preferences.morningDigest.enabled !== undefined) {
        updateFields["pushNotifications.morningDigest.enabled"] = preferences.morningDigest.enabled;
      }
      if (preferences.morningDigest.hour !== undefined) {
        updateFields["pushNotifications.morningDigest.hour"] = preferences.morningDigest.hour;
      }
      if (preferences.morningDigest.minute !== undefined) {
        updateFields["pushNotifications.morningDigest.minute"] = preferences.morningDigest.minute;
      }
    }

    if (preferences.taskReminders !== undefined) {
      if (preferences.taskReminders.enabled !== undefined) {
        updateFields["pushNotifications.taskReminders.enabled"] = preferences.taskReminders.enabled;
      }
      if (preferences.taskReminders.defaultReminderMinutes !== undefined) {
        updateFields["pushNotifications.taskReminders.defaultReminderMinutes"] =
          preferences.taskReminders.defaultReminderMinutes;
      }
      if (preferences.taskReminders.useSmartReminders !== undefined) {
        updateFields["pushNotifications.taskReminders.useSmartReminders"] = preferences.taskReminders.useSmartReminders;
      }
    }

    // Handle Ojo notification settings
    if (preferences.ojoNotifications !== undefined) {
      if (preferences.ojoNotifications.enabled !== undefined) {
        updateFields["pushNotifications.ojoNotifications.enabled"] = preferences.ojoNotifications.enabled;
      }
      if (preferences.ojoNotifications.selectedOjoType !== undefined) {
        updateFields["pushNotifications.ojoNotifications.selectedOjoType"] =
          preferences.ojoNotifications.selectedOjoType;
      }
    }

    if (preferences.timezone !== undefined) {
      updateFields["pushNotifications.timezone"] = preferences.timezone;
    }

    const result = await User.findByIdAndUpdate(userId, { $set: updateFields }, { new: true });

    if (!result) {
      return { success: false, error: "User not found" };
    }

    return {
      success: true,
      preferences: result.pushNotifications,
    };
  } catch (error) {
    logger.error(`Failed to update notification preferences for user ${userId}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Get notification preferences for a user
 *
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User's notification preferences
 */
export async function getNotificationPreferences(userId) {
  try {
    const user = await User.findById(userId).select("pushNotifications").lean();

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Include Ojo type options in the response
    const ojoTypes = getOjoTypeOptions();

    return {
      success: true,
      preferences: user.pushNotifications || {
        enabled: false,
        morningDigest: { enabled: true, hour: 8, minute: 0 },
        taskReminders: { enabled: true, defaultReminderMinutes: 60, useSmartReminders: true },
        ojoNotifications: { enabled: false, selectedOjoType: null },
        timezone: "UTC",
      },
      availableOjoTypes: ojoTypes,
    };
  } catch (error) {
    logger.error(`Failed to get notification preferences for user ${userId}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Unregister push token (disable notifications)
 *
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Update result
 */
export async function unregisterPushToken(userId) {
  try {
    const result = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          "pushNotifications.expoPushToken": null,
          "pushNotifications.enabled": false,
        },
      },
      { new: true },
    );

    if (!result) {
      return { success: false, error: "User not found" };
    }

    logger.info(`Unregistered push token for user ${userId}`);
    return { success: true };
  } catch (error) {
    logger.error(`Failed to unregister push token for user ${userId}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Send a test notification to verify setup
 *
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Send result
 */
export async function sendTestNotification(userId) {
  const payload = {
    title: "🎉 Mojo Notifications Active!",
    body: "Push notifications are working correctly. You'll receive task reminders and morning digests.",
    data: { type: "test" },
  };

  try {
    const result = await sendNotificationToUser(userId, payload);

    // If push was sent successfully, return the result
    if (result && result.success) return result;

    // If sending failed due to missing/invalid token or user settings,
    // store an in-app notification so the user still sees the test message
    const errMsg = result && result.error ? String(result.error) : "Unknown error";
    const nonPushReasons = ["No valid push token", "Notifications disabled for user", "User not found"];

    if (nonPushReasons.some((r) => errMsg.includes(r))) {
      await storeInAppNotification({
        userId,
        title: payload.title,
        body: payload.body,
        data: payload.data,
        type: "test",
      });
      return { success: true, message: `Stored in-app notification (push not sent): ${errMsg}` };
    }

    // For other errors, return the original result so callers can handle it
    return result;
  } catch (error) {
    logger.error(`sendTestNotification error for user ${userId}:`, error);
    // As a best-effort fallback, store an in-app notification
    try {
      await storeInAppNotification({
        userId,
        title: payload.title,
        body: payload.body,
        data: payload.data,
        type: "test",
      });
      return { success: true, message: "Stored in-app notification due to error while sending push" };
    } catch (e) {
      logger.error("Failed to store fallback in-app notification:", e);
      return { success: false, error: error.message };
    }
  }
}

// Store active test intervals per user
const activeTestIntervals = new Map();

/**
 * Start periodic test notifications (every 1 minute)
 *
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Start result
 */
export async function startPeriodicTestNotifications(userId) {
  // Stop any existing interval for this user
  if (activeTestIntervals.has(userId)) {
    clearInterval(activeTestIntervals.get(userId));
  }

  let count = 0;

  // Send first notification immediately
  const firstResult = await sendNotificationToUser(userId, {
    title: "🧪 Test Mode Started!",
    body: `Test notification #1 - You'll receive one every minute. Go to settings to stop.`,
    data: { type: "periodic_test", count: 1 },
  });

  count = 1;

  // Set up interval for every 1 minute (60000 ms)
  const intervalId = setInterval(async () => {
    count++;
    const now = new Date();
    const timeStr = now.toLocaleTimeString();

    await sendNotificationToUser(userId, {
      title: `🧪 Test Notification #${count}`,
      body: `Sent at ${timeStr} - Testing push notifications every minute.`,
      data: { type: "periodic_test", count },
    });

    logger.info(`Sent periodic test notification #${count} to user ${userId}`);
  }, 60000); // 1 minute

  activeTestIntervals.set(userId, intervalId);

  logger.info(`Started periodic test notifications for user ${userId}`);
  return { success: true, message: "Periodic test notifications started (every 1 minute)" };
}

/**
 * Stop periodic test notifications
 *
 * @param {string} userId - User ID
 * @returns {Object} Stop result
 */
export function stopPeriodicTestNotifications(userId) {
  if (activeTestIntervals.has(userId)) {
    clearInterval(activeTestIntervals.get(userId));
    activeTestIntervals.delete(userId);
    logger.info(`Stopped periodic test notifications for user ${userId}`);
    return { success: true, message: "Periodic test notifications stopped" };
  }
  return { success: true, message: "No active test notifications to stop" };
}

/**
 * Check if periodic test notifications are active for a user
 *
 * @param {string} userId - User ID
 * @returns {boolean} Whether test mode is active
 */
export function isTestModeActive(userId) {
  return activeTestIntervals.has(userId);
}
