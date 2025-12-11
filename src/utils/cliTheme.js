// src/utils/cliTheme.js
// ANSI styling helpers for the CLI. Not needed by the API layer.

export const ansi = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
};

export const paint = (text, ...styles) => `${styles.join("")}${text}${ansi.reset}`;

export const theme = {
  title: (text) => paint(text, ansi.bold, ansi.cyan),
  subtitle: (text) => paint(text, ansi.dim, ansi.gray),
  success: (text) => paint(text, ansi.bold, ansi.green),
  warning: (text) => paint(text, ansi.bold, ansi.yellow),
  error: (text) => paint(text, ansi.bold, ansi.red),
  info: (text) => paint(text, ansi.blue),
  prompt: (text) => paint(text, ansi.bold, ansi.magenta),
  option: (text) => paint(text, ansi.bold, ansi.yellow),
  accent: (text) => paint(text, ansi.bold, ansi.blue),
  muted: (text) => paint(text, ansi.dim, ansi.gray),
};
