import mongoose from "mongoose";
import { Subcategory } from "../models/Subcategory.js";
import { CATEGORY_STRING_VALUES, getDisplayName } from "../config/categories.js";
import { env } from "../config/env.js";

const MONGODB_URI = env.MONGODB_URI;
const SYSTEM_USER_ID = "000000000000000000000000";

async function initializeGeneralSubcategories() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    // Step 1: Remove any category-default subcategories created under real user IDs
    const { deletedCount } = await Subcategory.deleteMany({
      source: "category-default",
      userId: { $ne: new mongoose.Types.ObjectId(SYSTEM_USER_ID) },
    });
    if (deletedCount > 0) {
      console.log(`🧹 Removed ${deletedCount} mis-owned category-default records\n`);
    }

    console.log("Creating system-wide 'General [Category]' subcategories...\n");

    let created = 0;
    let updated = 0;
    let existing = 0;

    for (const category of CATEGORY_STRING_VALUES) {
      const displayName = getDisplayName(category);
      const generalName = `General ${displayName}`;

      // Find any existing category-default for this category under system user
      const existingSub = await Subcategory.findOne({
        userId: SYSTEM_USER_ID,
        parent: category,
        source: "category-default",
      });

      if (existingSub) {
        if (existingSub.name !== generalName) {
          existingSub.name = generalName;
          existingSub.nameLower = generalName.toLowerCase();
          await existingSub.save();
          console.log(`  ✎ ${category}: Renamed to "${generalName}"`);
          updated++;
        } else {
          console.log(`  ✓ ${category}: Already exists`);
          existing++;
        }
        continue;
      }

      await Subcategory.create({
        userId: SYSTEM_USER_ID,
        name: generalName,
        parent: category,
        icon: null,
        color: null,
        source: "category-default",
        confidence: 1,
      });

      console.log(`  + ${category}: Created "${generalName}"`);
      created++;
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ Initialization Complete!");
    console.log("=".repeat(60));
    console.log(`📊 Statistics:`);
    console.log(`   - Categories processed: ${CATEGORY_STRING_VALUES.length}`);
    console.log(`   - New subcategories created: ${created}`);
    console.log(`   - Renamed (legacy naming): ${updated}`);
    console.log(`   - Already correct: ${existing}`);

    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  } catch (error) {
    console.error("\n❌ Error during initialization:", error);
    process.exit(1);
  }
}

// Run the initialization
initializeGeneralSubcategories();
