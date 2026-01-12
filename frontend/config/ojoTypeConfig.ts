/**
 * File: frontend/config/ojoTypeConfig.ts
 * Purpose: OjoType definitions for frontend with colors and icons
 */
import { COLORS } from "../theme";

export type OjoTypeName = "mentorjo" | "brojo" | "bestojo" | "strictojo";

export interface OjoTypeConfig {
  name: OjoTypeName;
  displayName: string;
  emoji: string;
  persona: string;
  tones: string[];
  icon: string;
  color: string;
  backgroundColor: string;
  description: string;
  isDefault: boolean;
}

/**
 * OjoType configurations for the frontend
 * These match the backend OjoType definitions
 */
export const OJO_TYPES: Record<OjoTypeName, OjoTypeConfig> = {
  mentorjo: {
    name: "mentorjo",
    displayName: "Mentorjo",
    emoji: "🧠",
    persona: "A wise mentor who helps you think long-term and grow.",
    tones: ["Thoughtful", "Professional", "Supportive"],
    icon: "mentorjo",
    color: COLORS.primary1, // Blue #4361EE
    backgroundColor: "#E8EFFE", // Light blue background
    description: "A wise mentor who helps you think long-term and grow.",
    isDefault: true,
  },
  brojo: {
    name: "brojo",
    displayName: "Brojo",
    emoji: "😎",
    persona: "Your bro, friend who's always got your back.",
    tones: ["Friendly", "Motivating", "Funny"],
    icon: "brojo",
    color: COLORS.primary2, // Cyan #4CC9F0
    backgroundColor: "#E0F7FF", // Light cyan background
    description: "Your bro, friend who's always got your back.",
    isDefault: false,
  },
  bestojo: {
    name: "bestojo",
    displayName: "Bestojo",
    emoji: "❤️",
    persona: "A supportive best friend who listens and encourages you.",
    tones: ["Warm", "Caring", "Positive"],
    icon: "bestojo",
    color: COLORS.primary4, // Pink #F72585
    backgroundColor: "#FFE8F5", // Light pink background
    description: "A supportive best friend who listens and encourages you.",
    isDefault: false,
  },
  strictojo: {
    name: "strictojo",
    displayName: "StrictOjo",
    emoji: "💪",
    persona: "A no-nonsense mentor who holds you accountable and expects results.",
    tones: ["Firm", "Focused", "Honest"],
    icon: "strictojo",
    color: COLORS.primary7, // Red #F43E3E
    backgroundColor: "#FFE8E8", // Light red background
    description: "A no-nonsense mentor who holds you accountable and expects results.",
    isDefault: false,
  },
};

/**
 * Get OjoType config by name
 */
export function getOjoType(name: OjoTypeName): OjoTypeConfig {
  return OJO_TYPES[name] || OJO_TYPES.mentorjo;
}

/**
 * Get default OjoType
 */
export function getDefaultOjoType(): OjoTypeConfig {
  return OJO_TYPES.mentorjo;
}

/**
 * Get all OjoTypes as array
 */
export function getAllOjoTypes(): OjoTypeConfig[] {
  return Object.values(OJO_TYPES);
}

/**
 * Get OjoType color by name
 */
export function getOjoTypeColor(name: OjoTypeName | string): string {
  const ojoType = OJO_TYPES[name as OjoTypeName];
  return ojoType ? ojoType.color : COLORS.primary1;
}

/**
 * Get OjoType background color by name
 */
export function getOjoTypeBackgroundColor(name: OjoTypeName | string): string {
  const ojoType = OJO_TYPES[name as OjoTypeName];
  return ojoType ? ojoType.backgroundColor : "#E8EFFE";
}

/**
 * Get OjoType icon name by name
 */
export function getOjoTypeIcon(name: OjoTypeName | string): string {
  const ojoType = OJO_TYPES[name as OjoTypeName];
  return ojoType ? ojoType.icon : "mentorjo";
}

/**
 * Get OjoType emoji by name
 */
export function getOjoTypeEmoji(name: OjoTypeName | string): string {
  const ojoType = OJO_TYPES[name as OjoTypeName];
  return ojoType ? ojoType.emoji : "🧠";
}
