import mongoose from "mongoose";

export function normalizeObjectId(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return mongoose.isValidObjectId(trimmed) ? trimmed : null;
}

export function normalizeSessionId(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^[A-Za-z0-9_-]{3,128}$/.test(trimmed) ? trimmed : null;
}

export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeSearchRegex(value, maxLength = 100) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, maxLength);
  return trimmed ? escapeRegExp(trimmed) : null;
}

export function normalizeUsernameLookup(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^[A-Za-z0-9._-]{3,64}$/.test(trimmed) ? trimmed : null;
}

export function normalizeEmailLookup(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
}