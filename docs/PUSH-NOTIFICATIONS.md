# Push Notification System

This document describes the push notification system implemented for Mojo that works with both development APKs and production builds.

## Overview

The system uses **Expo Push Notifications** which work seamlessly across development and production environments. It supports:

1. **Morning Task Digest** - Daily notification at 8 AM (configurable) summarizing tasks for the day
2. **Smart Task Reminders** - ML-powered reminders that predict optimal timing and frequency based on user behavior

## Architecture

### Backend Components

#### 1. User Model Update (`src/models/User.js`)
Added `pushNotifications` field with:
- `expoPushToken` - Device's Expo push token
- `platform` - Device platform (ios/android)
- `enabled` - Master toggle for notifications
- `morningDigest` - Settings for daily digest (enabled, hour, minute)
- `taskReminders` - Settings for task reminders (enabled, default minutes, smart reminders toggle)
- `timezone` - User's timezone for scheduling

#### 2. Notification Service (`src/services/notificationService.js`)
Core service handling:
- Expo Push API integration
- Morning digest notification building
- Smart reminder timing calculation using ML predictions
- Token registration and management
- Batch notification sending

#### 3. Notification Routes (`src/routes/notifications.js`)
API endpoints:
- `POST /api/notifications/register` - Register push token
- `POST /api/notifications/unregister` - Unregister token
- `GET /api/notifications/preferences` - Get notification preferences
- `PUT /api/notifications/preferences` - Update preferences
- `POST /api/notifications/test` - Send test notification

#### 4. Notification Scheduler (`src/services/notificationScheduler.js`)
Cron jobs for:
- Morning digest (runs hourly, checks user's preferred time)
- Task reminders (runs every 15 minutes)

### Frontend Components

#### 1. Notification Service (`frontend/services/notificationService.ts`)
Client-side service for:
- Requesting permissions
- Getting Expo push tokens
- Setting up notification channels (Android)
- Handling notification listeners

#### 2. Notification Context (`frontend/context/NotificationContext.tsx`)
React context providing:
- Notification state (token, preferences, permissions)
- Initialize/update functions
- Notification event handlers

#### 3. Notification Settings UI (`frontend/components/special/NotificationSettings.tsx`)
Settings component with toggles for:
- All notifications (master toggle)
- Morning digest
- Task reminders
- Smart reminders (ML-powered)
- Test notification button

## Setup Instructions

### Backend Setup
No additional setup needed - the scheduler starts automatically when the server starts.

### Frontend Setup

1. **Development APK**: After building with `expo run:android`, push notifications will work automatically.

2. **Production (EAS Build)**: Create `google-services.json` for Android:
   ```bash
   # Place google-services.json in frontend/ directory
   eas build --platform android
   ```

3. **Firebase Setup** (for production):
   - Create a Firebase project
   - Add an Android app with package name `com.mojo.Mojo`
   - Download `google-services.json` and place in `frontend/`

## How It Works

### Morning Digest Flow
1. Scheduler runs hourly
2. Finds users whose preferred digest hour matches current hour
3. Fetches each user's tasks for today
4. Builds personalized notification with task count and summary
5. Sends via Expo Push API

### Smart Reminders Flow
1. Scheduler runs every 15 minutes
2. Finds tasks due in next 4 hours
3. For each task, calls ML prediction service
4. Based on prediction category (1-5), determines:
   - How early to remind (30 min - 4 hours)
   - How many reminders (1-5)
   - Urgency level (low/normal/high/critical)
5. Sends appropriately timed notifications

### ML Integration
The system uses the existing `mlPredictionService.js` to predict:
- `category`: 1 (quick completion) to 5 (unlikely to complete)
- `score`: Confidence score (0-1)

Higher category = more/earlier reminders

## API Reference

### Register Token
```javascript
POST /api/notifications/register
{
  "token": "ExponentPushToken[xxx]",
  "platform": "android"
}
```

### Update Preferences
```javascript
PUT /api/notifications/preferences
{
  "enabled": true,
  "morningDigest": {
    "enabled": true,
    "hour": 8
  },
  "taskReminders": {
    "enabled": true,
    "useSmartReminders": true
  },
  "timezone": "America/New_York"
}
```

## Testing

1. **Development Testing**:
   - Build and install development APK on physical device
   - Enable notifications in the settings screen
   - Use "Send Test Notification" button

2. **Backend Testing**:
   ```javascript
   // Manually trigger notifications
   import { sendMorningDigestNotifications, sendTaskReminderNotifications } from './services/notificationService.js';
   await sendMorningDigestNotifications();
   await sendTaskReminderNotifications();
   ```

## Notes

- Push notifications only work on **physical devices**, not emulators
- Expo Push Tokens are specific to each device installation
- Token changes when app is uninstalled/reinstalled
- Invalid tokens are automatically cleaned up
