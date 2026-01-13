/**
 * File: frontend/config/ojoTypeConfig.ts
 * Purpose: OjoType definitions for frontend with colors and icons
 */
import { COLORS } from "../theme";

export type OjoTypeName = "mentorjo" | "brojo" | "bestojo" | "strictojo";

export interface OjoTypeConfig {
  name: OjoTypeName;
  displayName: string;
  persona: string;
  tones: string[];
  icon: string;
  color: string;
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
    persona: "A wise mentor who helps you think long-term and grow.",
    tones: ["Thoughtful", "Professional", "Supportive"],
    icon: "mentorjo",
    color: COLORS.primary1, // Blue #4361EE
    description: "A wise mentor who helps you think long-term and grow.",
    isDefault: true,
  },
  brojo: {
    name: "brojo",
    displayName: "Brojo",
    persona: "Your bro, friend who's always got your back.",
    tones: ["Friendly", "Motivating", "Funny"],
    icon: "brojo",
    color: COLORS.primary6, // Cyan #4CC9F0
    description: "Your bro, friend who's always got your back.",
    isDefault: false,
  },
  strictojo: {
    name: "strictojo",
    displayName: "StrictOjo",
    persona: "A no-nonsense mentor who holds you accountable and expects results.",
    tones: ["Firm", "Focused", "Honest"],
    icon: "strictojo",
    color: COLORS.primary7, // Red #F43E3E
    description: "A no-nonsense mentor who holds you accountable and expects results.",
    isDefault: false,
  },
  bestojo: {
    name: "bestojo",
    displayName: "Bestojo",
    persona: "A supportive best friend who listens and encourages you.",
    tones: ["Warm", "Caring", "Positive"],
    icon: "bestojo",
    color: COLORS.primary3, // Pink #F72585
    description: "A supportive best friend who listens and encourages you.",
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
 * Get OjoType icon name by name
 */
export function getOjoTypeIcon(name: OjoTypeName | string): string {
  const ojoType = OJO_TYPES[name as OjoTypeName];
  return ojoType ? ojoType.icon : "mentorjo";
}
