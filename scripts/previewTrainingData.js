// scripts/previewTrainingData.js
// Quick utility to inspect a generated training export JSON.

import fs from "fs/promises";
import path from "path";

async function main() {
  const fileArg = process.argv[2];
  if (!fileArg) {
    console.error("Usage: node scripts/previewTrainingData.js <path-to-training-json>");
    process.exit(1);
  }

  const resolved = path.resolve(fileArg);
  const raw = await fs.readFile(resolved, "utf8");
  // Parse the exported dataset so we can inspect structure quickly
  const rows = JSON.parse(raw);

  console.log(`Loaded ${rows.length} rows from ${resolved}`);
  if (!rows.length) return;

  console.log("Keys:", Object.keys(rows[0]));
  console.log("First row:\n", JSON.stringify(rows[0], null, 2));
}

main().catch((err) => {
  console.error("Failed to preview file:", err);
  process.exit(1);
});
