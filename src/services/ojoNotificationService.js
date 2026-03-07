/**
 * Ojo Notification Service
 *
 * Generates personalized notification content using the Ojo personality system.
 * The Ojo types provide different tones and personas for notifications:
 * - mentorjo: A wise mentor (thoughtful, professional, supportive)
 * - brojo: Your bro/friend (friendly, motivating, funny)
 * - bestojo: A supportive best friend (warm, caring, positive)
 * - strictojo: A no-nonsense mentor (firm, focused, honest)
 *
 * When smart reminders are ON:
 *   - Ojo type is automatically selected based on ML prediction score
 *   - Higher urgency = stricter Ojo
 *
 * When smart reminders are OFF:
 *   - User can enable Ojo notifications manually
 *   - User selects which Ojo type to use
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";
import OjoType from "../models/OjoType.js";

// Ojo type definitions for notification generation
const OJO_DEFINITIONS = {
  mentorjo: {
    name: "mentorjo",
    displayName: "Mentorjo",
    persona: "A wise mentor who helps you think long-term and grow.",
    tones: ["thoughtful", "professional", "supportive"],
    style: "Speak like a mentor guiding a student. Be encouraging but insightful. Use wisdom and experience.",
  },
  brojo: {
    name: "brojo",
    displayName: "Brojo",
    persona: "Your bro, a friend who's always got your back.",
    tones: ["friendly", "motivating", "funny"],
    style: "Speak like a supportive friend. Be casual, use humor, be encouraging. Keep it light but genuine.",
  },
  bestojo: {
    name: "bestojo",
    displayName: "Bestojo",
    persona: "A supportive best friend who listens and encourages you.",
    tones: ["warm", "caring", "positive"],
    style: "Speak like a caring best friend. Be warm, empathetic, and genuinely supportive. Show you care.",
  },
  strictojo: {
    name: "strictojo",
    displayName: "StrictOjo",
    persona: "A no-nonsense mentor who holds you accountable and expects results.",
    tones: ["firm", "focused", "honest"],
    style: "Speak firmly and directly. No sugar-coating. Focus on accountability and results. Be honest.",
  },
};

/**
 * Map ML prediction category to Ojo type
 * Higher category = slower completion expected = need stricter Ojo
 *
 * @param {number} predictionCategory - ML prediction category (1-5)
 * @param {string} urgency - Urgency level from timing calculation
 * @returns {string} Ojo type name
 */
export function mapPredictionToOjoType(predictionCategory, urgency) {
  // Combine prediction and urgency for Ojo selection
  // Category 1-2: Easy tasks, use friendly Ojo
  // Category 3: Moderate, use mentor
  // Category 4-5: Difficult, use strict or best friend depending on urgency

  if (urgency === "critical") {
    return "strictojo"; // Critical urgency = strict accountability
  }

  switch (predictionCategory) {
    case 1:
      return "bestojo"; // Easy task = warm encouragement
    case 2:
      return "brojo"; // Quick task = friendly motivation
    case 3:
      return "mentorjo"; // Moderate = wise guidance
    case 4:
      return "strictojo"; // Slow = need accountability
    case 5:
      return "strictojo"; // Very slow = strict push
    default:
      return "mentorjo"; // Default to mentor
  }
}

/**
 * Build the system prompt for Ojo notification generation
 *
 * @param {Object} ojoType - Ojo type definition
 * @returns {string} System prompt for notification generation
 */
function buildOjoNotificationPrompt(ojoType) {
  return `You are ${ojoType.displayName}, ${ojoType.persona}

PERSONALITY: ${ojoType.tones.join(", ")}
STYLE: ${ojoType.style}

Generate a push notification. Keep it SHORT.

RESPOND WITH EXACTLY 2 LINES:
TITLE: (your title here, max 40 chars)
BODY: (your message here, max 80 chars)

Example:
TITLE: Let's Go! 💪
BODY: Time to crush that task!`;
}

/**
 * Build context about the task/subtask for the LLM
 *
 * @param {Object} task - Task document
 * @param {Object} subtask - Subtask info (optional)
 * @param {Object} timing - Timing information
 * @param {string} source - 'schedule' or 'dueDate'
 * @returns {string} Context string
 */
function buildTaskContext(task, subtask, timing, source) {
  const parts = [];

  parts.push(`Task: "${task.taskname}"`);

  if (task.description) {
    parts.push(`Description: ${task.description}`);
  }

  if (subtask) {
    parts.push(`Subtask: "${subtask.title || `Part ${subtask.index}`}"`);
    if (subtask.description) {
      parts.push(`Subtask details: ${subtask.description}`);
    }
  }

  if (task.category) {
    parts.push(`Category: ${task.category}`);
  }

  if (task.importance) {
    const importanceLabels = { 1: "Low", 2: "Low-Medium", 3: "Medium", 4: "High", 5: "Critical" };
    parts.push(`Importance: ${importanceLabels[task.importance] || task.importance}`);
  }

  if (timing?.minutesBefore) {
    const timeStr =
      timing.minutesBefore >= 60
        ? `${Math.floor(timing.minutesBefore / 60)} hours ${timing.minutesBefore % 60} minutes`
        : `${timing.minutesBefore} minutes`;
    const actionStr = source === "schedule" ? "scheduled" : "due";
    parts.push(`Time: ${actionStr} in ${timeStr}`);
  }

  if (timing?.urgency) {
    parts.push(`Urgency: ${timing.urgency}`);
  }

  return parts.join("\n");
}

/**
 * Generate an Ojo-styled notification using the LLM
 *
 * @param {string} ojoTypeName - Name of the Ojo type (mentorjo, brojo, etc.)
 * @param {Object} task - Task document
 * @param {Object} options - Additional options
 * @param {Object} options.subtask - Subtask info (optional)
 * @param {Object} options.timing - Timing information
 * @param {string} options.source - 'schedule' or 'dueDate'
 * @param {string} options.userName - User's name for personalization
 * @returns {Promise<Object>} Generated notification { title, body }
 */
export async function generateOjoNotification(ojoTypeName, task, options = {}) {
  const { subtask, timing, source, userName } = options;

  const ojoType = OJO_DEFINITIONS[ojoTypeName] || OJO_DEFINITIONS.mentorjo;

  try {
    // Use LangChain ChatGoogleGenerativeAI - same as chat (AgentController)
    const notificationModel = config.geminiModel || "gemini-3.0-flash";
    const llm = new ChatGoogleGenerativeAI({
      model: notificationModel,
      apiKey: config.geminiApiKey,
      temperature: 0.7, // Slightly higher than chat (0.2) for varied notifications
      maxOutputTokens: 768, // Same as chat
    });

    const systemPrompt = buildOjoNotificationPrompt(ojoType);
    const taskContext = buildTaskContext(task, subtask, timing, source);

    let userPrompt = `Generate a notification for this task:\n\n${taskContext}`;
    if (userName) {
      userPrompt += `\n\nUser's name: ${userName}`;
    }

    // Log prompt length
    const promptLength = (systemPrompt + "\n\n" + userPrompt).length;
    logger.info(`🤖 Ojo prompt length: ${promptLength} chars, model: ${notificationModel}`);

    // Use LangChain message format
    const messages = [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)];

    const response = await llm.invoke(messages);

    // Extract the text response
    const textContent = response?.content;

    if (!textContent) {
      throw new Error("No text content in response");
    }

    // Log raw AI response for debugging
    logger.info(`🤖 Ojo AI raw response (${ojoTypeName}): ${textContent}`);

    // Parse the response - expect "TITLE: ...\nBODY: ..." format
    let title = "";
    let body = "";

    // Try to extract TITLE: and BODY: lines
    const titleMatch = textContent.match(/TITLE:\s*(.+)/i);
    const bodyMatch = textContent.match(/BODY:\s*(.+)/i);

    if (titleMatch && bodyMatch) {
      title = titleMatch[1].trim();
      body = bodyMatch[1].trim();
    } else {
      // Fallback: try JSON parsing
      const cleanedText = textContent
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const notification = JSON.parse(jsonMatch[0]);
        title = notification.title;
        body = notification.body;
      }
    }

    if (!title || !body) {
      throw new Error("Could not parse title/body from response");
    }

    // Add Ojo branding
    const ojoEmoji = getOjoEmoji(ojoTypeName);

    logger.info(`✅ Ojo AI SUCCESS (${ojoTypeName}): Generated notification for task "${task.taskname}" - "${title}"`);

    return {
      title: `${ojoEmoji} ${title}`,
      body: body,
      ojoType: ojoTypeName,
      generated: true,
    };
  } catch (error) {
    logger.warn(`❌ Ojo AI FAILED (${ojoTypeName}): ${error.message} - Using fallback template for "${task.taskname}"`);
    // Fall back to default notification format
    return getFallbackNotification(ojoTypeName, task, subtask, timing, source);
  }
}

/**
 * Get emoji for Ojo type
 * @param {string} ojoTypeName
 * @returns {string} Emoji
 */
function getOjoEmoji(ojoTypeName) {
  const emojis = {
    mentorjo: "🧙",
    brojo: "💪",
    bestojo: "💖",
    strictojo: "⚡",
  };
  return emojis[ojoTypeName] || "✨";
}

/**
 * Get a fallback notification if LLM generation fails
 * Uses personality-appropriate templates
 */
function getFallbackNotification(ojoTypeName, task, subtask, timing, source) {
  const timeStr =
    timing?.minutesBefore >= 60
      ? `${Math.floor(timing.minutesBefore / 60)}h ${timing.minutesBefore % 60}m`
      : `${timing.minutesBefore || 60}m`;

  const actionStr = source === "schedule" ? "scheduled" : "due";
  const taskName = task.taskname;
  const subtaskName = subtask?.title || (subtask?.index ? `Part ${subtask.index}` : null);
  const itemName = subtaskName ? `${taskName} - ${subtaskName}` : taskName;

  const templates = {
    mentorjo: {
      title: "🧙 Time for Progress",
      body: `Remember, every step counts. "${itemName}" is ${actionStr} in ${timeStr}.`,
    },
    brojo: {
      title: "💪 Let's Go!",
      body: `Hey! "${itemName}" is coming up in ${timeStr}. You got this!`,
    },
    bestojo: {
      title: "💖 Gentle Reminder",
      body: `Just checking in! "${itemName}" is ${actionStr} in ${timeStr}. I believe in you!`,
    },
    strictojo: {
      title: "⚡ Action Required",
      body: `"${itemName}" - ${timeStr} until ${actionStr}. No excuses. Get it done.`,
    },
  };

  const template = templates[ojoTypeName] || templates.mentorjo;

  return {
    ...template,
    ojoType: ojoTypeName,
    generated: false,
  };
}

/**
 * Resolve the user's chat Ojo type from their profile.ojoTypeId
 * @param {Object} user - User document (must have profile.ojoTypeId)
 * @returns {Promise<string>} Ojo type name (defaults to "mentorjo")
 */
async function resolveChatOjoType(user) {
  try {
    const ojoTypeId = user.profile?.ojoTypeId;
    if (!ojoTypeId) return "mentorjo";
    const ojoDoc = await OjoType.findById(ojoTypeId).lean();
    return ojoDoc?.name || "mentorjo";
  } catch (error) {
    logger.warn("Failed to resolve chat Ojo type:", error.message);
    return "mentorjo";
  }
}

/**
 * Determine which Ojo type to use for a notification
 *
 * @param {Object} user - User document
 * @param {Object} timing - Timing info with prediction data
 * @returns {Promise<Object>} { useOjo: boolean, ojoType: string|null, source: string }
 */
export async function determineOjoTypeForNotification(user, timing) {
  const prefs = user.pushNotifications;
  const ojoEnabled = prefs?.ojoNotifications?.enabled === true;

  // If Ojo toggle is OFF, always use fixed notifications
  if (!ojoEnabled) {
    return {
      useOjo: false,
      ojoType: null,
      source: "disabled",
    };
  }

  // Ojo is enabled - determine which type to use based on selectedOjoType
  const selectedOjoType = prefs?.ojoNotifications?.selectedOjoType;

  // "auto" = use ML prediction to pick the Ojo type (decoupled from Smart Reminders timing)
  if (!selectedOjoType || selectedOjoType === "auto") {
    const predictionCategory = timing?.predictionCategory || 3;
    const urgency = timing?.urgency || "normal";
    return {
      useOjo: true,
      ojoType: mapPredictionToOjoType(predictionCategory, urgency),
      source: selectedOjoType === "auto" ? "auto_prediction" : "default_prediction",
    };
  }

  // "chat" = use the same Ojo type as the user's chat personality
  if (selectedOjoType === "chat") {
    const chatOjoType = await resolveChatOjoType(user);
    return {
      useOjo: true,
      ojoType: chatOjoType,
      source: "chat_synced",
    };
  }

  // Specific Ojo type selected by the user
  return {
    useOjo: true,
    ojoType: selectedOjoType,
    source: "user_selected",
  };
}

/**
 * Get all available Ojo types for user selection
 * @returns {Array} Array of Ojo type options
 */
export function getOjoTypeOptions() {
  return Object.values(OJO_DEFINITIONS).map((ojo) => ({
    name: ojo.name,
    displayName: ojo.displayName,
    persona: ojo.persona,
    tones: ojo.tones,
  }));
}
