// src/server.js
// Notes are in English as requested.
import { createServer } from "http";
import app from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase } from "./config/database.js";
import { logger } from "./utils/logger.js";
import { startPriorityScheduler } from "./services/scheduling/priorityScheduler.js";
import { startPredictionScheduler } from "./services/ml/scheduledPrediction.js";
import { startExpiredTaskChecker } from "./services/tasks/expiredTaskChecker.js";

const server = createServer(app);
const port = Number(env.PORT ?? 3000);

connectDatabase()
  .then(() => {
    server.listen(port, () => {
      logger.info(`HTTP server listening on http://localhost:${port}`);
      startPriorityScheduler();
      
      // Start ML prediction scheduler for push notifications
      // Default: runs at 8am, 11am, 2pm, 5pm, 8pm
      if (env.ENABLE_PREDICTIONS !== "false") {
        startPredictionScheduler();
      }
      
      // Start expired task checker (runs every hour)
      // Sends push notifications when tasks expire
      startExpiredTaskChecker();
    });
  })
  .catch((error) => {
    logger.error("Failed to connect to MongoDB:", error);
    process.exit(1);
  });
