const fs = require("fs");
const path = require("path");

const iconsLibDir = path.join(__dirname, "../components/icons/icons-lib");
const outputFile = path.join(__dirname, "../components/icons/svg-data-uris.ts");

const svgFiles = fs.readdirSync(iconsLibDir).filter((f) => f.endsWith(".svg"));

let output = "// Auto-generated SVG data URIs for web compatibility\n";
output += "// Run: node scripts/generate-svg-data-uris.js to regenerate\n\n";
output += "export const SVG_DATA_URIS: Record<string, string> = {\n";

svgFiles.forEach((file) => {
  const svgPath = path.join(iconsLibDir, file);
  let svgContent = fs.readFileSync(svgPath, "utf8");

  // Strip hardcoded colors to allow theming
  svgContent = svgContent
    .replace(/stroke="#F2F5FF"/g, 'stroke="currentColor"')
    .replace(/fill="#F2F5FF"/g, 'fill="currentColor"')
    .replace(/stroke="#[A-Fa-f0-9]{6}"/g, 'stroke="currentColor"')
    .replace(/fill="#[A-Fa-f0-9]{6}"/g, 'fill="currentColor"');

  // Create data URI
  const encoded = Buffer.from(svgContent).toString("base64");
  const dataUri = `data:image/svg+xml;base64,${encoded}`;

  output += `  '${file}': '${dataUri}',\n`;
});

output += "};\n";

fs.writeFileSync(outputFile, output, "utf8");
console.log(`✓ Generated ${svgFiles.length} SVG data URIs -> ${outputFile}`);
