// Notes are in English as requested.
// Put shared middlewares here (auth, validation, rate-limits, etc.)

export const noop = (_req, _res, next) => next();
export { notFound, errorHandler } from "./error.js";
export { requireAuth, optionalAuth } from "./auth.js";
