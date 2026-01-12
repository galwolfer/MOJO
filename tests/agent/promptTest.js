import { buildSystemPromptWithUserContext } from "../../src/agent/agentConfig.js";

// Mock user profile with priorities
const userProfile = {
  name: "Test User",
  priorities: {
    study_and_education: 5,
    work_and_career: 4,
    workout: 2,
    hobbies: 3,
  },
  subCategories: [],
};

const userId = "test-user-123";

const prompt = buildSystemPromptWithUserContext(userProfile, userId, "", { isFirstTurn: true });

// Check that priorities are in the prompt
const userProfileWithGender = { ...userProfile, profile: { gender: "female" } };
const promptWithGender = buildSystemPromptWithUserContext(userProfileWithGender, userId, "", {
  isFirstTurn: true,
});

if (prompt.includes("USER CATEGORY PRIORITIES")) {
  console.log("✅ Category priorities are in the system prompt");
} else {
  console.error("❌ Category priorities NOT found in system prompt");
  process.exit(1);
}

if (prompt.includes("study_and_education: 5")) {
  console.log("✅ study_and_education priority (5) is shown");
} else {
  console.error("❌ study_and_education priority NOT found");
  process.exit(1);
}

if (prompt.includes("CRITICAL: Do NOT provide 'importance' parameter when creating tasks in these categories")) {
  console.log("✅ Warning to NOT provide importance is present");
} else {
  console.error("❌ Warning NOT found in prompt");
  process.exit(1);
}

// Pronoun checks
if (prompt.includes("PRONOUNS: Default pronouns: he/his.")) {
  console.log("✅ Default pronoun instruction is present");
} else {
  console.error("❌ Default pronoun instruction NOT found in prompt");
  process.exit(1);
}

if (promptWithGender.includes("PRONOUNS: Use she/her pronouns when referring to the user.")) {
  console.log("✅ Female pronoun instruction correctly injected");
} else {
  console.error("❌ Female pronoun instruction NOT found in promptWithGender");
  process.exit(1);
}

console.log("\n✅ All checks passed!");
console.log("\n--- Relevant prompt section ---");
const lines = prompt.split("\n");
const startIdx = lines.findIndex((l) => l.includes("USER CATEGORY PRIORITIES"));
if (startIdx !== -1) {
  console.log(lines.slice(startIdx, startIdx + 7).join("\n"));
}
