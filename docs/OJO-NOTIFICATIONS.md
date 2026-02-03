# Ojo Notification System

This document describes the Ojo personality-based notification system integration.

## Overview

The Ojo notification system uses AI (via Gemini) to generate personalized task reminders based on different personality types. Each Ojo has a unique communication style and tone.

## Ojo Types

| Ojo Type | Name | Tone | Description |
|----------|------|------|-------------|
| `mentorjo` | Mentorjo | Wise, encouraging, growth-focused | Professional mentor who believes in your potential |
| `brojo` | Brojo | Casual, motivating, friendly | Your supportive gym buddy who keeps it real |
| `bestojo` | Bestojo | Warm, understanding, supportive | Your best friend who always has your back |
| `strictojo` | Strictojo | Direct, no-nonsense, accountability-focused | Tough love coach who demands your best |

## How Ojo Selection Works

### When Smart Reminders are ON (`useSmartReminders: true`)

The Ojo type is **automatically selected** based on the ML prediction score:

| Prediction Category | Ojo Type | Reasoning |
|---------------------|----------|-----------|
| 1 (Very quick completion) | mentorjo | Light encouragement |
| 2 (Quick completion) | bestojo | Friendly support |
| 3 (Moderate) | mentorjo | Professional guidance |
| 4 (Slow completion) | brojo | Motivational push |
| 5 (Unlikely quick) | strictojo | Accountability needed |

### When Smart Reminders are OFF (`useSmartReminders: false`)

- If Ojo is enabled: Uses the user's **selected Ojo type**
- If no Ojo selected: Uses `mentorjo` as default

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

### Test Ojo Notification
```
POST /api/notifications/test/ojo-reminder
Body: {
  ojoType?: "mentorjo" | "brojo" | "bestojo" | "strictojo"  // Optional, auto-selects if not provided
}
```

## Test Script Commands

```bash
# Run specific Ojo tests
node scripts/test-notifications.js ojo          # Auto-select Ojo
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
> **Title:** Time to grow 🌱
> **Body:** "Project Report" is an opportunity to demonstrate your capabilities. Take 60 minutes to show what you're made of.

### Brojo (Category 4 - Needs Push)
> **Title:** Let's crush this! 💪
> **Body:** Hey! "Gym Session" is waiting for you. No excuses - you've got this! 45 minutes is all it takes.

### Bestojo (Category 2 - Supportive)
> **Title:** You've got this! ✨
> **Body:** Just a friendly reminder about "Birthday Planning" - I know you'll make it amazing! Ready when you are.

### Strictojo (Category 5 - Accountability)
> **Title:** No more delays.
> **Body:** "Tax Filing" deadline is approaching. You've had enough time. Get it done in the next 2 hours. No excuses.

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
