// Notes are in English as requested.
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import routes from "./routes/index.js";
import { notFound, errorHandler } from "./middlewares/error.js";

const app = express();

// Core middlewares
app.use(helmet()); // Secure headers
app.use(cors()); // CORS
app.use(express.json()); // JSON body parsing
app.use(morgan("dev")); // HTTP logging

// Routes
app.use("/api", routes);

// Health & root
app.get("/", (_req, res) => {
  res.send("Mojo's Server is up");
});

// 404 + global error
app.use(notFound);
app.use(errorHandler);

export default app;
