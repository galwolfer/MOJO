export function canonicalizeGender(input?: string | null): string | undefined {
  if (input === undefined || input === null) return undefined;
  const s = String(input).toLowerCase().trim();
  const map: Record<string, string> = {
    female: "female",
    woman: "female",
    male: "male",
    man: "male",
    "non-binary": "nonbinary",
    "non binary": "nonbinary",
    non_binary: "nonbinary",
    nonbinary: "nonbinary",
    "prefer not to say": "prefer_not_to_say",
    prefer_not_to_say: "prefer_not_to_say",
    prefernottosay: "prefer_not_to_say",
    other: "other",
    unspecified: "unspecified",
  };
  if (map[s]) return map[s];
  const alpha = s.replace(/[^a-z]/g, "");
  if (alpha === "nonbinary") return "nonbinary";
  if (alpha === "prefernottosay") return "prefer_not_to_say";
  return undefined;
}
