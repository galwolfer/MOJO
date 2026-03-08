# Ojo Notification System

This document describes the Ojo personality-based notification system — how personalized reminders are generated, delivered, and configured.

## Overview

The Ojo notification system uses AI (via Google Gemini through LangChain) to generate personalized task reminders. Each Ojo type has a unique communication style, tone, and persona. Notifications are delivered as both **push notifications** (Expo Push API) and **in-app inbox** items.

## Ojo Types

| Ojo Type | Name | Emoji | Tone | Description |
|----------|------|-------|------|-------------|
| `mentorjo` | Mentorjo | 🧙 | Thoughtful, professional, supportive | A wise mentor who helps you think long-term and grow |
| `brojo` | Brojo | 💪 | Friendly, motivating, funny | Your bro, a friend who's always got your back |
| `bestojo` | Bestojo | 💖 | Warm, caring, positive | A supportive best friend who listens and encourages you |
| `strictojo` | StrictOjo | ⚡ | Firm, focused, honest | A no-nonsense mentor who holds you accountable and expects results |

Each Ojo type also has:
- A dedicated **Android notification channel** (`ojo-mentorjo`, `ojo-brojo`, `ojo-bestojo`, `ojo-strictojo`)
- A **notification icon** served at `/notification-icons/<name>-icon.png`

## How Notifications Work

The notification system has two independent settings:

### 1. Smart Reminders (Prediction Model)
Controls **when** you get reminded — timing optimization based on ML prediction:
- **ON**: Uses pre-calculated `task.predictedCompletionCategory` (1–5) to determine optimal reminder windows, number of reminders, and urgency level
- **OFF**: Uses fixed default timing (`defaultReminderMinutes`, default 60 minutes before)

Smart timing categories:

| Category | Window | Reminders | Urgency | Example |
|----------|--------|-----------|---------|---------|
| 1 | 30 min | 1 | Low | Quick task — one gentle nudge |
| 2 | 60 min | 2 | Normal | Short task — two reminders |
| 3 | 120 min | 2 | Normal | Moderate — two spread-out reminders |
| 4 | 180 min | 3 | High | Slow — three reminders with escalation |
| 5 | 240+ min | 4 | Critical | Unlikely quick — aggressive reminders |

Tasks with `importance ≥ 4` get an urgency boost.

### 2. Ojo Personality (AI-Generated Content)
Controls **what** the notification says:
- **ON**: AI generates personalized notification text with the selected Ojo personality
- **OFF**: Fixed/standard notification text with emoji-coded urgency (🚨 critical, ⚠️ high, ⏰ normal, 📝 low)

### Ojo Type Selection Options

When Ojo personality is enabled, the user sees these choices in the Ojo Personality settings screen:

| Option | Value | Description |
|--------|-------|-------------|
| **Off** | `enabled: false` | Standard templated notifications, no personality |
| **Auto** | `"auto"` | ML prediction picks the best Ojo per task (only visible when smart reminders is ON) |
| **Same as Chat Ojo** | `"chat"` | Mirrors the user's chat personality (resolved from `user.profile.ojoTypeId`) |
| **Mentorjo** | `"mentorjo"` | Always uses Mentorjo |
| **Brojo** | `"brojo"` | Always uses Brojo |
| **Bestojo** | `"bestojo"` | Always uses Bestojo |
| **StrictOjo** | `"strictojo"` | Always uses StrictOjo |

### Behavior Matrix

| Smart Reminders | Ojo Personality | Timing | Content | Ojo Type Selection |
|-----------------|-----------------|--------|---------|-------------------|
| OFF | OFF | Fixed default | Fixed text | N/A |
| ON | OFF | ML prediction | Fixed text | N/A |
| OFF | ON | Fixed default | AI-generated | User-selected (Auto option hidden) |
| ON | ON | ML prediction | AI-generated | User-selected or Auto |

### When Ojo Toggle is OFF (`ojoNotifications.enabled: false`)

Standard fixed notifications are used — no AI generation occurs. Notification text is templated based on urgency level.

### When Ojo Toggle is ON (`ojoNotifications.enabled: true`)

#### With Smart Reminders ON

All Ojo type options are available, including **Auto**.

When **Auto** is selected, the ML prediction category determines the Ojo type per task:

| Condition | Ojo Type | Reasoning |
|-----------|----------|-----------|
| Critical urgency (any category) | `strictojo` | Strict accountability needed |
| Category 1 (Very quick completion) | `bestojo` | Warm encouragement |
| Category 2 (Quick completion) | `brojo` | Friendly motivation |
| Category 3 (Moderate) | `mentorjo` | Wise guidance |
| Category 4 (Slow completion) | `strictojo` | Need accountability |
| Category 5 (Unlikely quick) | `strictojo` | Strict push needed |

When a **specific type** or **Same as Chat** is selected, that type is used regardless of the ML prediction.

#### With Smart Reminders OFF

- **Timing**: Uses fixed default timing (no prediction)
- **Ojo Type**: The **Auto** option is **hidden** from the selection screen (it depends on ML data)
- User can choose Same as Chat, or a specific Ojo type
- If no Ojo type selected: defaults to `mentorjo`

### Auto-Downgrade Behavior

When smart reminders is turned **OFF** and the Ojo type was set to **Auto**:
1. The Ojo type is automatically changed to **Same as Chat**
2. The `_autoDowngraded` flag is set to `true`
3. The **Auto** option is hidden from the selection screen

When smart reminders is turned back **ON**:
- If `_autoDowngraded` is `true` (user never manually changed the type) → **Auto** is **restored** automatically
- If the user manually changed the Ojo type at any point (even back to "Same as Chat") → `_autoDowngraded` was cleared, so **Auto** is **not** restored

### Ojo Type Resolution (`determineOjoTypeForNotification`)

The function returns `{ useOjo, ojoType, source }` where `source` indicates how the type was resolved:

| `selectedOjoType` | Resolved Ojo Type | Source |
|-------------------|--------------------|--------|
| (Ojo disabled) | `null` | `"disabled"` |
| `"auto"` | Based on prediction category | `"auto_prediction"` |
| `null` (no selection) | Based on prediction category (default cat 3 → mentorjo) | `"default_prediction"` |
| `"chat"` | Resolved from `user.profile.ojoTypeId` via OjoType model | `"chat_synced"` |
| `"mentorjo"` / `"brojo"` / `"bestojo"` / `"strictojo"` | Exactly as selected | `"user_selected"` |

## Notification Types with Ojo Support

### Task Reminders
- Individual task reminders based on due date or next schedule occurrence
- Supports both smart (ML-timed) and default (fixed) timing
- Deduplication via `SentReminder` collection (TTL 6 hours)

### Subtask Reminders
- Reminders for individual subtasks within a task
- Same timing logic as task reminders
- Notification includes both task name and subtask name

### Morning Digest
- Daily summary notification sent at the user's configured time (default 8:00 AM in their timezone)
- When Ojo is enabled: AI generates a personalized digest of the day's tasks
- Synthetic task context created from the task list (up to 3 task names, max importance)

## Notification Delivery

Notifications are always delivered to **two channels**:
1. **Push notification** — via Expo Push API (requires valid `ExponentPushToken` or `ExpoPushToken`)
2. **In-app inbox** — stored in `InAppNotification` collection (always saved, works as fallback for web)

Invalid/expired push tokens are automatically detected and removed when Expo returns `DeviceNotRegistered`.

## User Settings

User preferences are stored in `User.pushNotifications`:

```javascript
{
  pushNotifications: {
    expoPushToken: String,       // Expo push token for this device
    platform: String,            // "ios" | "android" | "web" | null
    enabled: Boolean,            // Global notification toggle
    morningDigest: {
      enabled: Boolean,          // Morning digest toggle (default: true)
      hour: Number,              // Hour to send (0-23, default: 8)
      minute: Number,            // Minute to send (0-59, default: 0)
    },
    taskReminders: {
      enabled: Boolean,          // Task reminder toggle (default: true)
      defaultReminderMinutes: Number, // Fixed reminder minutes (default: 60)
      useSmartReminders: Boolean,     // ML-based timing toggle (default: true)
    },
    ojoNotifications: {
      enabled: Boolean,          // Ojo personality toggle (default: false)
      selectedOjoType: String,   // "mentorjo" | "brojo" | "bestojo" | "strictojo" | "chat" | "auto" | null
      _autoDowngraded: Boolean,  // Internal: tracks auto→chat downgrade when smart reminders turned off
    },
    timezone: String,            // IANA timezone (default: "UTC")
    lastMorningDigest: Date,     // Timestamp of last morning digest sent
    lastTaskReminder: Date,      // Timestamp of last task reminder sent
  }
}
```

## API Endpoints

### Get Notification Preferences
```
GET /api/notifications/preferences
```
Response includes `availableOjoTypes` array with all Ojo options (name, displayName, persona, tones).

### Update Preferences
```
PUT /api/notifications/preferences
Body: {
  ojoNotifications?: {
    enabled?: boolean,
    selectedOjoType?: "mentorjo" | "brojo" | "bestojo" | "strictojo" | "chat" | "auto" | null,
    _autoDowngraded?: boolean
  },
  taskReminders?: {
    enabled?: boolean,
    defaultReminderMinutes?: number,  // 5–1440
    useSmartReminders?: boolean
  },
  morningDigest?: {
    enabled?: boolean,
    hour?: number,     // 0–23
    minute?: number    // 0–59
  },
  enabled?: boolean,
  timezone?: string
}
```

### Register / Unregister Push Token
```
POST /api/notifications/register
Body: { token: string, platform?: string }

POST /api/notifications/unregister
```

### Test Endpoints

```
POST /api/notifications/test                    # Generic test notification
POST /api/notifications/test/morning-digest     # Trigger morning digest
POST /api/notifications/test/task-reminder      # Test task reminder
Body: { useSmartReminders?: boolean, useOjo?: boolean }

POST /api/notifications/test/subtask-reminder   # Test subtask reminder

POST /api/notifications/test/smart-reminder     # Smart timing calculation only (no send)
Body: { taskId?: string }

POST /api/notifications/test/ojo-reminder       # Test Ojo AI notification
Body: { ojoType?: "mentorjo" | "brojo" | "bestojo" | "strictojo" }
```

### In-App Inbox
```
GET /api/notifications/inbox                    # Paginated inbox (unreadOnly filter)
GET /api/notifications/inbox/unread-count       # Badge count
GET /api/notifications/sent-reminders           # View sent reminder history (TTL 6 hrs)
```

## Test Buttons in App

The notification settings screen shows test buttons for verifying notification delivery:

| Button | Smart Reminders | Ojo | Description |
|--------|-----------------|-----|-------------|
| **Test Push** | — | — | Generic test push notification |
| **Test Digest** | — | — | Trigger morning digest |
| **Smart Reminder** | ✅ ON | ❌ OFF | Uses ML prediction for timing, fixed text |
| **Default Reminder** | ❌ OFF | ❌ OFF | No prediction, fixed text |
| **Test Ojo Notification** | — | ✅ ON | AI-generated text (only shown when Ojo is enabled) |
| **View Smart Calculation** | — | — | Shows ML timing breakdown without sending |

> **Note:** The **Periodic Test Mode** section and **Debug Info** panel are hidden from the UI. They remain in the codebase but are not rendered.

## Test Script Commands

```bash
# Basic tests
node scripts/test-notifications.js prefs          # Get notification preferences
node scripts/test-notifications.js test           # Send generic test notification
node scripts/test-notifications.js reminder       # Task reminder (smart)
node scripts/test-notifications.js smart          # Smart calculation only (no send)
node scripts/test-notifications.js digest         # Morning digest test

# Ojo-specific tests
node scripts/test-notifications.js ojo            # Ojo with auto-select
node scripts/test-notifications.js ojo-mentor     # Force Mentorjo
node scripts/test-notifications.js ojo-bro        # Force Brojo
node scripts/test-notifications.js ojo-best       # Force Bestojo
node scripts/test-notifications.js ojo-strict     # Force Strictojo
node scripts/test-notifications.js ojo-types      # List available Ojo types
node scripts/test-notifications.js ojo-enable mentorjo  # Enable specific type
node scripts/test-notifications.js ojo-disable    # Disable Ojo

# Periodic testing
node scripts/test-notifications.js start          # Start 1-min periodic test
node scripts/test-notifications.js stop           # Stop periodic test
node scripts/test-notifications.js status         # Check test mode status

# Full suite
node scripts/test-notifications.js all            # Run all tests sequentially
```

## Notification Generation Flow

```
Task due / Schedule triggered
        ↓
[notificationScheduler.js] — Cron runs every minute
        ↓
[notificationService.js] — sendTaskReminderNotifications()
        ↓
   ┌──── Is Ojo enabled? ────┐
   │                          │
   No                        Yes
   ↓                          ↓
buildTaskReminderNotification()    buildNotificationWithOjo()
(fixed text, emoji urgency)         ↓
                            determineOjoTypeForNotification()
                                   ↓
                            ┌─ auto → mapPredictionToOjoType(category, urgency)
                            ├─ chat → resolveChatOjoType(user) → OjoType model lookup
                            └─ specific → use as-is
                                   ↓
                            generateOjoNotification()
                                   ↓
                            [LangChain → Gemini API]
                            SystemMessage (persona prompt) + HumanMessage (task context)
                                   ↓
                            Parse "TITLE: ...\nBODY: ..." response
                                   ↓
                            ┌─ Success → AI-generated notification
                            └─ Failure → Fallback template per Ojo type
                                   ↓
                            Send push (Expo API) + Store in-app inbox
                            Record in SentReminder (dedup, TTL 6h)
```

### AI Generation Details

- **Model**: `gemini-3.0-flash` (configurable via `config.geminiModel`)
- **Temperature**: 0.7 (higher than chat's 0.2 for varied notifications)
- **Max tokens**: 768
- **Output format**: `TITLE: (max 40 chars)\nBODY: (max 80 chars)`
- **Fallback parsing**: Also tries JSON `{ "title": ..., "body": ... }` format

### Task Context Sent to AI

The prompt includes:
- Task name and description
- Subtask name (if applicable)
- Category
- Importance level (Low → Critical)
- Time until due/scheduled (formatted)
- Urgency level
- User's name (for personalization)

## Example Notifications

### Mentorjo (Category 3 — Moderate)
> **Title:** 🧙 Time for Progress
> **Body:** Remember, every step counts. "Project Report" is due in 1h 0m.

### Brojo (Category 2 — Quick task)
> **Title:** 💪 Let's Go!
> **Body:** Hey! "Gym Session" is coming up in 45m. You got this!

### Bestojo (Category 1 — Easy task)
> **Title:** 💖 Gentle Reminder
> **Body:** Just checking in! "Birthday Planning" is due in 30m. I believe in you!

### StrictOjo (Category 4-5 or Critical urgency)
> **Title:** ⚡ Action Required
> **Body:** "Tax Filing" - 2h until due. No excuses. Get it done.

## Files

| File | Purpose |
|------|---------|
| `src/services/ojoNotificationService.js` | Ojo definitions, AI generation, type determination, prompt building |
| `src/services/notificationService.js` | Main notification service — delivery, scheduling, timing, Ojo integration |
| `src/services/notificationScheduler.js` | Cron jobs (every minute) for morning digest and task reminders |
| `src/models/User.js` | User schema with `pushNotifications.ojoNotifications` preferences |
| `src/models/SentReminder.js` | Deduplication of sent reminders (TTL 6 hours) |
| `src/models/InAppNotification.js` | In-app notification inbox storage |
| `src/routes/notifications.js` | API routes for preferences, testing, inbox |
| `scripts/test-notifications.js` | CLI test script with Ojo commands |
| `frontend/context/NotificationSettingsContext.tsx` | Frontend state management, auto-downgrade logic |
| `frontend/screens/settings/screens/OjoNotificationPersonalitySettings.tsx` | Ojo type selection UI |
| `frontend/services/notificationService.ts` | TypeScript types (`OjoType`, `OjoTypeOption`, `NotificationPreferences`) |

## Environment Variables

```
GEMINI_API_KEY=your_gemini_api_key          # Required for AI generation
DEFAULT_MACHINE_IP=192.168.x.x             # For notification icon URLs (dev)
NOTIFICATION_ICON_BASE_URL=https://...      # Override for icon base URL (production)
PORT=3000                                    # Server port (default: 3000)
```

## Fallback Behavior

If Gemini API fails or is unavailable:
1. Log the error with `❌ Ojo AI FAILED` prefix
2. Return personality-appropriate **fallback template** (each Ojo type has a unique template)
3. Mark `generated: false` in notification data (vs `generated: true` for AI success)
