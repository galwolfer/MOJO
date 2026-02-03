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

import { GeminiAdapter } from "../agent/geminiAdapter.js";
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

PERSONALITY:
- Tone: ${ojoType.tones.join(", ")}
- Style: ${ojoType.style}

YOUR TASK:
Generate a short, personalized push notification message for a task reminder.
The notification should motivate the user to work on their task.

RULES:
1. Keep the message under 100 characters for the title
2. Keep the body under 200 characters
3. Match your personality and tone exactly
4. Include the task context naturally
5. Make it feel personal and motivating
6. Do NOT use generic phrases like "Time to work on..."
7. Be creative and vary your messages

OUTPUT FORMAT:
Return ONLY a JSON object with "title" and "body" fields. No markdown, no explanation.
Example: {"title": "Hey! 💪", "body": "That project won't finish itself. Let's crush it together!"}`;
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
    const timeStr = timing.minutesBefore >= 60 
      ? `${Math.floor(timing.minutesBefore / 60)} hours ${timing.minutesBefore % 60} minutes`
      : `${timing.minutesBefore} minutes`;
    const actionStr = source === 'schedule' ? 'scheduled' : 'due';
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
    const gemini = new GeminiAdapter(config.geminiApiKey);
    
    const systemPrompt = buildOjoNotificationPrompt(ojoType);
    const taskContext = buildTaskContext(task, subtask, timing, source);
    
    let userPrompt = `Generate a notification for this task:\n\n${taskContext}`;
    if (userName) {
      userPrompt += `\n\nUser's name: ${userName}`;
    }
    
    const messages = [
      { role: "user", content: systemPrompt + "\n\n" + userPrompt },
    ];
    
    const response = await gemini.generateContent(messages);
    
    // Extract the text response
    const textContent = response?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!textContent) {
      throw new Error("No text content in response");
    }
    
    // Parse the JSON response
    // Remove any markdown code blocks if present
    const cleanedText = textContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const notification = JSON.parse(cleanedText);
    
    if (!notification.title || !notification.body) {
      throw new Error("Invalid notification format");
    }
    
    // Add Ojo branding
    const ojoEmoji = getOjoEmoji(ojoTypeName);
    
    return {
      title: `${ojoEmoji} ${notification.title}`,
      body: notification.body,
      ojoType: ojoTypeName,
      generated: true,
    };
  } catch (error) {
    logger.warn(`Failed to generate Ojo notification (${ojoTypeName}):`, error.message);
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
  const timeStr = timing?.minutesBefore >= 60 
    ? `${Math.floor(timing.minutesBefore / 60)}h ${timing.minutesBefore % 60}m`
    : `${timing.minutesBefore || 60}m`;
  
  const actionStr = source === 'schedule' ? 'scheduled' : 'due';
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
 * Determine which Ojo type to use for a notification
 * 
 * @param {Object} user - User document
 * @param {Object} timing - Timing info with prediction data
 * @returns {Object} { useOjo: boolean, ojoType: string|null }
 */
export function determineOjoTypeForNotification(user, timing) {
  const prefs = user.pushNotifications;
  const useSmartReminders = prefs?.taskReminders?.useSmartReminders !== false;
  
  if (useSmartReminders) {
    // Smart reminders ON: auto-select Ojo based on prediction
    const predictionCategory = timing?.predictionCategory || 3;
    const urgency = timing?.urgency || "normal";
    
    return {
      useOjo: true,
      ojoType: mapPredictionToOjoType(predictionCategory, urgency),
      source: "smart_prediction",
    };
  } else {
    // Smart reminders OFF: check if Ojo notifications are manually enabled
    const ojoEnabled = prefs?.ojoNotifications?.enabled === true;
    const selectedOjoType = prefs?.ojoNotifications?.selectedOjoType;
    
    if (ojoEnabled && selectedOjoType) {
      return {
        useOjo: true,
        ojoType: selectedOjoType,
        source: "user_selected",
      };
    }
    
    // Ojo disabled - use normal notifications
    return {
      useOjo: false,
      ojoType: null,
      source: "disabled",
    };
  }
}

/**
 * Get all available Ojo types for user selection
 * @returns {Array} Array of Ojo type options
 */
export function getOjoTypeOptions() {
  return Object.values(OJO_DEFINITIONS).map(ojo => ({
    name: ojo.name,
    displayName: ojo.displayName,
    persona: ojo.persona,
    tones: ojo.tones,
  }));
}
