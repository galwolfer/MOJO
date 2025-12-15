import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import routes from "./routes/index.js";
import usersRouter from "./routes/Users.js";
import { expiredTaskBlocker } from "./middlewares/expiredTaskBlocker.js";
import { notFound, errorHandler } from "./middlewares/error.js";

const app = express();

// Core middlewares
app.use(helmet()); // Secure headers
app.use(cors()); // CORS
app.use(express.json()); // JSON body parsing
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
