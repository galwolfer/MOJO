/**
 * Cleanup Script: Remove System-Generated "General" Subcategories
 *
 * This script removes all "General" subcategories that were automatically
 * created by the system. These are no longer needed as tasks will use
 * null for the subCategory field when no specific subcategory is selected.
 *
 * Usage: node src/scripts/cleanup_general_subcategories.js
 */

import mongoose from "mongoose";
import { Subcategory } from "../models/Subcategory.js";
import { Task } from "../models/Task.js";
import { User } from "../models/User.js";
import { env } from "../config/env.js";

const MONGODB_URI = env.MONGODB_URI;

async function cleanupGeneralSubcategories() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    // Find all "General" subcategories
    const generalSubs = await Subcategory.find({
      $or: [{ source: "system" }, { name: { $regex: /^General /i } }],
    });

    console.log(`Found ${generalSubs.length} "General" subcategories to remove\n`);

    if (generalSubs.length === 0) {
      console.log("✅ No cleanup needed!");
      await mongoose.disconnect();
      return;
    }

    let tasksUpdated = 0;
    let usersUpdated = 0;

    for (const sub of generalSubs) {
      console.log(`Processing: "${sub.name}" (${sub.parent}) - User: ${sub.userId}`);

      // Update tasks using this subcategory to null
      const taskUpdateResult = await Task.updateMany({ subCategory: sub._id }, { $set: { subCategory: null } });
      tasksUpdated += taskUpdateResult.modifiedCount;

      // Remove from user's subcategory list
      const userUpdateResult = await User.updateOne({ _id: sub.userId }, { $pull: { subCategories: sub._id } });
      if (userUpdateResult.modifiedCount > 0) {
        usersUpdated++;
      }

      // Delete the subcategory
      await Subcategory.deleteOne({ _id: sub._id });
      console.log(`  ✓ Removed`);
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ Cleanup Complete!");
    console.log("=".repeat(60));
    console.log(`📊 Statistics:`);
    console.log(`   - Subcategories removed: ${generalSubs.length}`);
    console.log(`   - Tasks updated: ${tasksUpdated}`);
    console.log(`   - User profiles updated: ${usersUpdated}`);

    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  } catch (error) {
    console.error("\n❌ Error during cleanup:", error);
    process.exit(1);
  }
}

// Run the cleanup
cleanupGeneralSubcategories();
