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
  // New: gradient colors for persona-specific animated gradient
  gradient?: string[];
  // Avatar-specific alternate gradient (optional)
  gradient2?: string[];
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
    color: COLORS.primary1,
    description: "A wise mentor who helps you think long-term and grow.",
    isDefault: true,
    gradient: [COLORS.primary1, COLORS.brightP1, COLORS.primary2, COLORS.primary1, COLORS.darkP1, COLORS.primary2],
  },
  brojo: {
    name: "brojo",
    displayName: "Brojo",
    persona: "Your bro, friend who's always got your back.",
    tones: ["Friendly", "Motivating", "Funny"],
    icon: "brojo",
    color: COLORS.primary2, // Cyan #4CC9F0
    description: "Your bro, friend who's always got your back.",
    isDefault: false,
    gradient: [COLORS.primary2, COLORS.brightP6, COLORS.primary6, COLORS.primary2, COLORS.darkP6, COLORS.primary6],
    gradient2: [COLORS.primary2, COLORS.brightP2, COLORS.primary2, COLORS.brightP2, COLORS.primary2, COLORS.brightP2],
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
    gradient: [COLORS.primary7, COLORS.brightP7, COLORS.primary5, COLORS.primary7, COLORS.darkP7, COLORS.primary5],
  },
  bestojo: {
    name: "bestojo",
    displayName: "Bestojo",
    persona: "A supportive best friend who listens and encourages you.",
    tones: ["Warm", "Caring", "Positive"],
    icon: "bestojo",
    color: COLORS.primary3,
    description: "A supportive best friend who listens and encourages you.",
    isDefault: false,
    gradient: [COLORS.primary3, COLORS.primary4, COLORS.brightP3, COLORS.primary3, COLORS.darkP4, COLORS.primary4],
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
