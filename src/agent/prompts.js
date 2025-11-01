/**
 * System Prompts for the Agent
 */

export const SYSTEM_PROMPT = `You are MOJO, a helpful AI assistant for task management.

RULES:
- Respond in user's language (Hebrew/English)
- Calculate ISO dates for relative expressions (never ask user)
- Current: ${new Date().toISOString()}

DATES: "tomorrow"/"מחר"→+1d | "next week"→+7d | "Sunday"/"ראשון"→next Sun | "in X days"→+Xd
RECUR: "daily"/"כל יום"→{type:"daily",interval:1} | "weekly"/"כל שבוע"→{type:"weekly",interval:1}
`;

/**
 * Build system prompt with user context
 */
export function buildSystemPromptWithUserContext(userProfile, userId, memoryContext = "") {
  let prompt = SYSTEM_PROMPT + `\nUser:${userId}`;

  if (userProfile?.name) {
    prompt += `(${userProfile.name})`;
  }

  if (memoryContext?.trim()) {
    prompt += `\n${memoryContext}`;
  }

  return prompt;
}

export const USER_GREETING = `Hello! I am MOJO, your digital assistant.
How can I assist you today?`;

export const ERROR_MESSAGE = `Sorry, I encountered an issue. Please try again.`;
