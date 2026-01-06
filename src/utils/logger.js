/*
 * File: src/utils/logger.js
 * Purpose: Minimal logger facade for server logs
 */
const base =
  (level) =>
  (...args) =>
    console[level](`[${level.toUpperCase()}]`, ...args);

export const logger = {
  info: base("log"),
  warn: base("warn"),
  error: base("error"),
};
