/**
 * @fileoverview Subcategory Generator Service
 * @module services/ml/subcategoryGenerator
 * 
 * Generates personalized subcategory labels for tasks based on text analysis.
 * Uses NLP techniques to extract meaningful keywords from task names/descriptions.
 * 
 * Key responsibilities:
 * - Extract keywords from task text (removing stop words)
 * - Generate unique subcategory labels per user
 * - Analyze task history for pattern detection
 * - Support task organization and filtering
 * 
 * Algorithm: TF-IDF-like keyword extraction with stop word filtering
 * Output: { label: string, keywords: string[], confidence: number }
 */

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "how",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "then",
  "there",
  "to",
  "too",
  "up",
  "was",
  "were",
  "will",
  "with",
  "your",
]);

// Keep a small alias map so related terms collapse to the same canonical token.
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const normalizeToken = (token) => {
  const trimmed = token.replace(/[^a-z0-9]/g, "");
  if (!trimmed) return "";
  return trimmed.replace(/s$/i, "");
};

// Normalize the raw title/description text into consistent tokens.
const cleanTokens = (text = "") =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map(normalizeToken)
    .filter((token) => token && token.length > 2 && !STOP_WORDS.has(token));

const uniqueTokens = (tokens = []) => {
  const seen = new Set();
  const out = [];
  tokens.forEach((token) => {
    if (!seen.has(token)) {
      seen.add(token);
      out.push(token);
    }
  });
  // Sorting ensures deterministic label even if words are entered in diff order.
  return out.sort();
};

const toLabel = (tokens = []) => {
  if (!tokens.length) return "";
  const meaningful = uniqueTokens(tokens);
  if (!meaningful.length) return "";
  return meaningful
    .slice(0, 3)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
};

const jaccard = (aTokens = [], bTokens = []) => {
  if (!aTokens.length || !bTokens.length) return 0;
  const aSet = new Set(aTokens);
  const bSet = new Set(bTokens);
  let intersection = 0;
  aSet.forEach((token) => {
    if (bSet.has(token)) intersection += 1;
  });
  const union = aSet.size + bSet.size - intersection;
  return union ? intersection / union : 0;
};

const tagOverlap = (current = [], history = []) => {
  if (!current.length || !history.length) return 0;
  const historySet = new Set(history.map((t) => String(t || "").toLowerCase()));
  let matches = 0;
  current.forEach((tag) => {
    if (historySet.has(String(tag || "").toLowerCase())) matches += 1;
  });
  return matches / Math.max(current.length, history.length);
};

const shouldRespectManual = (subCategory = {}) => {
  if (!subCategory || typeof subCategory !== "object") return false;
  if (!subCategory.label) return false;
  return subCategory.source === "user" || subCategory.source === "imported";
};

const tokenizeTag = (tag) => tag.replace(/[^a-z0-9]/g, " ").split(/\s+/)[0] || tag;

const buildTagLabel = (tags = []) =>
  tags
    .map((tag) => String(tag || "").trim())
    .filter(Boolean)
    .map((tag) => tag.toLowerCase())
    .map((tag) => tokenizeTag(tag))
    .filter(Boolean)
    .sort()
    .slice(0, 2)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" / ");

// Try to build a heuristic label, falling back to a lightweight tag summary.
const buildHeuristicSuggestion = (tokens = [], tags = []) => {
  const label = toLabel(tokens);
  if (label) {
    return {
      label,
      source: "heuristic",
      confidence: 0.4,
    };
  }
  const tagLabel = buildTagLabel(tags);
  if (tagLabel) {
    return {
      label: tagLabel,
      source: "tag-fallback",
      confidence: 0.25,
    };
  }
  return { label: "", source: "none", confidence: 0 };
};

const fetchHistoricalSubCategories = async (TaskModel, userId) => {
  if (!TaskModel || !userId) return [];
  try {
    return await TaskModel.find(
      {
        userId,
        "subCategory.label": { $exists: true, $ne: "" },
      },
      {
        subCategory: 1,
        taskname: 1,
        description: 1,
        tags: 1,
        updatedAt: 1,
      }
    )
      .sort({ updatedAt: -1 })
      .limit(40)
      .lean();
  } catch (err) {
    console.error("Failed to load task history for subCategory inference:", err?.message || err);
    return [];
  }
};

const scoreHistoryEntry = (entry, tokens = [], tags = []) => {
  if (!entry?.subCategory?.label) return null;
  const entryTokens = cleanTokens(`${entry.taskname || ""} ${entry.description || ""} ${entry.subCategory.label}`);
  const similarity = jaccard(tokens, entryTokens);
  const tagScore = tagOverlap(tags, entry.tags || []);
  const recencyBoost = entry.updatedAt ? 0.1 : 0;
  const score = similarity * 0.7 + tagScore * 0.2 + recencyBoost;
  return {
    label: entry.subCategory.label,
    source: entry.subCategory.source === "user" ? "history-user" : "history",
    confidence: clamp(0.5 + score, 0, 0.95),
    score,
  };
};

export async function generateSubCategory({
  userId,
  title = "",
  description = "",
  tags = [],
  current = {},
  TaskModel = null,
} = {}) {
  if (shouldRespectManual(current)) {
    return {
      label: current.label.trim(),
      source: current.source,
      confidence: clamp(current.confidence ?? 0.8, 0.5, 1),
      updatedAt: current.updatedAt || new Date(),
    };
  }

  const text = `${title || ""} ${description || ""}`.trim();
  const textTokens = cleanTokens(text);
  const normalizedTags = Array.isArray(tags) ? tags.map((tag) => String(tag || "").toLowerCase()) : [];

  let suggestion = buildHeuristicSuggestion(textTokens, normalizedTags);

  const history = await fetchHistoricalSubCategories(TaskModel, userId);
  if (history.length) {
    const scored = history
      .map((entry) => scoreHistoryEntry(entry, textTokens, normalizedTags))
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);
    const best = scored[0];
    if (best && best.score >= 0.2) {
      suggestion = {
        label: best.label,
        source: best.source,
        confidence: best.confidence,
      };
    }
  }

  return {
    label: suggestion.label,
    source: suggestion.source,
    confidence: clamp(suggestion.confidence, 0, 1),
    updatedAt: new Date(),
  };
}
