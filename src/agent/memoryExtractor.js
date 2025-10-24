/**
 * Memory Extractor - Extracts important information from conversations
 * (English translation of previous Hebrew comment)
 */

import { memoryStore } from "./mongoMemoryStore.js";
import { GeminiAdapter } from "./geminiAdapter.js";
import { env } from "../config/env.js";

// Initialize Gemini adapter for memory extraction
const gemini = new GeminiAdapter(env.GEMINI_API_KEY);

/**
 * Use LLM to intelligently extract memorable facts from a message
 * (Uses the LLM to intelligently extract important facts)
 *
 * @param {string} userId - User ID
 * @param {string} message - User message
 * @param {Array} existingMemories - Array of existing primary memories to check for duplicates
 * @returns {Promise<Array>} Array of extracted facts (short, concise)
 */
async function extractFactsWithLLM(userId, message, existingMemories = []) {
  try {
    const existingFactsText =
      existingMemories.length > 0
        ? `\nExisting memories:\n${existingMemories.map((m) => `- ${m.text || m.content}`).join("\n")}`
        : "\nNo existing memories.";

    const prompt = `You are an assistant that identifies important facts about the user that should be remembered.

User's message: "${message}"
${existingFactsText}

Task:
1. Identify NEW and important facts about the user (name, age, work, education, location, preferences, etc.)
2. DO NOT save facts that already exist in the memories above
3. Write each fact concisely (2-5 words) in the SAME LANGUAGE as the user's message
4. If there's no new information to remember - return an empty list

Response format (JSON):
{
  "facts": [
    {"text": "studies at Bar Ilan University", "category": "education"},
    {"text": "lives in Tel Aviv", "category": "location"}
  ]
}

Available categories: education, work, location, age, name, preference, skill, other

If there's nothing new to remember, return:
{"facts": []}`;

    const messages = [{ role: "user", content: prompt }];

    const response = await gemini.generateContent(messages);
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";

    console.log(`🔍 LLM memory extraction response: ${text.substring(0, 200)}...`);

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log("❌ LLM didn't return valid JSON for memory extraction");
      console.log("Full response:", text);
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);
    console.log(`📝 Parsed facts:`, parsed.facts);
    return parsed.facts || [];
  } catch (error) {
    console.error("Error extracting facts with LLM:", error);
    return [];
  }
}

/**
 * Extract important facts from a conversation message
 * (Identifies important information in a message and decides whether to save it as a memory)
 *
 * @param {string} userId - User ID
 * @param {string} sessionId - Session ID
 * @param {string} message - Message content
 * @param {string} role - Message role (user/assistant)
 * @returns {Promise<Array>} Array of extracted memories
 */
export async function extractMemoriesFromMessage(userId, sessionId, message, role = "user") {
  const extractedMemories = [];

  console.log(`🎯 extractMemoriesFromMessage called with role="${role}", message="${message.substring(0, 50)}..."`);

  // Skip if message is too short
  if (!message || message.length < 10) {
    console.log(`⏭️ Message too short (${message?.length || 0} chars), skipping`);
    return extractedMemories;
  }

  try {
    // === PRIMARY MEMORY EXTRACTION ===
    // ONLY extract from USER messages, not assistant responses!
    if (role === "user") {
      console.log(`🔍 Extracting memories from user message: "${message.substring(0, 100)}..."`);

      // Get ALL existing primary memories to check for duplicates
      const existingPrimaryMemories = await memoryStore.getMemories(userId, "primary", 50);
      console.log(`📚 Found ${existingPrimaryMemories.length} existing primary memories`);

      // Use LLM to intelligently extract facts
      const facts = await extractFactsWithLLM(userId, message, existingPrimaryMemories);

      if (facts.length > 0) {
        console.log(`🧠 LLM extracted ${facts.length} new facts from message`);

        for (const fact of facts) {
          const category = fact.category || "other";

          // Map LLM categories to valid primary memory types
          let type = "user_fact"; // default
          if (category === "preference") {
            type = "preference";
          } else if (category === "name" || category === "age" || category === "location") {
            type = "profile";
          } else {
            // education, work, skill, other -> all go to user_fact
            type = "user_fact";
          }

          const importance = category === "name" ? 10 : category === "education" || category === "work" ? 9 : 7;

          await memoryStore.savePrimaryMemory(
            userId,
            fact.text, // Concise fact (not full sentence!)
            type, // Use mapped type instead of category!
            importance,
            { source: "llm_extract", sessionId, category } // Save original category in metadata
          );

          extractedMemories.push({ type: category, text: fact.text });
          console.log(
            `✅ Saved fact: "${fact.text}" (category: ${category}, type: ${type}, importance: ${importance})`
          );
        }
      } else {
        console.log(`ℹ️ No new facts extracted from message`);
      }
    }

    // === CONVERSATION MEMORY PATTERNS ===
    // Keep simple pattern matching for tasks and questions

    // Tasks mentioned - English + Hebrew (pattern matching)
    const taskPatterns = [
      /(?:remind me to|I need to|I have to|I must|I should) (.+)/,
      /(?:אני|אנ(?:'|י)) (?:צריך|צריכה|חייב|חייבת) (?:ל)?(.+)/u,
      /(?:תזכיר|תזכור|להזכיר) לי (.+)/u,
    ];

    for (const pattern of taskPatterns) {
      const match = message.match(pattern);
      if (match) {
        // Extract just the task (captured group)
        const taskText = match[1].trim();
        await memoryStore.saveConversationMemory(userId, taskText, "task", 7, { sessionId, source: "pattern_extract" });
        extractedMemories.push({ type: "task", text: taskText });
        break; // Only save once per message
      }
    }

    // DON'T save questions - they're not memories!
    // Questions are for context only and shouldn't be stored
  } catch (error) {
    console.error("Error extracting memories:", error);
  }

  if (extractedMemories.length > 0) {
    console.log(`✅ Extracted ${extractedMemories.length} memories from message`);
  }

  return extractedMemories;
}

/**n * Summarize a conversation and save as memory
 * (Creates a short summary of the conversation and stores it as a conversation memory)
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
 * (Advanced analysis of messages to extract memories)
 *
 * @param {string} userId - User ID
 * @param {string} sessionId - Session ID
 * @param {string} userMessage - User message
 * @param {string} assistantResponse - Assistant response (optional)
 * @returns {Promise<void>}
 */
export async function analyzeAndExtractMemories(userId, sessionId, userMessage, assistantResponse = null) {
  try {
    console.log(`📝 analyzeAndExtractMemories called for user ${userId}, session ${sessionId}`);
    console.log(`   User message: "${userMessage.substring(0, 100)}..."`);

    // Extract from user message
    await extractMemoriesFromMessage(userId, sessionId, userMessage, "user");

    // Extract from assistant response if provided
    if (assistantResponse) {
      await extractMemoriesFromMessage(userId, sessionId, assistantResponse, "assistant");
    }

    console.log(`✅ Memory analysis complete for session ${sessionId}`);
  } catch (error) {
    console.error("❌ Error analyzing and extracting memories:", error);
    console.error("Stack:", error.stack);
  }
}

export default {
  extractMemoriesFromMessage,
  summarizeConversation,
  analyzeAndExtractMemories,
};
