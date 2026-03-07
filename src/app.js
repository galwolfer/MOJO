/*
 * File: src/app.js
 * Purpose: Express application setup and route mounting
 */
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import fs from "fs";
import routes from "./routes/index.js";
import usersRouter from "./routes/Users.js";
import { expiredTaskBlocker } from "./middlewares/expiredTaskBlocker.js";
import { notFound, errorHandler } from "./middlewares/error.js";

const app = express();

// Ensure uploads directory exists and serve it statically
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

// Serve frontend Ojo notification icons so push notifications can reference them by URL
const notificationIconsDir = path.join(process.cwd(), "frontend", "assets");
app.use("/notification-icons", express.static(notificationIconsDir));

// Core middlewares
app.use(helmet()); // Secure headers
app.use(cors()); // CORS
app.use(express.json({ limit: "50mb" })); // JSON body parsing (increased for profile image uploads)
app.use(morgan("dev")); // HTTP logging

// Routes that are NOT blocked by expired tasks
app.use("/api/users", usersRouter);

// Block users with expired tasks from accessing other routes
// Note: /api/tasks/expired/* routes are whitelisted in expiredTaskBlocker middleware
app.use(expiredTaskBlocker);

// Routes that ARE blocked if user has expired tasks (except /tasks/expired/*)
app.use("/api", routes);

// Health & root
app.get("/", (_req, res) => {
  res.send("Mojo's Server is up");
});

// 404 + global error
app.use(notFound);
app.use(errorHandler);

export default app;
