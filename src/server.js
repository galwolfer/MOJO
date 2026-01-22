/*
 * File: src/server.js
 * Purpose: Bootstraps HTTP server, database connection and background jobs
 */
import { createServer } from "http";
import app from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase } from "./config/database.js";
import { logger } from "./utils/logger.js";
import { startPriorityScheduler } from "./services/schedulingService.js";
import { startExpiredTaskChecker } from "./services/taskService.js";
import { startStreakChecker } from "./services/streakService.js";
import { initializeOjoTypes } from "./utils/ojoTypeUtils.js";

const server = createServer(app);
const port = Number(env.PORT ?? 3000);

connectDatabase()
  .then(async () => {
    // Initialize OjoTypes in the database
    await initializeOjoTypes();

    server.listen(port, () => {
      logger.info(`HTTP server listening on http://localhost:${port}`);
      startPriorityScheduler();

      // Start expired task checker (runs every hour)
      // Sends push notifications when tasks expire
      startExpiredTaskChecker();

      // Start streak checker (runs daily at midnight)
      // Resets streaks for users who didn't complete tasks yesterday
      startStreakChecker();
    });
  })
  .catch((error) => {
    logger.error("Failed to connect to MongoDB:", error);
    process.exit(1);
  });
