import { buildSystemPromptWithUserContext } from "../../src/agent/agentConfig.js";

// Mock user profile with priorities
// Use profile-shaped user object (matches runtime: user.profile)
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

// Gender can come from profile.gender (runtime shape) or top-level 'gender' - test both forms
const userProfileWithGender = { ...userProfile, profile: { gender: "female" } };
const promptWithGender = buildSystemPromptWithUserContext(userProfileWithGender, userId, "", {
  isFirstTurn: true,
});

// OjoType personality injection - new in the model
const userProfileWithOjo = {
  ...userProfile,
  ojoType: {
    name: "mentorjo",
    persona: "A wise mentor who helps you think long-term and grow.",
    tone: ["Thoughtful", "Professional", "Supportive"],
  },
};
const promptWithOjo = buildSystemPromptWithUserContext(userProfileWithOjo, userId, "", {
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

// Validate personality injection for OjoType
if (promptWithOjo.includes("PERSONALITY:") && promptWithOjo.includes("Act as A wise mentor")) {
  console.log("✅ Personality section injected into prompt");
} else {
  console.error("❌ Personality injection NOT found in promptWithOjo");
  process.exit(1);
}

if (promptWithOjo.includes("Tone: thoughtful, professional, supportive.")) {
  console.log("✅ Tone string correctly injected and formatted");
} else {
  console.error("❌ Tone string NOT found or formatted incorrectly in promptWithOjo");
  process.exit(1);
}

console.log("\n✅ All checks passed!");
console.log("\n--- Relevant prompt section ---");
const lines = prompt.split("\n");
const startIdx = lines.findIndex((l) => l.includes("USER CATEGORY PRIORITIES"));
if (startIdx !== -1) {
  console.log(lines.slice(startIdx, startIdx + 7).join("\n"));
}
