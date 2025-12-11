// Test keyword extraction
function normalizeTextForEmbedding(text) {
  if (!text) return "";

  let normalized = text.toLowerCase();
  normalized = normalized.replace(/[.,?!;:()[\]{}'"]/g, " ");

  const stopWords = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "has",
    "he",
    "in",
    "is",
    "it",
    "its",
    "of",
    "on",
    "that",
    "the",
    "to",
    "was",
    "will",
    "with",
    "you",
    "your",
    "do",
    "does",
    "did",
    "i",
    "me",
    "my",
    "we",
    "our",
    "where",
    "when",
    "what",
    "who",
    "how",
    "this",
    "these",
    "those",
    "can",
    "could",
    "would",
    "should",
    "may",
    "am",
    "have",
    "had",
    "remember",
    "recall",
    "know",
    "tell",
  ]);

  const words = normalized
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .filter((word) => !stopWords.has(word));

  return words.join(" ");
}

const text1 = "remember that i learn at Bar Ilan university";
const text2 = "do you remember where i learn?";

console.log("Memory:", text1);
console.log("Keywords:", normalizeTextForEmbedding(text1));
console.log();
console.log("Query:", text2);
console.log("Keywords:", normalizeTextForEmbedding(text2));
console.log();
console.log("Overlap: Both contain 'learn' ✓");
