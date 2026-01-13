/*
 * File: src/utils/ojoTypeUtils.js
 * Purpose: Utility functions for OjoType operations
 */
import OjoType from "../models/OjoType.js";

/**
 * Get the default OjoType (Mentorjo)
 * @returns {Promise<Object>} The default OjoType document
 */
export async function getDefaultOjoType() {
  try {
    // First try to find the default one
    let defaultOjoType = await OjoType.findOne({ isDefault: true });

    // If no default exists, try to find mentorjo
    if (!defaultOjoType) {
      defaultOjoType = await OjoType.findOne({ name: "mentorjo" });
    }

    return defaultOjoType;
  } catch (error) {
    console.error("Error getting default OjoType:", error);
    return null;
  }
}

/**
 * Get OjoType by name
 * @param {string} name - The name of the OjoType (mentorjo, brojo, bestojo, strictojo)
 * @returns {Promise<Object>} The OjoType document
 */
export async function getOjoTypeByName(name) {
  try {
    return await OjoType.findOne({ name: name.toLowerCase() });
  } catch (error) {
    console.error(`Error getting OjoType by name ${name}:`, error);
    return null;
  }
}

/**
 * Get OjoType by ID
 * @param {string} id - The OjoType ID
 * @returns {Promise<Object>} The OjoType document
 */
export async function getOjoTypeById(id) {
  try {
    return await OjoType.findById(id);
  } catch (error) {
    console.error(`Error getting OjoType by ID ${id}:`, error);
    return null;
  }
}

/**
 * Initialize OjoTypes in the database
 * Creates the default set of OjoTypes if they don't exist
 */
export async function initializeOjoTypes() {
  try {
    const ojoTypesData = [
      {
        name: "mentorjo",
        displayName: "Mentorjo",
        persona: "A wise mentor who helps you think long-term and grow.",
        tone: ["Thoughtful", "Professional", "Supportive"],
        icon: "mentorjo",
        description: "A wise mentor who helps you think long-term and grow.",
        isDefault: true,
      },
      {
        name: "brojo",
        displayName: "Brojo",
        persona: "Your bro, friend who's always got your back.",
        tone: ["Friendly", "Motivating", "Funny"],
        icon: "brojo",
        description: "Your bro, friend who's always got your back.",
        isDefault: false,
      },
      {
        name: "bestojo",
        displayName: "Bestojo",
        persona: "A supportive best friend who listens and encourages you.",
        tone: ["Warm", "Caring", "Positive"],
        icon: "bestojo",
        description: "A supportive best friend who listens and encourages you.",
        isDefault: false,
      },
      {
        name: "strictojo",
        displayName: "StrictOjo",
        persona: "A no-nonsense mentor who holds you accountable and expects results.",
        tone: ["Firm", "Focused", "Honest"],
        icon: "strictojo",
        description: "A no-nonsense mentor who holds you accountable and expects results.",
        isDefault: false,
      },
    ];

    for (const ojoTypeData of ojoTypesData) {
      const exists = await OjoType.findOne({ name: ojoTypeData.name });
      if (!exists) {
        await OjoType.create(ojoTypeData);
        console.log(`Created OjoType: ${ojoTypeData.displayName}`);
      }
    }
  } catch (error) {
    console.error("Error initializing OjoTypes:", error);
  }
}
