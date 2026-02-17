/**
 * Initialize Script: Create System-Wide "General" Subcategories
 *
 * This script creates one "General" subcategory per category that is shared
 * across all users. These act as default subcategories when users delete
 * their custom subcategories.
 *
 * Usage: node src/scripts/initialize_general_subcategories.js
 */

import mongoose from "mongoose";
import { Subcategory } from "../models/Subcategory.js";
import { CATEGORY_STRING_VALUES } from "../config/categories.js";
import { env } from "../config/env.js";

const MONGODB_URI = env.MONGODB_URI;
const SYSTEM_USER_ID = "000000000000000000000000";

async function initializeGeneralSubcategories() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    console.log("Creating system-wide 'General' subcategories...\n");

    let created = 0;
    let existing = 0;

    for (const category of CATEGORY_STRING_VALUES) {
      // Check if general subcategory already exists
      const existingSub = await Subcategory.findOne({
        userId: SYSTEM_USER_ID,
        parent: category,
        nameLower: "general",
      });

      if (existingSub) {
        console.log(`  ✓ ${category}: Already exists`);
        existing++;
        continue;
      }

      // Create new general subcategory
      await Subcategory.create({
        userId: SYSTEM_USER_ID,
        name: "General",
        parent: category,
        icon: null, // Frontend will use category icon
        color: null,
        source: "category-default",
        confidence: 1,
      });

      console.log(`  + ${category}: Created`);
      created++;
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ Initialization Complete!");
    console.log("=".repeat(60));
    console.log(`📊 Statistics:`);
    console.log(`   - Categories processed: ${CATEGORY_STRING_VALUES.length}`);
    console.log(`   - New subcategories created: ${created}`);
    console.log(`   - Already existing: ${existing}`);

    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  } catch (error) {
    console.error("\n❌ Error during initialization:", error);
    process.exit(1);
  }
}

// Run the initialization
initializeGeneralSubcategories();
