// Notes are in English as requested.
export function notFound(req, res, _next) {
  res.status(404).json({ error: "Route not found", path: req.originalUrl });
}

export function errorHandler(err, _req, res, _next) {
  // Centralized error handler for the whole app
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV !== "production" ? { stack: err.stack } : {}),
  });
}
