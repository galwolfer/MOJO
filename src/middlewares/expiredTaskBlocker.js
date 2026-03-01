// src/middlewares/expiredTaskBlocker.js
// Middleware that blocks users from using the app until they handle expired tasks

import { userHasExpiredTasks, findExpiredTasksForUser } from "../services/taskService.js";

/**
 * List of routes that are NOT blocked (user can always access these)
 */
const ALLOWED_ROUTES = [
  // Auth routes
  "/api/auth",
  "/api/users/login",
  "/api/users/register",
  "/api/users/logout",

  // Health check
  "/api/health",
  "/health",

  // Expired tasks routes (so user can handle them!)
  "/api/tasks/expired",

  // Overdue tasks check (used by frontend to detect and redirect on startup)
  "/api/tasks/overdue",

  // Static files
  "/static",
  "/public",
];

/**
 * Check if a route is in the allowed list
 */
function isRouteAllowed(path) {
  return ALLOWED_ROUTES.some((allowed) => path.startsWith(allowed));
}

/**
 * Middleware to block users with expired tasks
 *
 * If the user has expired tasks, they get a 403 response with details
 * about what tasks need to be handled.
 *
 * Usage:
 *   app.use(expiredTaskBlocker);
 *
 * Or for specific routes:
 *   router.get('/dashboard', expiredTaskBlocker, dashboardHandler);
 */
export async function expiredTaskBlocker(req, res, next) {
  try {
    // Allow certain routes through without checking
    if (isRouteAllowed(req.path)) {
      return next();
    }

    // Get user ID from auth or query
    const userId = req.user?._id || req.query.userId || req.body?.userId;

    // If no user ID, let them through (auth middleware will handle it)
    if (!userId) {
      return next();
    }

    // Check for expired tasks
    const hasExpired = await userHasExpiredTasks(userId);

    if (!hasExpired) {
      // No expired tasks, continue normally
      return next();
    }

    // User has expired tasks - block them!
    const expiredTasks = await findExpiredTasksForUser(userId);

    return res.status(403).json({
      success: false,
      blocked: true,
      reason: "expired_tasks",
      message: "You have tasks with expired deadlines. Please handle them before continuing.",
      expiredTasks: expiredTasks.map((task) => ({
        _id: task._id,
        taskname: task.taskname,
        dueDate: task.dueDate,
        daysOverdue: task.daysOverdue,
        importance: task.importance,
      })),
      actions: {
        extend: {
          method: "PATCH",
          url: "/api/tasks/expired/:taskId/extend",
          body: { newDeadline: "ISO date string" },
        },
      },
    });
  } catch (error) {
    // On error, let them through (fail open) and log the error
    console.error("Expired task blocker error:", error);
    return next();
  }
}

/**
 * Optional: Lighter version that just adds a warning header
 * instead of blocking completely
 */
export async function expiredTaskWarner(req, res, next) {
  try {
    const userId = req.user?._id || req.query.userId;

    if (userId) {
      const hasExpired = await userHasExpiredTasks(userId);

      if (hasExpired) {
        // Add warning header but don't block
        res.setHeader("X-Expired-Tasks", "true");
        res.setHeader("X-Expired-Tasks-Action", "/api/tasks/expired");
      }
    }

    next();
  } catch (error) {
    next();
  }
}

export default expiredTaskBlocker;
