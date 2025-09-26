// Notes are in English as requested.
const base =
  (level) =>
  (...args) =>
    console[level](`[${level.toUpperCase()}]`, ...args);

export const logger = {
  info: base("log"),
  warn: base("warn"),
  error: base("error"),
};
