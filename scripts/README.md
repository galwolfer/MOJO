# Scripts Directory

This directory contains utility scripts for testing and managing the Mojo application.

## Streak System Scripts

### test-streak-reset.js
Automated test suite for the streak reset functionality.

**Usage:**
```bash
node scripts/test-streak-reset.js
```

**What it tests:**
- Users who completed tasks yesterday keep their streak
- Users who didn't complete tasks yesterday have streak reset to 0
- Users inactive for multiple days have streak reset
- Users active today are not affected by the check
- Users with no streak remain unchanged

### manual-streak-check.js
Manually trigger the daily streak check without waiting for the cron job.

**Usage:**
```bash
node scripts/manual-streak-check.js
```

**What it does:**
- Shows all users with active streaks
- Runs the streak check logic
- Shows updated streaks after the check
- Useful for testing or forcing a streak check outside the scheduled time

## Other Scripts

### chat.ps1
PowerShell script for testing chat functionality.

### login.ps1
PowerShell script for testing login functionality.

### register.ps1
PowerShell script for testing user registration.

### test-subcategories.ps1
PowerShell script for testing subcategory functionality.

### test-autosave-subcategories.ps1
PowerShell script for testing autosave subcategories.

### test-ml-subcategories.ps1
PowerShell script for testing ML subcategory integration.

### test_security_integration.js
Node.js script for testing security integration.

## Environment Setup

Make sure you have the necessary environment variables set up before running these scripts:
- MongoDB connection string
- Required API keys
- Proper timezone settings (TZ environment variable)

## Testing Workflow

1. Start with automated tests to ensure functionality works
2. Use manual scripts for debugging specific issues
3. Check logs for detailed information about what's happening
4. Clean up test data after testing (most scripts do this automatically)
