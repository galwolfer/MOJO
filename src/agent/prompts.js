/**
 * System Prompts for the Agent
 */

export const SYSTEM_PROMPT = `You are a smart and helpful AI assistant named MOJO.

You can assist users with:
- Task management (adding, viewing, updating)
- Creating notes
- Providing information about time and date
- General answers to questions

Always be kind, helpful, and accurate in your responses.
If you are unsure about something, say so honestly.

When a user requests an action, use the tools available to you.
IMPORTANT: Always respond in the same language the user is using. If the user writes in Hebrew, respond in Hebrew. If they write in English, respond in English.`;

/**
 * Build a personalized system prompt with user context and memories
 * @param {Object} userProfile - The user's profile information
 * @param {string} userId - The user's ID
 * @param {string} memoryContext - Formatted memory context (optional)
 * @returns {string} The personalized system prompt
 */
export function buildSystemPromptWithUserContext(userProfile, userId, memoryContext = "") {
  let userContext = `\n\n=== USER CONTEXT ===`;

  if (userProfile?.name) {
    userContext += `\nUser's Name: ${userProfile.name}`;
    userContext += `\n- Address the user by their name when appropriate`;
  }

  if (userProfile?.tone) {
    userContext += `\n\nCommunication Style: ${userProfile.tone}`;
    userContext += `\n- Adjust your tone to match the user's preference (${userProfile.tone})`;
  }

  if (userProfile?.persona) {
    userContext += `\n\nYour Persona: ${userProfile.persona}`;
    userContext += `\n- Act according to this persona in your responses`;
  }

  // Add any custom settings
  const settingsObj = userProfile?.settings;
  if (settingsObj) {
    let settingsEntries = [];

    // Handle Mongoose Map
    if (settingsObj instanceof Map) {
      settingsEntries = Array.from(settingsObj.entries());
    }
    // Handle plain object
    else if (typeof settingsObj === "object") {
      settingsEntries = Object.entries(settingsObj).filter(([key]) => !key.startsWith("$"));
    }

    if (settingsEntries.length > 0) {
      userContext += `\n\nAdditional User Preferences:`;
      for (const [key, value] of settingsEntries) {
        userContext += `\n- ${key}: ${value}`;
      }
    }
  }

  userContext += `\n\nIMPORTANT: When you need to perform actions for the user (like adding tasks, creating notes, etc.), use this userId: ${userId}`;
  userContext += `\n===================\n`;

  // Add semantic memory context if provided
  let fullPrompt = SYSTEM_PROMPT + userContext;

  if (memoryContext && memoryContext.trim().length > 0) {
    fullPrompt += `\n${memoryContext}`;
    fullPrompt += `\n\nUse the above information about the user and past conversations to provide more personalized and contextual responses.\n`;
  }

  return fullPrompt;
}

export const USER_GREETING = `Hello! I am MOJO, your digital assistant.
How can I assist you today?`;

export const ERROR_MESSAGE = `Sorry, I encountered an issue. Please try again.`;
