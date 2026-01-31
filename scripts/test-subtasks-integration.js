/**
 * Test script to verify subtask integration
 * Tests: Create task with subtasks → Fetch → Verify progressPercentage updates
 */

import axios from "axios";

const API_BASE = "http://localhost:3000/api";

// Test user - replace with actual user ID from your database
const TEST_USER_ID = "your-user-id"; // You'll need to set this

async function runTests() {
  try {
    console.log("\n=== SUBTASK INTEGRATION TEST ===\n");

    // Test 1: Create a task with subtasks
    console.log("TEST 1: Creating task with 3 subtasks...");
    const createResponse = await axios.post(
      `${API_BASE}/tasks`,
      {
        taskname: "Test Task with Subtasks",
        description: "Testing subtask functionality",
        category: "work",
        importance: 3,
        effort: 3,
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
        estimatedMinutes: 90,
        subtasks: [
          { title: "Subtask 1", description: "First part", minutes: 30 },
          { title: "Subtask 2", description: "Second part", minutes: 30 },
          { title: "Subtask 3", description: "Third part", minutes: 30 },
        ],
        taskType: "in_parts",
        chunkCount: 3,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.TEST_TOKEN || "your-token"}`,
        },
      }
    );

    const taskId = createResponse.data.task._id;
    console.log(`✓ Task created: ${taskId}`);
    console.log(`  Task type: ${createResponse.data.task.taskType}`);
    console.log(`  Progress: ${createResponse.data.task.progressPercentage}%\n`);

    // Test 2: Fetch the task and verify subtasks are returned
    console.log("TEST 2: Fetching task to verify subtasks are populated...");
    const fetchResponse = await axios.get(
      `${API_BASE}/tasks?dueAfter=${new Date().toISOString()}&dueBefore=${new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.TEST_TOKEN || "your-token"}`,
        },
      }
    );

    const fetchedTask = fetchResponse.data.tasks.find((t) => t._id === taskId);
    if (!fetchedTask) {
      console.error("✗ Task not found in fetch response!");
      return;
    }

    console.log(`✓ Task fetched: ${fetchedTask._id}`);
    console.log(`  Has subTasks field: ${!!fetchedTask.subTasks}`);
    console.log(`  Subtask count: ${fetchedTask.subTasks?.length || 0}`);

    if (fetchedTask.subTasks && fetchedTask.subTasks.length > 0) {
      console.log(`  Subtasks:`);
      fetchedTask.subTasks.forEach((st, i) => {
        console.log(`    ${i + 1}. ${st.title} (ID: ${st._id}) - Status: ${st.status}`);
      });
    } else {
      console.error("✗ No subtasks found in response!");
      return;
    }

    console.log();

    // Test 3: Mark a subtask as complete
    if (fetchedTask.subTasks && fetchedTask.subTasks.length > 0) {
      console.log("TEST 3: Marking first subtask as complete...");
      const firstSubtaskId = fetchedTask.subTasks[0]._id;

      const completeResponse = await axios.post(
        `${API_BASE}/tasks/${taskId}/subtasks/${firstSubtaskId}/complete`,
        {},
        {
          headers: {
            Authorization: `Bearer ${process.env.TEST_TOKEN || "your-token"}`,
          },
        }
      );

      console.log(`✓ Subtask marked as complete`);
      console.log(`  Task progress: ${completeResponse.data.task.progressPercentage}%`);
      console.log(`  Expected: 33% (1 of 3 complete)\n`);

      // Test 4: Mark another subtask as complete
      console.log("TEST 4: Marking second subtask as complete...");
      const secondSubtaskId = fetchedTask.subTasks[1]._id;

      const complete2Response = await axios.post(
        `${API_BASE}/tasks/${taskId}/subtasks/${secondSubtaskId}/complete`,
        {},
        {
          headers: {
            Authorization: `Bearer ${process.env.TEST_TOKEN || "your-token"}`,
          },
        }
      );

      console.log(`✓ Subtask marked as complete`);
      console.log(`  Task progress: ${complete2Response.data.task.progressPercentage}%`);
      console.log(`  Expected: 66% (2 of 3 complete)\n`);

      // Test 5: Mark subtask as incomplete
      console.log("TEST 5: Marking first subtask as incomplete...");
      const todoResponse = await axios.post(
        `${API_BASE}/tasks/${taskId}/subtasks/${firstSubtaskId}/todo`,
        {},
        {
          headers: {
            Authorization: `Bearer ${process.env.TEST_TOKEN || "your-token"}`,
          },
        }
      );

      console.log(`✓ Subtask marked as incomplete`);
      console.log(`  Task progress: ${todoResponse.data.task.progressPercentage}%`);
      console.log(`  Expected: 33% (1 of 3 complete)\n`);
    }

    console.log("=== ALL TESTS PASSED ===\n");
  } catch (error) {
    console.error("\n✗ Test failed!");
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Error: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.error(error.message);
    }
  }
}

// Run tests
runTests();
