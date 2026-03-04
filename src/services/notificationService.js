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
import { predictTask } from "./mlPredictionService.js";
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
  const validMessages = messages.filter(msg => isValidExpoPushToken(msg.to));
  
  if (validMessages.length === 0) {
    logger.warn("No valid push tokens in batch");
    return { success: true, data: [] };
  }

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Accept": "application/json",
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
          "pushNotifications.enabled": false 
        } 
      }
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

    if (!user.pushNotifications?.enabled) {
      return { success: false, error: "Notifications disabled for user" };
    }

    const token = user.pushNotifications?.expoPushToken;
    if (!isValidExpoPushToken(token)) {
      return { success: false, error: "No valid push token" };
    }

    const message = {
      to: token,
      sound: notification.sound || "default",
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
      badge: notification.badge,
      priority: notification.priority || "high",
      channelId: notification.channelId || "default",
    };

    return await sendPushNotifications([message]);
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
  const user = await User.findById(userId).select('pushNotifications.timezone').lean();
  const userTimezone = user?.pushNotifications?.timezone || 'UTC';

  // Get today's date in user's local timezone
  const now = new Date();
  const userLocalNow = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }));
  
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
  const todaysTasks = allTasks.filter(task => {
    if (!task.dueDate) return false;
    
    // Convert task's dueDate to user's local timezone
    const taskDueDate = new Date(task.dueDate);
    const taskLocalDate = new Date(taskDueDate.toLocaleString('en-US', { timeZone: userTimezone }));
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

  const scheduledTaskIds = [...new Set(scheduledSessions.map(s => s.taskId.toString()))];
  
  // Add scheduled tasks that aren't already in the list
  const existingTaskIds = new Set(todaysTasks.map(t => t._id.toString()));
  const additionalTaskIds = scheduledTaskIds.filter(id => !existingTaskIds.has(id));
  
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
  const highPriorityTasks = tasks.filter(t => t.importance >= 4);
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
      taskIds: tasks.map(t => t._id.toString()),
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

  logger.info(`Running morning digest check at ${currentUTCHour}:${String(currentUTCMinute).padStart(2, '0')} UTC`);

  // Find users who should receive morning digest
  const users = await User.find({
    "pushNotifications.enabled": true,
    "pushNotifications.morningDigest.enabled": true,
    "pushNotifications.expoPushToken": { $ne: null },
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

  for (const user of users) {
    try {
      // Get user's preferred time
      const userHour = user.pushNotifications?.morningDigest?.hour || 8;
      const userMinute = user.pushNotifications?.morningDigest?.minute || 0;
      const userTimezone = user.pushNotifications?.timezone || "UTC";
      
      // Get current time in user's timezone
      const userLocalTime = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }));
      const currentUserHour = userLocalTime.getHours();
      const currentUserMinute = userLocalTime.getMinutes();
      
      logger.info(`User ${user._id}: Local time ${currentUserHour}:${String(currentUserMinute).padStart(2, '0')} ${userTimezone}, Preferred ${userHour}:${String(userMinute).padStart(2, '0')}`);
      
      // Check if current local time matches user's preferred time
      if (currentUserHour !== userHour || currentUserMinute !== userMinute) {
        results.skipped++;
        continue;
      }

      const token = user.pushNotifications?.expoPushToken;
      if (!isValidExpoPushToken(token)) {
        results.skipped++;
        continue;
      }

      // Get today's tasks for this user
      const tasks = await getTodaysTasks(user._id);
      const notification = buildMorningDigestNotification(user, tasks);

      messages.push({
        to: token,
        sound: "default",
        title: notification.title,
        body: notification.body,
        data: notification.data,
        priority: "high",
        channelId: "morning-digest",
      });

      userUpdates.push(user._id);
    } catch (error) {
      logger.error(`Failed to prepare digest for user ${user._id}:`, error);
      results.failed++;
    }
  }

  // Send all notifications in batch
  if (messages.length > 0) {
    const sendResult = await sendPushNotifications(messages);
    
    if (sendResult.success) {
      results.sent = messages.length;
      
      // Update lastMorningDigest for all users
      await User.updateMany(
        { _id: { $in: userUpdates } },
        { $set: { "pushNotifications.lastMorningDigest": now } }
      );
    } else {
      results.failed = messages.length;
    }
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

  logger.info(`🧪 Running MORNING DIGEST TEST at ${currentUTCHour}:${String(currentUTCMinute).padStart(2, '0')} UTC`);

  // Find all users with morning digest enabled (no lastMorningDigest check)
  const users = await User.find({
    "pushNotifications.enabled": true,
    "pushNotifications.morningDigest.enabled": true,
    "pushNotifications.expoPushToken": { $ne: null },
  }).lean();

  logger.info(`Found ${users.length} users for morning digest test`);

  const results = {
    total: users.length,
    sent: 0,
    failed: 0,
    skipped: 0,
  };

  const messages = [];

  for (const user of users) {
    try {
      // Get user's preferred time
      const userHour = user.pushNotifications?.morningDigest?.hour || 8;
      const userMinute = user.pushNotifications?.morningDigest?.minute || 0;
      const userTimezone = user.pushNotifications?.timezone || "UTC";
      
      // Get current time in user's timezone
      const userLocalTime = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }));
      const currentUserHour = userLocalTime.getHours();
      const currentUserMinute = userLocalTime.getMinutes();
      
      logger.info(`🧪 User ${user._id}: Local time ${currentUserHour}:${String(currentUserMinute).padStart(2, '0')} ${userTimezone}, Preferred ${userHour}:${String(userMinute).padStart(2, '0')}`);
      
      // For testing, skip the time check - send to all users with digest enabled
      const token = user.pushNotifications?.expoPushToken;
      if (!isValidExpoPushToken(token)) {
        results.skipped++;
        continue;
      }

      // Get today's tasks for this user
      const tasks = await getTodaysTasks(user._id);
      const notification = buildMorningDigestNotification(user, tasks);

      messages.push({
        to: token,
        sound: "default",
        title: notification.title,
        body: notification.body,
        data: notification.data,
        priority: "high",
        channelId: "morning-digest",
      });
    } catch (error) {
      logger.error(`🧪 Failed to prepare test digest for user ${user._id}:`, error);
      results.failed++;
    }
  }

  // Send all notifications in batch
  if (messages.length > 0) {
    const sendResult = await sendPushNotifications(messages);
    
    if (sendResult.success) {
      results.sent = messages.length;
    } else {
      results.failed = messages.length;
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
    let category, score;
    
    // Use pre-calculated prediction from task if available
    if (task.predictedCompletionCategory) {
      category = task.predictedCompletionCategory;
      score = task.predictionScore || 0.5;
      logger.info(`Using pre-calculated prediction for task ${task._id}: category=${category}, score=${score}`);
    } else {
      // Fall back to making a new ML prediction
      const prediction = await predictTask(task);
      
      if (!prediction.success) {
        return { 
          minutesBefore: defaultMinutes, 
          urgency: "normal",
          remindCount: 1,
        };
      }
      
      category = prediction.category;
      score = prediction.score;
      logger.info(`Made new ML prediction for task ${task._id}: category=${category}, score=${score}`);
    }
    
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

    return {
      minutesBefore,
      remindCount,
      urgency,
      predictionScore: score,
      predictionCategory: category,
    };
  } catch (error) {
    logger.warn(`Smart reminder calculation failed for task ${task._id}:`, error.message);
    return {
      minutesBefore: defaultMinutes,
      remindCount: 1,
      urgency: "normal",
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
function buildTaskReminderNotification(task, timing, source = 'dueDate') {
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

  const timeStr = minutesBefore >= 60 
    ? `${Math.floor(minutesBefore / 60)}h ${minutesBefore % 60}m`
    : `${minutesBefore}m`;

  const actionStr = source === 'schedule' ? 'scheduled' : 'due';
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
function buildSubtaskReminderNotification(task, subtaskIndex, subtaskTitle, timing, source = 'dueDate') {
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

  const timeStr = minutesBefore >= 60 
    ? `${Math.floor(minutesBefore / 60)}h ${minutesBefore % 60}m`
    : `${minutesBefore}m`;

  const actionStr = source === 'schedule' ? 'scheduled' : 'due';
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
  const ojoDecision = determineOjoTypeForNotification(user, timing);
  
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
    
    return {
      title: ojoNotification.title,
      body: ojoNotification.body,
      data: {
        type: isSubtask ? "subtask_reminder" : "task_reminder",
        taskId: task._id.toString(),
        subtaskIndex: isSubtask ? subtask?.index : undefined,
        subtaskTitle: isSubtask ? (subtask?.title || `Part ${subtask?.index}`) : undefined,
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
      $lte: fourHoursFromNow 
    },
    status: { $ne: "completed" },
  }).populate("taskId").lean();

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
      $lte: fourHoursFromNow 
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
    taskId: { $in: upcomingTasks.map(t => t._id) },
  }).lean();

  for (const subtask of subtasksWithUpcomingTasks) {
    const key = `${subtask.taskId}-${subtask.index}`;
    if (!processedSubtaskKeys.has(key)) {
      const parentTask = upcomingTasks.find(t => t._id.toString() === subtask.taskId.toString());
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

      const token = user.pushNotifications?.expoPushToken;
      if (!isValidExpoPushToken(token)) {
        results.skipped++;
        continue;
      }

      // Calculate smart reminder timing (uses task's pre-calculated prediction)
      const useSmartReminders = user.pushNotifications?.taskReminders?.useSmartReminders !== false;
      const timing = useSmartReminders 
        ? await calculateSmartReminderTiming(task, user)
        : { 
            minutesBefore: user.pushNotifications?.taskReminders?.defaultReminderMinutes || 60,
            remindCount: 1,
            urgency: "normal",
          };

      // Check if it's time to send this reminder based on reminderDate (schedule or due date)
      const targetTime = new Date(reminderDate).getTime();
      const reminderTime = targetTime - (timing.minutesBefore * 60 * 1000);
      
      // Allow 5 minute window for the reminder
      if (now.getTime() < reminderTime - 5 * 60 * 1000 || now.getTime() > reminderTime + 5 * 60 * 1000) {
        results.skipped++;
        continue;
      }

      // Build notification with Ojo if enabled, otherwise use standard format
      const subtaskInfo = isSubtask ? { index: subtaskIndex, title: subtaskTitle } : null;
      const notification = await buildNotificationWithOjo(user, task, {
        subtask: subtaskInfo,
        timing,
        source,
        isSubtask,
      });
      
      const sendResult = await sendNotificationToUser(task.userId, {
        ...notification,
        channelId: "task-reminders",
      });

      if (sendResult.success) {
        results.sent++;
        
        // Update last reminder timestamp
        await User.updateOne(
          { _id: task.userId },
          { $set: { "pushNotifications.lastTaskReminder": now } }
        );
      } else {
        results.failed++;
      }
    } catch (error) {
      logger.error(`Failed to send reminder for ${isSubtask ? 'subtask' : 'task'} ${task._id}:`, error);
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

    const token = user.pushNotifications?.expoPushToken;
    if (!isValidExpoPushToken(token)) {
      return { success: false, error: "No valid push token registered" };
    }

    // Find user's next upcoming task (or most recent incomplete task)
    const now = new Date();
    let task = await Task.findOne({
      userId,
      status: { $ne: "done" },
      dueDate: { $gte: now },
    }).sort({ dueDate: 1 }).lean();

    // If no upcoming task, find any incomplete task
    if (!task) {
      task = await Task.findOne({
        userId,
        status: { $ne: "done" },
      }).sort({ createdAt: -1 }).lean();
    }

    // If still no task, create a mock task for testing
    if (!task) {
      task = {
        _id: "test-task-id",
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
    }).sort({ start: 1 }).lean();

    // Determine the reminder source: schedule takes priority over due date
    const source = nextSchedule ? "schedule" : "dueDate";

    // Determine Ojo settings for test
    // useOjo parameter takes precedence - if explicitly false, don't use Ojo
    const ojoDecision = determineOjoTypeForNotification(user, timing);
    const shouldUseOjo = useOjo === true ? true : (useOjo === false ? false : ojoDecision.useOjo);
    const selectedOjoType = shouldUseOjo ? (forceOjoType || ojoDecision.ojoType) : null;

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
        ? `Task reminder test sent (${useSmartReminders ? 'smart' : 'default'} mode, Ojo: ${shouldUseOjo ? selectedOjoType : 'disabled'})`
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

    const token = user.pushNotifications?.expoPushToken;
    if (!isValidExpoPushToken(token)) {
      return { success: false, error: "No valid push token registered" };
    }

    // Find user's first incomplete subtask with its parent task
    const now = new Date();
    const subtask = await SubTask.findOne({
      userId,
      status: { $ne: "done" },
    }).sort({ createdAt: -1 }).lean();

    if (!subtask) {
      return { 
        success: false, 
        error: "No subtasks found",
        hint: "Create a task with subtasks (taskType: 'in_parts' or 'leaky') first to test subtask reminders"
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
    }).sort({ start: 1 }).lean();

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
        ? `Subtask reminder test sent (${useSmartReminders ? 'smart' : 'default'} mode)`
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
  
  logger.info(`🧪 Testing Ojo reminder for user ${userId}, forceOjoType=${forceOjoType || 'auto'}`);

  try {
    const user = await User.findById(userId).lean();
    
    if (!user) {
      return { success: false, error: "User not found" };
    }

    const token = user.pushNotifications?.expoPushToken;
    if (!isValidExpoPushToken(token)) {
      return { success: false, error: "No valid push token registered" };
    }

    // Find user's next upcoming task (or most recent incomplete task)
    const now = new Date();
    let task = await Task.findOne({
      userId,
      status: { $ne: "done" },
      dueDate: { $gte: now },
    }).sort({ dueDate: 1 }).lean();

    // If no upcoming task, find any incomplete task
    if (!task) {
      task = await Task.findOne({
        userId,
        status: { $ne: "done" },
      }).sort({ createdAt: -1 }).lean();
    }

    // If still no task, create a mock task for testing
    if (!task) {
      task = {
        _id: "test-task-id",
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
    }).sort({ start: 1 }).lean();

    // Determine the reminder source: schedule takes priority over due date
    const source = nextSchedule ? "schedule" : "dueDate";

    // Determine Ojo type
    // For Ojo test: use forced type, user's selected type, or default to mentorjo
    // We do NOT use prediction-based auto-selection here since this test is about Ojo content, not smart timing
    let selectedOjoType;
    let ojoSelectionMethod;
    
    if (forceOjoType) {
      // Use forced Ojo type (from test parameter)
      selectedOjoType = forceOjoType;
      ojoSelectionMethod = "forced";
    } else if (user.pushNotifications?.ojoNotifications?.selectedOjoType) {
      // Use user's selected Ojo type
      selectedOjoType = user.pushNotifications.ojoNotifications.selectedOjoType;
      ojoSelectionMethod = "user_selected";
    } else {
      // Default to mentorjo
      selectedOjoType = "mentorjo";
      ojoSelectionMethod = "default";
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
      }).sort({ dueDate: 1 }).lean();

      if (!task) {
        task = await Task.findOne({
          userId,
          status: { $ne: "done" },
        }).sort({ createdAt: -1 }).lean();
      }
    }

    if (!task) {
      return { 
        success: false, 
        error: "No tasks found for testing",
        hint: "Create a task first to test smart reminder calculation"
      };
    }

    // Check for scheduled sessions for this task
    const now = new Date();
    const nextSchedule = await TaskSchedule.findOne({
      taskId: task._id,
      start: { $gte: now },
      status: { $ne: "completed" },
    }).sort({ start: 1 }).lean();

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
      subtasks: subtasks.map(st => ({
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
      { new: true }
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
        updateFields["pushNotifications.taskReminders.defaultReminderMinutes"] = preferences.taskReminders.defaultReminderMinutes;
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
        updateFields["pushNotifications.ojoNotifications.selectedOjoType"] = preferences.ojoNotifications.selectedOjoType;
      }
    }
    
    if (preferences.timezone !== undefined) {
      updateFields["pushNotifications.timezone"] = preferences.timezone;
    }

    const result = await User.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { new: true }
    );

    if (!result) {
      return { success: false, error: "User not found" };
    }

    return { 
      success: true, 
      preferences: result.pushNotifications 
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
      { new: true }
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
  return sendNotificationToUser(userId, {
    title: "🎉 Mojo Notifications Active!",
    body: "Push notifications are working correctly. You'll receive task reminders and morning digests.",
    data: { type: "test" },
  });
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
