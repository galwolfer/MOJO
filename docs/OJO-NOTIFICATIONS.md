# Ojo Notification System

This document describes the Ojo personality-based notification system integration.

## Overview

The Ojo notification system uses AI (via Gemini) to generate personalized task reminders based on different personality types. Each Ojo has a unique communication style and tone.

## Ojo Types

| Ojo Type | Name | Tone | Description |
|----------|------|------|-------------|
| `mentorjo` | Mentorjo | Thoughtful, professional, supportive | A wise mentor who helps you think long-term and grow |
| `brojo` | Brojo | Friendly, motivating, funny | Your bro, a friend who's always got your back |
| `bestojo` | Bestojo | Warm, caring, positive | A supportive best friend who listens and encourages you |
| `strictojo` | StrictOjo | Firm, focused, honest | A no-nonsense mentor who holds you accountable and expects results |

## How Notifications Work

The notification system has two independent settings:

### 1. Smart Reminders (Prediction Model)
Controls **when** you get reminded (timing optimization based on ML prediction):
- **ON**: Uses ML prediction to calculate optimal reminder timing
- **OFF**: Uses fixed default timing (e.g., 60 minutes before)

### 2. Ojo Personality (AI-Generated Content)
Controls **what** the notification says:
- **ON**: AI generates personalized notification text with Ojo personality
- **OFF**: Fixed/standard notification text

### Behavior Matrix

| Smart Reminders | Ojo Personality | Timing | Content | Ojo Type Selection |
|-----------------|-----------------|--------|---------|-------------------|
| OFF | OFF | Fixed default | Fixed text | N/A |
| ON | OFF | ML prediction | Fixed text | N/A |
| OFF | ON | Fixed default | AI-generated | User-selected |
| ON | ON | ML prediction | AI-generated | Auto-selected by prediction |

### When Ojo Toggle is OFF (`ojoNotifications.enabled: false`)

Standard fixed notifications are used - no AI generation occurs. The notification text is templated.

### When Ojo Toggle is ON (`ojoNotifications.enabled: true`)

#### With Smart Reminders ON (`useSmartReminders: true`)

- **Timing**: Uses ML prediction for optimal reminder timing
- **Ojo Type**: Automatically selected based on the ML prediction score:

| Condition | Ojo Type | Reasoning |
|-----------|----------|-----------|
| Critical urgency (any category) | `strictojo` | Strict accountability needed |
| Category 1 (Very quick completion) | `bestojo` | Warm encouragement |
| Category 2 (Quick completion) | `brojo` | Friendly motivation |
| Category 3 (Moderate) | `mentorjo` | Wise guidance |
| Category 4 (Slow completion) | `strictojo` | Need accountability |
| Category 5 (Unlikely quick) | `strictojo` | Strict push needed |

#### With Smart Reminders OFF (`useSmartReminders: false`)

- **Timing**: Uses fixed default timing (no prediction)
- **Ojo Type**: Uses the user's **selected Ojo type** (`selectedOjoType`)
- If no Ojo type selected: defaults to `mentorjo`

## User Settings

User preferences are stored in `User.pushNotifications.ojoNotifications`:

```javascript
{
  pushNotifications: {
    ojoNotifications: {
      enabled: Boolean,       // Toggle to enable/disable Ojo-styled notifications
      selectedOjoType: String // mentorjo | brojo | bestojo | strictojo | null
    }
  }
}
```

## API Endpoints

### Get Notification Preferences
```
GET /api/notifications/preferences
```

Response includes `availableOjoTypes` array with all Ojo options.

### Update Ojo Settings
```
PUT /api/notifications/preferences
Body: {
  ojoNotifications: {
    enabled: true,
    selectedOjoType: "brojo"
  }
}
```

### Test Task Reminder (with options)
```
POST /api/notifications/test/task-reminder
Body: {
  useSmartReminders?: boolean,  // Use ML prediction for timing (default: true)
  useOjo?: boolean              // Use Ojo AI-generated content (default: false)
}
```

### Test Ojo Notification
```
POST /api/notifications/test/ojo-reminder
Body: {
  ojoType?: "mentorjo" | "brojo" | "bestojo" | "strictojo"  // Optional, uses user's selection if not provided
}
```

## Test Buttons in App

| Button | Smart Reminders | Ojo | Description |
|--------|-----------------|-----|-------------|
| **🧠 Smart** | ✅ ON | ❌ OFF | Uses ML prediction for timing, fixed text |
| **📋 Default** | ❌ OFF | ❌ OFF | No prediction, fixed text |
| **🤖 Test Ojo** | ❌ OFF | ✅ ON | No prediction, AI-generated text |

## Test Script Commands

```bash
# Run specific Ojo tests
node scripts/test-notifications.js ojo          # Ojo with user's selected type
node scripts/test-notifications.js ojo-mentor   # Force Mentorjo
node scripts/test-notifications.js ojo-bro      # Force Brojo
node scripts/test-notifications.js ojo-best     # Force Bestojo
node scripts/test-notifications.js ojo-strict   # Force Strictojo

# View available Ojo types
node scripts/test-notifications.js ojo-types

# Enable/disable Ojo notifications
node scripts/test-notifications.js ojo-enable mentorjo
node scripts/test-notifications.js ojo-disable
```

## Notification Generation Flow

1. **Task Context Collection**: Gathers task name, description, due date, importance, and timing urgency
2. **Ojo Type Determination**: Based on smart reminders setting and ML prediction
3. **LLM Prompt Construction**: Builds a prompt with Ojo persona and task context
4. **AI Generation**: Calls Gemini API to generate personalized notification
5. **Fallback**: If AI generation fails, uses standard notification format

## Example Notifications

### Mentorjo (Category 3 - Moderate)
> **Title:** 🧙 Time for Progress
> **Body:** Remember, every step counts. "Project Report" is due in 1h 0m.

### Brojo (Category 2 - Quick task)
> **Title:** 💪 Let's Go!
> **Body:** Hey! "Gym Session" is coming up in 45m. You got this!

### Bestojo (Category 1 - Easy task)
> **Title:** 💖 Gentle Reminder
> **Body:** Just checking in! "Birthday Planning" is due in 30m. I believe in you!

### Strictojo (Category 4-5 or Critical urgency)
> **Title:** ⚡ Action Required
> **Body:** "Tax Filing" - 2h until due. No excuses. Get it done.

## Architecture

```
User Request
     ↓
[notificationService.js]
     ↓
determineOjoTypeForNotification()
     ↓
[ojoNotificationService.js]
     ↓
generateOjoNotification()
     ↓
[GeminiAdapter] → AI Response
     ↓
Push Notification Sent
```

## Files

- `src/services/ojoNotificationService.js` - Ojo generation and type selection logic
- `src/services/notificationService.js` - Main notification service with Ojo integration
- `src/models/User.js` - User schema with ojoNotifications preferences
- `src/routes/notifications.js` - API routes for Ojo settings
- `scripts/test-notifications.js` - Test script with Ojo commands

## Environment Variables

```
GEMINI_API_KEY=your_gemini_api_key  # Required for AI generation
```

## Fallback Behavior

If Gemini API fails or is unavailable:
1. Log the error
2. Return standard notification format
3. Mark `generated: false` in notification data
