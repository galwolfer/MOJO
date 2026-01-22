/**
 * Manual test script for streak functionality
 * Run this to manually trigger a streak check
 * 
 * Usage:
 *   node scripts/manual-streak-check.js
 */

import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import { triggerStreakCheck } from "../src/services/streakService.js";
import { User } from "../src/models/User.js";

async function runManualCheck() {
  console.log("🔥 Manual Streak Check\n");

  try {
    await connectDatabase();
    console.log("✅ Connected to database\n");

    // Show users with active streaks before check
    const usersWithStreak = await User.find({
      "gamification.currentStreak": { $gt: 0 },
    }).select("username gamification.currentStreak gamification.lastActiveDate");

    console.log("📊 Users with active streaks:");
    if (usersWithStreak.length === 0) {
      console.log("  (none)\n");
    } else {
      usersWithStreak.forEach((user) => {
        const lastActive = user.gamification.lastActiveDate
          ? new Date(user.gamification.lastActiveDate).toLocaleDateString()
          : "never";
        console.log(`  - ${user.username}: ${user.gamification.currentStreak} days (last active: ${lastActive})`);
      });
      console.log("");
    }

    // Run the streak check
    console.log("🔄 Running streak check...\n");
    await triggerStreakCheck();

    // Show users with active streaks after check
    const usersAfter = await User.find({
      "gamification.currentStreak": { $gt: 0 },
    }).select("username gamification.currentStreak gamification.lastActiveDate");

    console.log("\n📊 Users with active streaks after check:");
    if (usersAfter.length === 0) {
      console.log("  (none)\n");
    } else {
      usersAfter.forEach((user) => {
        const lastActive = user.gamification.lastActiveDate
          ? new Date(user.gamification.lastActiveDate).toLocaleDateString()
          : "never";
        console.log(`  - ${user.username}: ${user.gamification.currentStreak} days (last active: ${lastActive})`);
      });
      console.log("");
    }

    console.log("✅ Check complete!\n");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await disconnectDatabase();
    process.exit(0);
  }
}

runManualCheck();
