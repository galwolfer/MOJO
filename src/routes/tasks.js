import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import * as taskController from "../controllers/taskController.js";

const router = Router();

/**
 * Task Routes
 * All routes require authentication
 */

// Apply authentication to all task routes
router.use(requireAuth);

// Special routes first (must come before :id routes)
router.get("/upcoming/:days?", taskController.getUpcomingTasks);
router.get("/overdue", taskController.getOverdueTasks);
router.post("/:id/toggle", taskController.toggleTaskCompletion);

// Standard CRUD routes
router.post("/", taskController.createTask);
router.get("/", taskController.getTasks);
router.get("/:id", taskController.getTaskById);
router.patch("/:id", taskController.updateTask);
router.delete("/:id", taskController.deleteTask);

export default router;
