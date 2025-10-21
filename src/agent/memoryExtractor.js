/**
 * Memory Extractor - Extracts important information from conversations
 * מפיק זיכרונות חשובים מהשיחות באופן אוטומטי
 */

import { memoryStore } from "./mongoMemoryStore.js";

/**
 * Extract important facts from a conversation message
 * מזהה מידע חשוב בהודעה ומחליט אם לשמור כזיכרון
 *
 * @param {string} userId - User ID
 * @param {string} sessionId - Session ID
 * @param {string} message - Message content
 * @param {string} role - Message role (user/assistant)
 * @returns {Promise<Array>} Array of extracted memories
 */
export async function extractMemoriesFromMessage(userId, sessionId, message, role = "user") {
  const extractedMemories = [];

  // Skip if message is too short
  if (!message || message.length < 10) {
    return extractedMemories;
  }

  try {
    // === PRIMARY MEMORY PATTERNS (זיכרון ראשי) ===
    // ONLY extract from USER messages, not assistant responses!

    // 1. User preferences (העדפות) - English + Hebrew
    const preferencePatterns = [
      /(?:I|i) (?:prefer|like|love|enjoy|want) (.+)/,
      /(?:My|my) (?:favorite|preferred) (.+) is (.+)/,
      /(?:I|i) (?:don't like|hate|dislike) (.+)/,
      /(?:I|i) (?:always|usually|often|never) (.+)/,
      /(?:אני|אנ(?:'|י)) (?:אוהב|אוהבת|מעדיף|מעדיפה|רוצה) (.+)/u,
      /(?:ה|ה(?:־))(?:מועדף|מועדפת|אהוב|אהובה) (?:שלי|עלי) (?:הוא|היא|זה) (.+)/u,
    ];

    // ONLY extract preferences from USER messages
    if (role === "user") {
      for (const pattern of preferencePatterns) {
        const match = message.match(pattern);
        if (match) {
          await memoryStore.savePrimaryMemory(userId, match[0], "preference", 7, { source: "auto_extract", sessionId });
          extractedMemories.push({ type: "preference", text: match[0] });
        }
      }
    }

    // 2. User facts (עובדות על המשתמש) - English + Hebrew
    const factPatterns = [
      /(?:My|my) name is (.+)/,
      /(?:I|i) (?:am|work as|study|am studying) (.+)/,
      /(?:I|i) (?:live|reside) in (.+)/,
      /(?:I|i) was born in (.+)/,
      /(?:I|i) speak (.+)/,
      /(?:My|my) (?:birthday|age) is (.+)/,
      /(?:I|i)'m a (.+)/,
      /(?:I|i)'m (?:from|currently in) (.+)/,
      // Hebrew patterns
      /(?:אני|אנ(?:'|י)|שמי) (.+)/u,
      /(?:אני|אנ(?:'|י)) (?:לומד|לומדת|עובד|עובדת|גר|גרה) (.+)/u,
      /(?:אני|אנ(?:'|י)) (?:סטודנט|סטודנטית|תלמיד|תלמידה) (.+)/u,
      /(?:אני|אנ(?:'|י)) (?:ב|באוניברסיטת|במכללת|בטכניון|ב(?:־))(.+)/u,
      /(?:מ|מה)(?:אוניברסיטה|מכללה|בי(?:")?ס) (.+)/u,
    ];

    // ONLY extract user facts from USER messages
    if (role === "user") {
      console.log(`🔍 Checking for user facts in message: ${message.substring(0, 50)}...`);
      for (const pattern of factPatterns) {
        const match = message.match(pattern);
        if (match) {
          console.log(`✅ Found user fact match: ${match[0]}`);
          await memoryStore.savePrimaryMemory(
            userId,
            match[0],
            "user_fact",
            9, // Higher importance for facts
            { source: "auto_extract", sessionId }
          );
          extractedMemories.push({ type: "user_fact", text: match[0] });
        }
      }
    }

    // === CONVERSATION MEMORY PATTERNS (זיכרון שיחות) ===

    // 3. Tasks mentioned - English + Hebrew
    const taskPatterns = [
      /(?:remind me to|I need to|I have to|I must|I should) (.+)/,
      /(?:task|todo|assignment)(?::|\s)(.+)/i,
      /(?:אני|אנ(?:'|י)) (?:צריך|צריכה|חייב|חייבת|מוכרח|מוכרחה) (.+)/u,
      /(?:תזכיר|תזכור|להזכיר) לי (.+)/u,
      /(?:משימה|מטלה|תרגיל|תר(?:")?ג|שיעורי בית)(?::|\s)?(.+)/iu,
    ];

    for (const pattern of taskPatterns) {
      const match = message.match(pattern);
      if (match) {
        await memoryStore.saveConversationMemory(userId, match[0], "task", 7, { sessionId, source: "auto_extract" });
        extractedMemories.push({ type: "task", text: match[0] });
      }
    }

    // 4. Important decisions or conclusions
    if (role === "assistant") {
      const decisionPatterns = [
        /(?:decided|concluded|agreed) that (.+)/,
        /(?:plan is to|will|going to) (.+)/,
        /(?:recommendation|suggestion) is (.+)/,
      ];

      for (const pattern of decisionPatterns) {
        const match = message.match(pattern);
        if (match) {
          await memoryStore.saveConversationMemory(userId, match[0], "conversation", 6, {
            sessionId,
            source: "auto_extract",
          });
          extractedMemories.push({ type: "conversation", text: match[0] });
        }
      }
    }

    // 5. Questions and answers (important context)
    if (message.includes("?") && role === "user") {
      // Save important questions
      await memoryStore.saveConversationMemory(userId, message, "conversation", 4, {
        sessionId,
        source: "auto_extract",
        tag: "question",
      });
      extractedMemories.push({ type: "conversation", text: message });
    }
  } catch (error) {
    console.error("Error extracting memories:", error);
  }

  if (extractedMemories.length > 0) {
    console.log(`✅ Extracted ${extractedMemories.length} memories from message`);
  }

  return extractedMemories;
}

/**
 * Summarize a conversation and save as memory
 * מסכם שיחה שלמה ושומר כזיכרון
 *
 * @param {string} userId - User ID
 * @param {string} sessionId - Session ID
 * @param {Array} messages - Array of messages
 * @returns {Promise<string>} Summary memory ID
 */
export async function summarizeConversation(userId, sessionId, messages) {
  try {
    if (!messages || messages.length < 5) {
      return null; // Not enough messages to summarize
    }

    // Simple summary: extract key points
    const userMessages = messages.filter((m) => m.role === "user").map((m) => m.content);
    const assistantMessages = messages.filter((m) => m.role === "assistant").map((m) => m.content);

    const summary = `Conversation summary (${messages.length} messages):
User discussed: ${userMessages.slice(0, 3).join("; ")}
Assistant helped with: ${assistantMessages.slice(0, 2).join("; ")}`;

    // Save as conversation summary
    const memoryId = await memoryStore.saveConversationMemory(userId, summary, "conversation_summary", 5, {
      sessionId,
      source: "auto_summarize",
      messageCount: messages.length,
    });

    console.log(`✅ Conversation summarized and saved`);
    return memoryId;
  } catch (error) {
    console.error("Error summarizing conversation:", error);
    return null;
  }
}

/**
 * Analyze user message and extract memories with better context
 * ניתוח מתקדם יותר של הודעות להפקת זיכרונות
 *
 * @param {string} userId - User ID
 * @param {string} sessionId - Session ID
 * @param {string} userMessage - User message
 * @param {string} assistantResponse - Assistant response (optional)
 * @returns {Promise<void>}
 */
export async function analyzeAndExtractMemories(userId, sessionId, userMessage, assistantResponse = null) {
  try {
    // Extract from user message
    await extractMemoriesFromMessage(userId, sessionId, userMessage, "user");

    // Extract from assistant response if provided
    if (assistantResponse) {
      await extractMemoriesFromMessage(userId, sessionId, assistantResponse, "assistant");
    }

    console.log(`✅ Memory analysis complete for session ${sessionId}`);
  } catch (error) {
    console.error("Error analyzing and extracting memories:", error);
  }
}

export default {
  extractMemoriesFromMessage,
  summarizeConversation,
  analyzeAndExtractMemories,
};
