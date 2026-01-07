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

// Low-value tokens that should be de-emphasized when forming labels
const LOW_VALUE = new Set(["final", "finish", "homework", "task", "project", "do", "complete", "complete", "assignment"]);

// Keep a small alias map so related terms collapse to the same canonical token.
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const normalizeToken = (token) => {
  const trimmed = token.replace(/[^a-z0-9]/g, "");
  if (!trimmed) return "";
  return trimmed.replace(/s$/i, "");
};

// Remove common leading imperative/filler phrases so labels focus on the object
const LEADING_PHRASES = [
  "go to the",
  "go to",
  "go",
  "finish",
  "do",
  "complete",
  "start",
  "attend",
  "meet",
  "call",
  "plan",
  "schedule",
  "buy",
  "order",
  "pay",
  "submit",
  "turn in",
  "read",
  "watch",
  "study",
];

const stripLeadingPhrases = (text = "") => {
  let s = String(text || "").toLowerCase().trim();
  if (!s) return "";
  // remove punctuation for matching
  s = s.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  // repeatedly strip any known leading phrase
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of LEADING_PHRASES) {
      if (s === p) {
        s = "";
        changed = true;
        break;
      }
      if (s.startsWith(p + " ")) {
        s = s.slice(p.length).trim();
        changed = true;
        break;
      }
    }
    // also remove a leading lone 'to' or 'the'
    if (!changed && (s.startsWith("to ") || s.startsWith("the "))) {
      s = s.split(/\s+/).slice(1).join(" ").trim();
      changed = true;
    }
  }
  return s;
};

// Normalize the raw title/description text into consistent tokens.
const cleanTokens = (text = "") =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map(normalizeToken)
    .filter((token) => token && token.length > 1 && !STOP_WORDS.has(token));

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
  // Prioritize non-LOW_VALUE tokens; only use LOW_VALUE if nothing else available
  const highValue = meaningful.filter((t) => !LOW_VALUE.has(t));
  const selected = highValue.length ? highValue : meaningful;
  return selected
    .slice(0, 3)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
};

// Extract n-grams (bigrams/trigrams) from token list to capture phrases
const extractNgrams = (tokens = [], n = 2) => {
  const out = [];
  for (let i = 0; i + n <= tokens.length; i++) {
    const slice = tokens.slice(i, i + n);
    // skip if any token is low-value or stop word
    if (slice.some((t) => LOW_VALUE.has(t) || STOP_WORDS.has(t))) continue;
    out.push(slice.join(" "));
  }
  return out;
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

const buildTagLabel = (categories = []) =>
  categories
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
const buildHeuristicSuggestion = (tokens = [], categories = []) => {
  const label = toLabel(tokens);
  if (label) {
    return {
      label,
      source: "heuristic",
      confidence: 0.4,
    };
  }
  const tagLabel = buildTagLabel(categories);
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
        categories: 1,
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

const scoreHistoryEntry = (entry, tokens = [], categories = []) => {
  if (!entry?.subCategory?.label) return null;
  const entryTokens = cleanTokens(`${entry.taskname || ""} ${entry.description || ""} ${entry.subCategory.label}`);
  const similarity = jaccard(tokens, entryTokens);
  const tagScore = tagOverlap(categories, entry.categories || []);
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
  categories = [],
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

  // Use title (not description) for subcategory inference per user request
  const normalizedTags = Array.isArray(categories) ? categories.map((tag) => String(tag || "").toLowerCase()) : []; 

  // Strip common leading filler/action phrases (e.g., "finish", "go to the")
  const strippedTitle = stripLeadingPhrases(String(title || ""));
  // Build initial heuristic suggestion using title tokens (description ignored)
  const titleTokens = cleanTokens(strippedTitle);
  let suggestion = buildHeuristicSuggestion(titleTokens, normalizedTags);

  // Build additional candidate labels from n-grams to capture phrases like "fold clothes"
  const candidates = new Map();
  const addCandidate = (lab, src, weight = 0.0) => {
    if (!lab) return;
    const key = String(lab).trim();
    if (!key) return;
    if (!candidates.has(key)) candidates.set(key, { label: key, sources: new Set(), base: 0 });
    const c = candidates.get(key);
    c.sources.add(src);
    c.base = Math.max(c.base, weight);
  };

  // heuristic and tag fallback candidates
  if (suggestion.label) addCandidate(suggestion.label, suggestion.source, suggestion.confidence);
  const tagLabel = buildTagLabel(normalizedTags);
  if (tagLabel) addCandidate(tagLabel, "tag-fallback", 0.25);

  // n-grams and tokens derived ONLY from the title (description intentionally ignored)
  const allTokens = titleTokens.slice();
  [2, 3].forEach((n) => {
    extractNgrams(titleTokens, n).forEach((ng) => addCandidate(toLabel(cleanTokens(ng)), `title-ngram${n}`, 0.45));
  });

  // compound candidates combining tags with title tokens (e.g., 'AI Exercises')
  const tagTokens = (normalizedTags || []).map((t) => tokenizeTag(t));
  tagTokens.forEach((tg) => {
    uniqueTokens(allTokens).forEach((t) => {
      if (!t || LOW_VALUE.has(t) || STOP_WORDS.has(t)) return;
      addCandidate(toLabel(cleanTokens(`${tg} ${t}`)), `tag-token`, 0.35);
    });
  });

  // also include single-token labels from title (de-emphasize low-value ones)
  uniqueTokens(allTokens).forEach((t) => {
    if (LOW_VALUE.has(t)) return;
    addCandidate(toLabel([t]), "token", 0.35);
  });

  const history = await fetchHistoricalSubCategories(TaskModel, userId);
  // Score candidates by combining text similarity, tag overlap, and history matches
  const scoredCandidates = [];
  for (const [k, info] of candidates.entries()) {
    const candTokens = cleanTokens(k);
    // compute similarity using title only (description excluded)
    const textSim = jaccard(titleTokens, candTokens);
    const tagSim = tagOverlap(normalizedTags, (k || "").split(/\s+/));
    // history boost: check if this label appeared in history and take its best score
    let historyBoost = 0;
    if (history.length) {
      for (const h of history) {
        if (String(h.subCategory?.label || "").toLowerCase() === String(k).toLowerCase()) {
          historyBoost = Math.max(historyBoost, 0.2);
        }
      }
    }

    // combine signals — tuned weights: textSim (0.6), tagSim (0.25), historyBoost (0.15), base from candidate
    const score = (textSim * 0.6) + (tagSim * 0.25) + (historyBoost * 0.15) + (info.base || 0);
    scoredCandidates.push({ label: k, score, sources: Array.from(info.sources) });
  }

  scoredCandidates.sort((a, b) => b.score - a.score);

  if (scoredCandidates.length) {
    const best = scoredCandidates[0];
    if (best.score >= 0.25) {
      suggestion = { label: best.label, source: best.sources.join("|"), confidence: clamp(best.score, 0.25, 0.98) };
    }
  }

  return {
    label: suggestion.label,
    source: suggestion.source,
    confidence: clamp(suggestion.confidence, 0, 1),
    updatedAt: new Date(),
  };
}
