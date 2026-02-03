/**
 * Notification System Test Script
 * 
 * Tests all notification endpoints without waiting in real-time.
 * Run with: node scripts/test-notifications.js
 * 
 * Prerequisites:
 * - Backend server running (npm start)
 * - Valid auth token (run scripts/login.ps1 to get one)
 */

import fetch from 'node-fetch';

// Configuration - Update these values
const BASE_URL = process.env.API_URL || 'http://localhost:3000/api';
const AUTH_TOKEN = process.env.AUTH_TOKEN || ''; // Get from login

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${AUTH_TOKEN}`
};

// Helper function for API calls
async function apiCall(method, endpoint, body = null) {
  const options = {
    method,
    headers,
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await response.json();
    return { status: response.status, data };
  } catch (error) {
    return { status: 500, error: error.message };
  }
}

// Test functions
const tests = {
  /**
   * Test 1: Check notification preferences
   */
  async getPreferences() {
    console.log('\n📋 TEST 1: Get Notification Preferences');
    console.log('─'.repeat(50));
    
    const result = await apiCall('GET', '/notifications/preferences');
    
    if (result.status === 200 && result.data.success) {
      console.log('✅ Successfully retrieved preferences');
      console.log('   Push enabled:', result.data.preferences?.enabled);
      console.log('   Morning digest:', result.data.preferences?.morningDigest?.enabled);
      console.log('   Task reminders:', result.data.preferences?.taskReminders?.enabled);
      console.log('   Smart reminders:', result.data.preferences?.taskReminders?.useSmartReminders);
      return { success: true, data: result.data };
    } else {
      console.log('❌ Failed to get preferences:', result.data?.error || result.error);
      return { success: false, error: result.data?.error };
    }
  },

  /**
   * Test 2: Send immediate test notification
   */
  async sendTestNotification() {
    console.log('\n📤 TEST 2: Send Test Notification');
    console.log('─'.repeat(50));
    
    const result = await apiCall('POST', '/notifications/test');
    
    if (result.status === 200 && result.data.success) {
      console.log('✅ Test notification sent successfully');
      console.log('   Check your device for the notification!');
      return { success: true };
    } else {
      console.log('❌ Failed to send test notification:', result.data?.error || result.error);
      return { success: false, error: result.data?.error };
    }
  },

  /**
   * Test 3: Test task reminder (with or without ML smart reminders)
   */
  async testTaskReminder(useSmartReminders = true) {
    console.log(`\n⏰ TEST 3: Task Reminder (Smart: ${useSmartReminders})`);
    console.log('─'.repeat(50));
    
    const result = await apiCall('POST', '/notifications/test/task-reminder', { useSmartReminders });
    
    if (result.data.success) {
      console.log('✅ Task reminder test sent');
      console.log('   Task:', result.data.task?.name);
      console.log('   Importance:', result.data.task?.importance);
      console.log('   Pre-calculated Prediction:', result.data.task?.predictedCompletionCategory || 'N/A');
      console.log('   Scheduling source:', result.data.scheduling?.source);
      console.log('   Has schedule:', result.data.scheduling?.hasSchedule);
      console.log('   Timing:', JSON.stringify(result.data.timing, null, 2));
      console.log('   Notification title:', result.data.notification?.title);
      console.log('   Notification body:', result.data.notification?.body);
      return { success: true, data: result.data };
    } else {
      console.log('❌ Failed to test task reminder:', result.data?.error || result.error);
      return { success: false, error: result.data?.error };
    }
  },

  /**
   * Test 3b: Test subtask reminder (with or without ML smart reminders)
   */
  async testSubtaskReminder(useSmartReminders = true) {
    console.log(`\n📋 TEST 3b: Subtask Reminder (Smart: ${useSmartReminders})`);
    console.log('─'.repeat(50));
    
    const result = await apiCall('POST', '/notifications/test/subtask-reminder', { useSmartReminders });
    
    if (result.data.success) {
      console.log('✅ Subtask reminder test sent');
      console.log('   Parent Task:', result.data.parentTask?.name);
      console.log('   Subtask:', `#${result.data.subtask?.index} - ${result.data.subtask?.title}`);
      console.log('   Pre-calculated Prediction:', result.data.parentTask?.predictedCompletionCategory || 'N/A');
      console.log('   Scheduling source:', result.data.scheduling?.source);
      console.log('   Has schedule:', result.data.scheduling?.hasSchedule);
      console.log('   Timing:', JSON.stringify(result.data.timing, null, 2));
      console.log('   Notification title:', result.data.notification?.title);
      console.log('   Notification body:', result.data.notification?.body);
      return { success: true, data: result.data };
    } else {
      console.log('❌ Failed to test subtask reminder:', result.data?.error || result.error);
      console.log('   Hint:', result.data?.hint || 'Create a task with subtasks first');
      return { success: false, error: result.data?.error };
    }
  },

  /**
   * Test 4: Test smart reminder calculation (no actual notification sent)
   */
  async testSmartReminderCalc(taskId = null) {
    console.log('\n🧠 TEST 4: Smart Reminder Calculation (ML Prediction)');
    console.log('─'.repeat(50));
    
    const result = await apiCall('POST', '/notifications/test/smart-reminder', { taskId });
    
    if (result.data.success) {
      console.log('✅ Smart reminder calculation completed');
      console.log('   Task:', result.data.task?.name);
      console.log('   Category:', result.data.task?.category);
      console.log('   Pre-calculated Prediction:', result.data.task?.predictedCompletionCategory || 'N/A');
      console.log('   ML Prediction Source:', result.data.mlPrediction?.source);
      console.log('   ML Category:', result.data.mlPrediction?.category);
      console.log('   Interpretation:', result.data.mlPrediction?.interpretation);
      console.log('\n   📅 Scheduling:');
      console.log('   Source:', result.data.scheduling?.source);
      console.log('   Has schedule:', result.data.scheduling?.hasSchedule);
      console.log('   Reminder date:', result.data.scheduling?.reminderDate);
      console.log('\n   📋 Subtasks:', result.data.subtasks?.length || 0);
      if (result.data.subtasks?.length > 0) {
        result.data.subtasks.forEach(st => {
          console.log(`      #${st.index}: ${st.title} (${st.status}, ${st.minutes || 0}min)`);
        });
      }
      console.log('\n   📊 Comparison:');
      console.log('   Smart timing:', JSON.stringify(result.data.comparison?.smart?.timing, null, 2));
      console.log('   Default timing:', JSON.stringify(result.data.comparison?.default?.timing, null, 2));
      return { success: true, data: result.data };
    } else {
      console.log('❌ Failed to calculate smart reminder:', result.data?.error || result.error);
      return { success: false, error: result.data?.error };
    }
  },

  /**
   * Test 5: Test morning digest
   */
  async testMorningDigest() {
    console.log('\n🌅 TEST 5: Morning Digest');
    console.log('─'.repeat(50));
    
    const result = await apiCall('POST', '/notifications/test/morning-digest');
    
    if (result.data.success) {
      console.log('✅ Morning digest test triggered');
      console.log('   Results:', JSON.stringify(result.data.result, null, 2));
      return { success: true, data: result.data };
    } else {
      console.log('❌ Failed to trigger morning digest:', result.data?.error || result.error);
      return { success: false, error: result.data?.error };
    }
  },

  /**
   * Test 6: Start periodic test mode (notifications every minute)
   */
  async startPeriodicTest() {
    console.log('\n🔄 TEST 6: Start Periodic Test Mode');
    console.log('─'.repeat(50));
    
    const result = await apiCall('POST', '/notifications/test/start');
    
    if (result.data.success) {
      console.log('✅ Periodic test mode started');
      console.log('   You will receive notifications every minute');
      console.log('   Run "stopPeriodicTest" to stop');
      return { success: true };
    } else {
      console.log('❌ Failed to start periodic test:', result.data?.error || result.error);
      return { success: false, error: result.data?.error };
    }
  },

  /**
   * Test 7: Stop periodic test mode
   */
  async stopPeriodicTest() {
    console.log('\n🛑 TEST 7: Stop Periodic Test Mode');
    console.log('─'.repeat(50));
    
    const result = await apiCall('POST', '/notifications/test/stop');
    
    if (result.data.success) {
      console.log('✅ Periodic test mode stopped');
      return { success: true };
    } else {
      console.log('❌ Failed to stop periodic test:', result.data?.error || result.error);
      return { success: false, error: result.data?.error };
    }
  },

  /**
   * Test 8: Check test mode status
   */
  async checkTestStatus() {
    console.log('\n📊 TEST 8: Check Test Mode Status');
    console.log('─'.repeat(50));
    
    const result = await apiCall('GET', '/notifications/test/status');
    
    console.log('   Test mode active:', result.data.testModeActive);
    return { success: true, active: result.data.testModeActive };
  },

  /**
   * Test 9: Update notification preferences
   */
  async updatePreferences(preferences) {
    console.log('\n⚙️ TEST 9: Update Notification Preferences');
    console.log('─'.repeat(50));
    
    const result = await apiCall('PUT', '/notifications/preferences', preferences);
    
    if (result.data.success) {
      console.log('✅ Preferences updated successfully');
      return { success: true };
    } else {
      console.log('❌ Failed to update preferences:', result.data?.error || result.error);
      return { success: false, error: result.data?.error };
    }
  }
};

// Run all tests
async function runAllTests() {
  console.log('═'.repeat(60));
  console.log('🔔 NOTIFICATION SYSTEM TEST SUITE');
  console.log('═'.repeat(60));

  if (!AUTH_TOKEN) {
    console.log('\n❌ ERROR: No auth token provided!');
    console.log('   Set AUTH_TOKEN environment variable or update this script');
    console.log('   Example: $env:AUTH_TOKEN="your-token"; node scripts/test-notifications.js');
    process.exit(1);
  }

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  // Run tests
  const testSequence = [
    { name: 'Get Preferences', fn: () => tests.getPreferences() },
    { name: 'Send Test Notification', fn: () => tests.sendTestNotification() },
    { name: 'Task Reminder (Smart)', fn: () => tests.testTaskReminder(true) },
    { name: 'Task Reminder (Default)', fn: () => tests.testTaskReminder(false) },
    { name: 'Subtask Reminder (Smart)', fn: () => tests.testSubtaskReminder(true) },
    { name: 'Subtask Reminder (Default)', fn: () => tests.testSubtaskReminder(false) },
    { name: 'Smart Reminder Calculation', fn: () => tests.testSmartReminderCalc() },
    { name: 'Morning Digest', fn: () => tests.testMorningDigest() },
    { name: 'Check Test Status', fn: () => tests.checkTestStatus() },
  ];

  for (const test of testSequence) {
    try {
      const result = await test.fn();
      if (result.success) {
        results.passed++;
        results.tests.push({ name: test.name, status: 'PASSED' });
      } else {
        results.failed++;
        results.tests.push({ name: test.name, status: 'FAILED', error: result.error });
      }
    } catch (error) {
      results.failed++;
      results.tests.push({ name: test.name, status: 'ERROR', error: error.message });
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('═'.repeat(60));
  console.log(`   Total: ${results.passed + results.failed}`);
  console.log(`   ✅ Passed: ${results.passed}`);
  console.log(`   ❌ Failed: ${results.failed}`);
  console.log('\n   Results:');
  results.tests.forEach(t => {
    const icon = t.status === 'PASSED' ? '✅' : '❌';
    console.log(`   ${icon} ${t.name}: ${t.status}${t.error ? ` (${t.error})` : ''}`);
  });

  return results;
}

// Interactive mode functions
async function interactiveTest(testName) {
  switch (testName) {
    case 'prefs':
      return tests.getPreferences();
    case 'test':
      return tests.sendTestNotification();
    case 'reminder':
      return tests.testTaskReminder(true);
    case 'reminder-default':
      return tests.testTaskReminder(false);
    case 'subtask':
      return tests.testSubtaskReminder(true);
    case 'subtask-default':
      return tests.testSubtaskReminder(false);
    case 'smart':
      return tests.testSmartReminderCalc();
    case 'digest':
      return tests.testMorningDigest();
    case 'start':
      return tests.startPeriodicTest();
    case 'stop':
      return tests.stopPeriodicTest();
    case 'status':
      return tests.checkTestStatus();
    case 'all':
      return runAllTests();
    default:
      console.log('Available tests: prefs, test, reminder, reminder-default, subtask, subtask-default, smart, digest, start, stop, status, all');
  }
}

// Main execution
const args = process.argv.slice(2);
const testArg = args[0] || 'all';

console.log(`Running: ${testArg}`);
interactiveTest(testArg).then(() => {
  console.log('\nDone!');
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
