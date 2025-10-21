// Notes are in English as requested.
import { createServer } from "http";
import app from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase } from "./config/database.js";
import { logger } from "./utils/logger.js";

const server = createServer(app);
const port = env.PORT;

// Connect to MongoDB before starting the server
connectDatabase()
  .then(() => {
    // Start HTTP server
    server.listen(port, () => {
      logger.info(`HTTP server listening on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    logger.error("Failed to connect to MongoDB:", error);
    process.exit(1);
  });
