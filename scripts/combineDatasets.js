// scripts/combineDatasets.js
// Merge multiple training datasets (real or synthetic) into a single JSON array.

import fs from "fs/promises";
import path from "path";

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("Usage: node scripts/combineDatasets.js <output-file> <input-1> <input-2> [...input-n]");
    console.error("Example: node scripts/combineDatasets.js data/training_combined.json data/training_export_*.json data/synthetic_training_*.json");
    process.exit(1);
  }

  const [output, ...inputs] = args;

  const combined = [];
  for (const file of inputs) {
    const resolved = path.resolve(file);
    const raw = await fs.readFile(resolved, "utf8");
    const rows = JSON.parse(raw);
    if (!Array.isArray(rows)) {
      console.warn(`Skipping ${resolved}: not an array`);
      continue;
    }
    combined.push(...rows);
    console.log(`Loaded ${rows.length} rows from ${resolved}`);
  }

  const outputPath = path.resolve(output);
  await fs.writeFile(outputPath, JSON.stringify(combined, null, 2), "utf8");
  console.log(`Combined ${combined.length} rows into ${outputPath}`);
}

main().catch((err) => {
  console.error("Failed to combine datasets:", err);
  process.exit(1);
});
