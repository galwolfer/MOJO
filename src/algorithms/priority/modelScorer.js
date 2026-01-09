// src/algorithms/priority/modelScorer.js
// Utility helpers to load logistic regression weights and score categories.

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const CATEGORY_ORDER = ["work", "study", "health", "social", "finance", "household", "creative", "uncategorized"];
// CATEGORY_ORDER: ordered list of categories used to one-hot encode labels
const MODEL_PREFIX = "model_logreg_";
const DEFAULT_MODEL_DIR = "data";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// projectRoot: go up three levels from algorithms/priority -> project root
const projectRoot = path.resolve(__dirname, "../../..");

let cachedModel = null;
let cachedPath = null;

const sigmoid = (x) => 1 / (1 + Math.exp(-x));
// sigmoid: logistic function used to convert linear score -> probability

const encodeCategory = (category) =>
  CATEGORY_ORDER.map((name) => (name === category ? 1 : 0));
// encodeCategory: one-hot encode the category for model features

const timeFeatures = (timestamp) => {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const hours = date.getUTCHours();
  const day = date.getUTCDay();
  return [
    hours / 23,
    hours >= 5 && hours < 12 ? 1 : 0,
    hours >= 12 && hours < 17 ? 1 : 0,
    hours >= 17 && hours < 22 ? 1 : 0,
    day === 0 || day === 6 ? 1 : 0,
  ];
};
// timeFeatures: normalized hour + time-of-day + weekend flag used by model

export function buildFeatureVector({ category, priorities = {}, recentCounts = {}, timestamp = new Date() }) {
  const normalizedCategory = CATEGORY_ORDER.includes(category) ? category : "uncategorized";
  const priority = Number(priorities[normalizedCategory] ?? 3);
  const count = Number(recentCounts[normalizedCategory] ?? 0);
  const ratio = priority / (count + 1);

  return [
    priority / 5,
    count,
    ratio / 5,
    ...timeFeatures(timestamp),
    ...encodeCategory(normalizedCategory),
  ];
}
// buildFeatureVector: create numeric input expected by logistic regression weights

export async function loadSuggestionModel(modelPath = process.env.MODEL_WEIGHTS_PATH) {
  try {
    let resolved = modelPath;

    if (!resolved) {
      const defaultDir = path.resolve(projectRoot, DEFAULT_MODEL_DIR);
      resolved = await findLatestModel(defaultDir);
      if (!resolved) return null;
    } else if (!path.isAbsolute(resolved)) {
      resolved = path.resolve(projectRoot, resolved);
    }

    // return cached model if same path to avoid repeated file reads
    if (cachedModel && cachedPath === resolved) {
      return cachedModel;
    }

    const raw = await fs.readFile(resolved, "utf8");
    const parsed = JSON.parse(raw);

    // verify expected model shape (weights array + bias number)
    if (!Array.isArray(parsed.weights) || typeof parsed.bias !== "number") {
      throw new Error("Model file missing weights or bias");
    }

    cachedModel = { ...parsed, path: resolved };
    cachedPath = resolved;
    return cachedModel;
  } catch (err) {
    console.error("Suggestion model load failed:", err?.message || err);
    cachedModel = null;
    cachedPath = null;
    return null;
  }
}

async function findLatestModel(dir) {
  try {
    const entries = await fs.readdir(dir);
    const candidates = entries
      .filter((name) => name.startsWith(MODEL_PREFIX) && name.endsWith(".json"))
      .sort();
    if (!candidates.length) return null;
    return path.join(dir, candidates[candidates.length - 1]);
  } catch {
    return null;
  }
}
// findLatestModel: pick newest model file matching prefix in the data directory

export function scoreCategory(model, options) {
  if (!model) return null;
  const vector = buildFeatureVector(options);
  if (model.weights.length !== vector.length) {
    throw new Error(
      `Model weight length ${model.weights.length} does not match feature length ${vector.length}`
    );
  }
  const z = model.weights.reduce((sum, w, idx) => sum + w * vector[idx], model.bias);
  // compute linear combination + bias, then pass through sigmoid to get probability
  return sigmoid(z);
}

export const MODEL_CATEGORY_ORDER = CATEGORY_ORDER;
