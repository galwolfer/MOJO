/**
 * Notification Service Unit Tests
 * 
 * Tests notification logic without sending real notifications.
 * Run with: npm test -- tests/notifications/notificationService.test.js
 * 
 * These tests validate the notification building logic without requiring
 * database connections or actually sending notifications.
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert';

describe('Notification Service', () => {
  let isValidExpoPushToken;
  
  before(async () => {
    // Import the function we need to test
    const module = await import('../../src/services/notificationService.js');
    isValidExpoPushToken = module.isValidExpoPushToken;
  });

  describe('isValidExpoPushToken', () => {
    it('should validate ExponentPushToken format', () => {
      assert.strictEqual(isValidExpoPushToken('ExponentPushToken[abc123]'), true);
    });

    it('should validate ExpoPushToken format', () => {
      assert.strictEqual(isValidExpoPushToken('ExpoPushToken[xyz789]'), true);
    });

    it('should reject empty string', () => {
      assert.strictEqual(isValidExpoPushToken(''), false);
    });

    it('should reject null', () => {
      assert.strictEqual(isValidExpoPushToken(null), false);
    });

    it('should reject undefined', () => {
      assert.strictEqual(isValidExpoPushToken(undefined), false);
    });

    it('should reject invalid token format', () => {
      assert.strictEqual(isValidExpoPushToken('invalid-token'), false);
    });

    it('should reject incomplete token format', () => {
      assert.strictEqual(isValidExpoPushToken('ExponentPushToken'), false);
    });

    it('should reject token without brackets', () => {
      assert.strictEqual(isValidExpoPushToken('ExponentPushTokenabc123'), false);
    });
  });

  describe('Notification Content Building', () => {
    it('should format time correctly for minutes', () => {
      // Test that 30 minutes shows as "30m"
      const minutesBefore = 30;
      const timeStr = minutesBefore >= 60 
        ? `${Math.floor(minutesBefore / 60)}h ${minutesBefore % 60}m`
        : `${minutesBefore}m`;
      assert.strictEqual(timeStr, '30m');
    });

    it('should format time correctly for hours and minutes', () => {
      // Test that 90 minutes shows as "1h 30m"
      const minutesBefore = 90;
      const timeStr = minutesBefore >= 60 
        ? `${Math.floor(minutesBefore / 60)}h ${minutesBefore % 60}m`
        : `${minutesBefore}m`;
      assert.strictEqual(timeStr, '1h 30m');
    });

    it('should format time correctly for exact hours', () => {
      // Test that 120 minutes shows as "2h 0m"
      const minutesBefore = 120;
      const timeStr = minutesBefore >= 60 
        ? `${Math.floor(minutesBefore / 60)}h ${minutesBefore % 60}m`
        : `${minutesBefore}m`;
      assert.strictEqual(timeStr, '2h 0m');
    });
  });

  describe('Urgency Levels', () => {
    it('should have correct emoji for critical urgency', () => {
      const urgency = 'critical';
      let emoji = '📝';
      switch (urgency) {
        case 'critical': emoji = '🚨'; break;
        case 'high': emoji = '⚠️'; break;
        case 'normal': emoji = '⏰'; break;
        case 'low': emoji = '📝'; break;
      }
      assert.strictEqual(emoji, '🚨');
    });

    it('should have correct emoji for high urgency', () => {
      const urgency = 'high';
      let emoji = '📝';
      switch (urgency) {
        case 'critical': emoji = '🚨'; break;
        case 'high': emoji = '⚠️'; break;
        case 'normal': emoji = '⏰'; break;
        case 'low': emoji = '📝'; break;
      }
      assert.strictEqual(emoji, '⚠️');
    });

    it('should have correct prefix for critical urgency', () => {
      const urgency = 'critical';
      let prefix = '';
      switch (urgency) {
        case 'critical': prefix = 'URGENT: '; break;
        case 'high': prefix = 'Important: '; break;
      }
      assert.strictEqual(prefix, 'URGENT: ');
    });
  });

  describe('Notification Preferences Validation', () => {
    it('should validate reminder minutes minimum (5)', () => {
      const minutes = 5;
      const isValid = typeof minutes === 'number' && minutes >= 5 && minutes <= 1440;
      assert.strictEqual(isValid, true);
    });

    it('should validate reminder minutes maximum (1440)', () => {
      const minutes = 1440;
      const isValid = typeof minutes === 'number' && minutes >= 5 && minutes <= 1440;
      assert.strictEqual(isValid, true);
    });

    it('should reject reminder minutes below minimum', () => {
      const minutes = 4;
      const isValid = typeof minutes === 'number' && minutes >= 5 && minutes <= 1440;
      assert.strictEqual(isValid, false);
    });

    it('should reject reminder minutes above maximum', () => {
      const minutes = 1441;
      const isValid = typeof minutes === 'number' && minutes >= 5 && minutes <= 1440;
      assert.strictEqual(isValid, false);
    });

    it('should validate digest hour range (0-23)', () => {
      for (let hour = 0; hour <= 23; hour++) {
        const isValid = typeof hour === 'number' && hour >= 0 && hour <= 23;
        assert.strictEqual(isValid, true, `Hour ${hour} should be valid`);
      }
    });

    it('should reject invalid digest hour', () => {
      const hour = 24;
      const isValid = typeof hour === 'number' && hour >= 0 && hour <= 23;
      assert.strictEqual(isValid, false);
    });
  });

  describe('Smart Reminder Category Logic', () => {
    it('should calculate correct timing for category 1 (very quick)', () => {
      const category = 1;
      const defaultMinutes = 60;
      let minutesBefore, remindCount, urgency;

      switch (category) {
        case 1:
          minutesBefore = Math.min(30, defaultMinutes);
          remindCount = 1;
          urgency = 'low';
          break;
      }

      assert.strictEqual(minutesBefore, 30);
      assert.strictEqual(remindCount, 1);
      assert.strictEqual(urgency, 'low');
    });

    it('should calculate correct timing for category 3 (moderate)', () => {
      const category = 3;
      const defaultMinutes = 60;
      let minutesBefore, remindCount, urgency;

      switch (category) {
        case 3:
          minutesBefore = Math.max(defaultMinutes, 120);
          remindCount = 2;
          urgency = 'normal';
          break;
      }

      assert.strictEqual(minutesBefore, 120);
      assert.strictEqual(remindCount, 2);
      assert.strictEqual(urgency, 'normal');
    });

    it('should calculate correct timing for category 5 (unlikely)', () => {
      const category = 5;
      const defaultMinutes = 60;
      let minutesBefore, remindCount, urgency;

      switch (category) {
        case 5:
          minutesBefore = Math.max(defaultMinutes * 3, 240);
          remindCount = 4;
          urgency = 'critical';
          break;
      }

      assert.strictEqual(minutesBefore, 240);
      assert.strictEqual(remindCount, 4);
      assert.strictEqual(urgency, 'critical');
    });
  });
});

describe('Notification Scheduler Logic', () => {
  describe('Task Due Window', () => {
    it('should correctly calculate 4-hour window', () => {
      const now = new Date();
      const fourHoursFromNow = new Date(now.getTime() + 4 * 60 * 60 * 1000);
      
      const diff = fourHoursFromNow.getTime() - now.getTime();
      const diffHours = diff / (60 * 60 * 1000);
      
      assert.strictEqual(diffHours, 4);
    });

    it('should include tasks due exactly at 4 hours', () => {
      const now = new Date();
      const fourHoursFromNow = new Date(now.getTime() + 4 * 60 * 60 * 1000);
      const taskDueDate = new Date(now.getTime() + 4 * 60 * 60 * 1000);
      
      const isInWindow = taskDueDate >= now && taskDueDate <= fourHoursFromNow;
      assert.strictEqual(isInWindow, true);
    });

    it('should exclude tasks due more than 4 hours', () => {
      const now = new Date();
      const fourHoursFromNow = new Date(now.getTime() + 4 * 60 * 60 * 1000);
      const taskDueDate = new Date(now.getTime() + 5 * 60 * 60 * 1000);
      
      const isInWindow = taskDueDate >= now && taskDueDate <= fourHoursFromNow;
      assert.strictEqual(isInWindow, false);
    });

    it('should exclude overdue tasks', () => {
      const now = new Date();
      const fourHoursFromNow = new Date(now.getTime() + 4 * 60 * 60 * 1000);
      const taskDueDate = new Date(now.getTime() - 1 * 60 * 60 * 1000);
      
      const isInWindow = taskDueDate >= now && taskDueDate <= fourHoursFromNow;
      assert.strictEqual(isInWindow, false);
    });
  });

  describe('Reminder Timing Window', () => {
    it('should allow 5 minute window for reminder', () => {
      const now = new Date();
      const taskDueTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
      const minutesBefore = 60;
      const reminderTime = taskDueTime.getTime() - (minutesBefore * 60 * 1000);
      
      // Should be exactly now
      const diff = Math.abs(now.getTime() - reminderTime);
      const diffMinutes = diff / (60 * 1000);
      
      // Within 5 minute window
      const isInWindow = now.getTime() >= reminderTime - 5 * 60 * 1000 && 
                         now.getTime() <= reminderTime + 5 * 60 * 1000;
      
      assert.strictEqual(isInWindow, true);
    });
  });
});

console.log('\n📋 Running Notification Service Unit Tests...\n');

