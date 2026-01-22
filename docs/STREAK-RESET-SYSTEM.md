# Streak Reset System

## Overview

The streak system tracks consecutive days of task completion. If a user doesn't complete at least one task for a day, their streak is reset to zero.

## How It Works

### Streak Increment
- When a user completes a task, their streak is incremented (handled in `userController.js`)
- The `updateUserStreak()` function checks if it's a consecutive day and increments accordingly
- `lastActiveDate` is updated to track the last day of activity

### Streak Reset
The system uses two mechanisms to reset streaks:

#### 1. Daily Cron Job (`streakService.js`)
- Runs every day at midnight (configurable via `STREAK_CHECK_CRON` env variable)
- Checks all users with active streaks
- For each user:
  - If last active was yesterday, checks if they completed any tasks
  - If NO tasks were completed yesterday, resets streak to 0
  - If more than one day has passed, automatically resets streak to 0

#### 2. Real-time Check (`userController.js`)
- When fetching user stats (GET `/api/user/stats`)
- Checks if more than 1 day has passed since last activity
- If yes, checks if user completed tasks yesterday
- Resets streak if no tasks were completed

## Files Modified

### Backend Files
1. **`src/services/streakService.js`** (NEW)
   - Contains the daily cron job logic
   - Checks all users for streak reset
   - Exports `startStreakChecker()`, `stopStreakChecker()`, and `triggerStreakCheck()`

2. **`src/controllers/userController.js`** (MODIFIED)
   - Added real-time streak check in `getUserStats()`
   - Checks if user completed tasks yesterday when fetching stats
   - Resets streak if necessary before returning stats

3. **`src/server.js`** (MODIFIED)
   - Imports and starts the streak checker service
   - Runs automatically when server starts

### Test Files
- **`scripts/test-streak-reset.js`** (NEW)
  - Comprehensive test suite for streak reset functionality
  - Tests various scenarios (active users, inactive users, etc.)

## Configuration

### Environment Variables
- `STREAK_CHECK_CRON`: Cron expression for when to run the streak check (default: `"0 0 * * *"` - midnight daily)
- `TZ`: Timezone for cron scheduling (default: `"UTC"`)

### Example Cron Expressions
- `"0 0 * * *"` - Every day at midnight
- `"0 2 * * *"` - Every day at 2:00 AM
- `"*/5 * * * *"` - Every 5 minutes (for testing)

## Testing

Run the test script:
```bash
node scripts/test-streak-reset.js
```

The test script validates:
1. Users who completed tasks yesterday keep their streak
2. Users who didn't complete tasks yesterday have streak reset
3. Inactive users (multiple days) have streak reset
4. Users active today are not affected
5. Users with no streak are not affected

## Logic Flow

```
User opens app → getUserStats() called
    ↓
Check lastActiveDate
    ↓
If more than 1 day passed?
    ↓ YES
Check if user completed tasks yesterday
    ↓ NO
Reset streak to 0
    ↓
Return stats to frontend
```

## Database Schema

The user's gamification object includes:
```javascript
gamification: {
  points: Number,
  currentStreak: Number,    // Current consecutive days
  longestStreak: Number,    // Best streak ever
  lastActiveDate: Date      // Last day user was active (normalized to 00:00:00)
}
```

## Key Features

1. **Automatic Reset**: Cron job ensures streaks are reset even if users don't open the app
2. **Real-time Check**: Stats endpoint checks and resets immediately when user opens the app
3. **Fair Counting**: Only counts completed tasks (status = "done") from the specific day
4. **Timezone Aware**: Uses system timezone for accurate day boundaries
5. **Performance**: Only checks users with active streaks (currentStreak > 0)

## Future Improvements

Possible enhancements:
- Add "freeze days" or "grace periods" (e.g., user can miss 1 day per week)
- Notifications before streak is about to break
- Streak recovery options (complete 2 tasks to recover lost streak)
- Weekly/monthly streak tracking in addition to daily
- Streak leaderboard
