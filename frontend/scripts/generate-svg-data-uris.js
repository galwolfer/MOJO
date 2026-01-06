const fs = require("fs");
const path = require("path");

// Try a few common locations for the icon source folder so the script works
// in different repo layouts (components/icons/icons-lib or assets/icons-lib).
const possibleDirs = [
  // Common icon source locations (prefers icons-lib folders)
  path.join(__dirname, "../components/icons/icons-lib"),
  path.join(__dirname, "../assets/icons-lib"),
  path.join(__dirname, "../components"),
  path.join(__dirname, "../assets"),
  path.join(__dirname, "../icons"),
];
// Prefer the first directory that actually contains .svg files; fall back to existence.
let iconsLibDir = null;
for (const p of possibleDirs) {
  if (fs.existsSync(p)) {
    try {
      const files = fs.readdirSync(p).filter((f) => f.endsWith(".svg"));
      if (files.length > 0) {
        iconsLibDir = p;
        break;
      }
      // otherwise keep looking
    } catch (e) {
      // ignore
    }
  }
}
if (!iconsLibDir) {
  // fallback to any existing dir
  iconsLibDir = possibleDirs.find((p) => fs.existsSync(p));
}
if (!iconsLibDir) {
  console.error("No icons-lib directory found. Searched:", possibleDirs.join(", "));
  process.exit(1);
}
const outputFile = path.join(__dirname, "../components/icons/svg-data-uris.ts");

const svgFiles = fs.readdirSync(iconsLibDir).filter((f) => f.endsWith(".svg"));

// CLI flags
const args = process.argv.slice(2);
const printOnly = args.includes("--print") || args.includes("--print-only");

let modifiedCount = 0;
const generatedMap = {};

svgFiles.forEach((file) => {
  const svgPath = path.join(iconsLibDir, file);
  let svgContent = fs.readFileSync(svgPath, "utf8");
  const originalContent = svgContent;

  // Strip hardcoded colors from source files for native compatibility
  // Remove stroke and fill attributes with hex colors, keeping other attributes
  svgContent = svgContent.replace(/\s+stroke="#?[A-Fa-f0-9]{6}"/g, "").replace(/\s+fill="#?[A-Fa-f0-9]{6}"/g, "");

  // Write cleaned SVG back to source file if changed
  if (svgContent !== originalContent) {
    fs.writeFileSync(svgPath, svgContent, "utf8");
    modifiedCount++;
  }

  // For web data URIs, replace with currentColor for theming
  let webSvgContent = originalContent
    .replace(/stroke="#?[A-Fa-f0-9]{6}"/g, 'stroke="currentColor"')
    .replace(/fill="#?[A-Fa-f0-9]{6}"/g, 'fill="currentColor"');

  // If SVG root uses fill="none" and there are no stroke attributes on paths,
  // assume the artwork relies on fill and switch root fill to currentColor so icons are visible.
  try {
    const rootFillNone = /<svg[^>]*fill=\"none\"/i.test(webSvgContent);
    const hasAnyStroke = /stroke=\"/i.test(webSvgContent);
    if (rootFillNone && !hasAnyStroke) {
      webSvgContent = webSvgContent.replace(/(<svg[^>]*)fill=\"none\"/i, '$1fill="currentColor"');
    }
  } catch (e) {
    // ignore safety
  }

  // Create data URI
  const encoded = Buffer.from(webSvgContent).toString("base64");
  const dataUri = `data:image/svg+xml;base64,${encoded}`;

  generatedMap[file] = dataUri;
});

// Read existing output map (if any) and merge rather than obliterate
let existingMap = {};
if (fs.existsSync(outputFile)) {
  const existingContent = fs.readFileSync(outputFile, "utf8");
  const entryRegex = /['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = entryRegex.exec(existingContent)) !== null) {
    existingMap[m[1]] = m[2];
  }
}

// Compute which entries would be new/changed
const newEntries = [];
Object.keys(generatedMap).forEach((k) => {
  if (existingMap[k] !== generatedMap[k]) newEntries.push(k);
});

if (printOnly) {
  if (newEntries.length === 0) {
    console.log("No new or changed SVG entries detected.");
    process.exit(0);
  }
  // Print only the new entries in the same TS map format so they can be inserted manually
  newEntries.forEach((file) => {
    console.log(`  '${file}': '${generatedMap[file]}',`);
  });
  process.exit(0);
}

// Merge maps (generated takes precedence) and write full file
const merged = Object.assign({}, existingMap, generatedMap);
let output = "// Auto-generated SVG data URIs for web compatibility\n";
output += "// Run: node scripts/generate-svg-data-uris.js to regenerate\n\n";
output += "export const SVG_DATA_URIS: Record<string, string> = {\n";
Object.keys(merged)
  .sort()
  .forEach((file) => {
    output += `  '${file}': '${merged[file]}',\n`;
  });
output += "};\n";

fs.writeFileSync(outputFile, output, "utf8");
console.log(`✓ Generated ${Object.keys(merged).length} SVG data URIs -> ${outputFile}`);
console.log(`✓ Cleaned ${modifiedCount} source SVG files (removed hardcoded colors)`);

// --- Ensure icons.tsx exports mappings for new files ---
const iconsTsxPath = path.join(__dirname, "../components/icons/icons.tsx");
if (fs.existsSync(iconsTsxPath)) {
  let iconsTsx = fs.readFileSync(iconsTsxPath, "utf8");

  // Extract existing ICON_FILES block
  const blockRegex = /const\s+ICON_FILES:\s*Record<[^>]+>\s*=\s*\{([\s\S]*?)\};/m;
  const m = iconsTsx.match(blockRegex);
  const existingFiles = {};
  if (m) {
    const body = m[1];
    const entryRegex = /\s*([a-zA-Z0-9_\-]+)\s*:\s*['"]([^'"]+)['"]\s*,?/g;
    let em;
    while ((em = entryRegex.exec(body)) !== null) {
      existingFiles[em[2]] = em[1];
    }
  }

  // Build desired map: keep existing keys, add missing ones using basename (no ext)
  const desiredMap = Object.assign({}, existingFiles);
  Object.keys(merged).forEach((file) => {
    if (!desiredMap[file]) {
      const name = file.replace(/\.svg$/i, "");
      // make a safe key: replace non-alphanumeric with camelCase-ish underscores
      const key = name.replace(/[^a-zA-Z0-9]+(.)/g, (_, ch) => ch.toUpperCase()).replace(/[^a-zA-Z0-9]/g, "");
      desiredMap[file] = key;
    }
  });

  // Reconstruct ICON_FILES block sorted by key
  const entries = Object.keys(desiredMap).map((file) => `  ${desiredMap[file]}: '${file}',`);
  const newBlock = `const ICON_FILES: Record<string, string> = {\n${entries.sort().join("\n")}\n};`;

  const newIconsTsx = iconsTsx.replace(blockRegex, newBlock);
  if (newIconsTsx !== iconsTsx) {
    fs.writeFileSync(iconsTsxPath, newIconsTsx, "utf8");
    console.log(`✓ Updated ICON_FILES in ${iconsTsxPath}`);
  } else {
    console.log(`No ICON_FILES changes needed in ${iconsTsxPath}`);
  }
} else {
  console.log(`icons.tsx not found at ${iconsTsxPath}; skipping ICON_FILES update.`);
}
