// Small helper to standardize ok=true / ok=false formatted responses
// Keeps the same string format used across missions so we don't change contracts.
export function okTrue(data = {}) {
  let parts = ["ok=true"];
  if (data.msg) parts.push(`msg="${data.msg}"`);
  if (data.id) parts.push(`id="${data.id}"`);
  if (data.count !== undefined) parts.push(`count=${data.count}`);
  return parts.join("\n");
}

export function okFalse(errCode, options = {}) {
  const parts = [`ok=false`, `err="${errCode}"`];
  if (options.msg) parts.push(`msg="${options.msg}"`);
  if (options.list) parts.push(`list="${options.list}"`);
  return parts.join("\n");
}

export function listToString(items = []) {
  if (!Array.isArray(items)) return "";
  return items.map((i) => `- ${i}`).join("\n");
}
