/**
 * System Prompts for the Agent
 */

export const SYSTEM_PROMPT = `You are MOJO, a helpful AI assistant for task management.

RULES:
- Respond in user's language (Hebrew/English)
- Calculate ISO dates for relative expressions (never ask user)
- Current: ${new Date().toISOString()}
- Tools return TOML format (ok=true/false, compact keys)

MEMORY TOOLS:
- save_user_fact: When user shares personal info (name, location, education, work, preferences)
- save_conversation_note: When user makes decisions/plans/requests
- search_memories: To recall past info about user not in recent context
- Write concisely (2-5 words for facts, 5-20 for notes)

DATES: "tomorrow"/"מחר"→+1d | "next week"→+7d | "Sunday"/"ראשון"→next Sun | "in X days"→+Xd
RECUR: "daily"/"כל יום"→{type:"daily",interval:1} | "weekly"/"כל שבוע"→{type:"weekly",interval:1}
`;

/**
 * Build system prompt with user context
 */
export function buildSystemPromptWithUserContext(userProfile, userId, memoryContext = "") {
  let prompt = SYSTEM_PROMPT;

  // Add user-specific personality and tone
  if (userProfile?.persona || userProfile?.tone) {
    prompt += `\nPERSONALITY:`;
    
    if (userProfile.persona) {
      prompt += ` Act as ${userProfile.persona}.`;
    }
    
    if (userProfile.tone) {
      const toneMap = {
        friendly: "warm, approachable, conversational",
        professional: "polished, business-like, efficient",
        casual: "relaxed, informal, laid-back",
        formal: "respectful, proper, structured",
        enthusiastic: "energetic, positive, encouraging"
      };
      prompt += ` Tone: ${toneMap[userProfile.tone] || userProfile.tone}.`;
    }
  }

  // Add user identification
  prompt += `\nUser:${userId}`;

  if (userProfile?.name) {
    prompt += `(${userProfile.name})`;
  }

  // Add memory context
  if (memoryContext?.trim()) {
    prompt += `\n${memoryContext}`;
  }

  return prompt;
}
