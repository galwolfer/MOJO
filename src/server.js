// Notes are in English as requested.
import { createServer } from "http";
import app from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";

const server = createServer(app);
const port = env.PORT;

// Start HTTP server
server.listen(port, () => {
  logger.info(`HTTP server listening on http://localhost:${port}`);
});
