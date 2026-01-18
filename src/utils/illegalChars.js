/*
 * Utility for detecting and sanitizing display-illegal characters.
 * Currently blocks "<" and ">" from user-visible strings.
 */

export const ILLEGAL_DISPLAY_CHARS_REGEX = /[<>]/;

export function hasIllegalDisplayChars(value) {
  return typeof value === "string" && ILLEGAL_DISPLAY_CHARS_REGEX.test(value);
}

export function getIllegalDisplayFields(fields) {
  if (!fields || typeof fields !== "object") return [];
  const illegal = [];
  for (const [field, value] of Object.entries(fields)) {
    if (hasIllegalDisplayChars(value)) {
      illegal.push(field);
    }
  }
  return illegal;
}

export function getIllegalCharsErrorMessage(fields) {
  const list = fields.join(", ");
  return `Illegal characters in ${list}. Remove angle brackets from these fields.`;
}

export function sanitizeDisplayStringsDeep(value) {
  if (typeof value === "string") {
    return value.replace(ILLEGAL_DISPLAY_CHARS_REGEX, "");
  }
  if (value instanceof Date) return value;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDisplayStringsDeep(item));
  }
  if (value && typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value;
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = sanitizeDisplayStringsDeep(val);
    }
    return out;
  }
  return value;
}
