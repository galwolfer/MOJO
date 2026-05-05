/**
 * ML Prediction Service
 * 
 * Bridges Node.js backend with Python ML model service.
 * Spawns Python subprocess to handle predictions and training.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { taskToMLInput, calculateReward } from '../utils/mlInputConverter.js';
import { Subcategory } from '../models/Subcategory.js';
import { TaskSchedule } from '../models/TaskSchedule.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to Python model service
const PYTHON_SERVICE_PATH = path.join(__dirname, '../predict_model/model_service.py');

// Timeout for Python subprocess (ms)
const SUBPROCESS_TIMEOUT = 5000;

async function hydrateTaskSubcategory(task) {
  if (!task || !task.subCategory) return task;
  if (typeof task.subCategory === "object" && (task.subCategory.name || task.subCategory.label)) {
    task.subCategoryLabel = task.subCategory.name || task.subCategory.label;
    return task;
  }
  try {
    const sub = await Subcategory.findById(task.subCategory).lean();
    if (sub) {
      task.subCategory = sub;
      task.subCategoryLabel = sub.name;
    }
  } catch (err) {
    // Non-fatal: leave task as-is
  }
  return task;
}

/**
 * Build subcategory map from user's custom subcategories
 * 
 * Converts Subcategory collection entries to the format expected by Python:
 * { "work_and_career": ["Deep Work", "Meetings"], "workout": ["HIIT", "Cardio"], ... }
 * 
 * The Python model will use model.add_subcategory() to sync these with its internal
 * feature space, dynamically expanding n_features as needed.
 * 
 * @param {string} userId - User ID to fetch subcategories for
 * @returns {Promise<Object>} Subcategory map grouped by category string keys
 */
async function buildSubcategoryMap(userId) {
  try {
    const subs = await Subcategory.find({ userId }).lean();
    if (!subs || subs.length === 0) {
      return {}; // No custom subcategories
    }

    const subcategoryMap = {};

    for (const sub of subs) {
      const categoryKey = sub.parent;
      if (!categoryKey) continue;

      if (!subcategoryMap[categoryKey]) {
        subcategoryMap[categoryKey] = new Set();
      }

      if (sub.name) {
        subcategoryMap[categoryKey].add(sub.name);
      }
    }

    const normalizedMap = {};
    for (const [key, value] of Object.entries(subcategoryMap)) {
      normalizedMap[key] = Array.from(value);
    }

    return normalizedMap;
  } catch (error) {
    console.error('❌ Error building subcategory map:', error.message);
    return {}; // Return empty map on error, don't fail prediction
  }
}

/**
 * Call Python model service with a command and JSON input
 * 
 * @param {string} command - 'predict', 'train', or 'health'
 * @param {string|string[]} jsonInput - JSON string or array of args to pass to Python
 * @returns {Promise<Object>} Parsed JSON response from Python
 * @throws {Error} If subprocess fails or times out
 */
async function callPythonService(command, jsonInput = null) {
  return new Promise((resolve, reject) => {
    const args = [PYTHON_SERVICE_PATH, command];
    if (jsonInput) {
      if (Array.isArray(jsonInput)) {
        args.push(...jsonInput);
      } else {
        args.push(jsonInput);
      }
    }

    const pythonProcess = spawn('python3', args);
    
    let stdout = '';
    let stderr = '';
    let timeoutHandle;

    // Set timeout for subprocess
    timeoutHandle = setTimeout(() => {
      pythonProcess.kill('SIGTERM');
      reject(new Error(`Python subprocess timed out after ${SUBPROCESS_TIMEOUT}ms`));
    }, SUBPROCESS_TIMEOUT);

    // Collect stdout
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    // Collect stderr (for logging, not errors)
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Handle process completion
    pythonProcess.on('close', (code) => {
      clearTimeout(timeoutHandle);

      // Log stderr (model loading messages, etc.)
      if (stderr) {
        console.log('[ML Service]:', stderr.trim());
      }

      if (code !== 0) {
        reject(new Error(`Python process exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (err) {
        reject(new Error(`Failed to parse Python output: ${stdout}`));
      }
    });

    // Handle process errors (e.g., Python not found)
    pythonProcess.on('error', (err) => {
      clearTimeout(timeoutHandle);
      reject(new Error(`Failed to spawn Python process: ${err.message}`));
    });
  });
}

/**
 * Get prediction for a task
 * 
 * @param {Object} task - Task document from MongoDB (must have userId field)
 * @returns {Promise<Object>} {score: 0-1, category: 1-5, success: boolean}
 */
export async function predictTask(task) {
  try {
    // Validate userId exists
    if (!task.userId) {
      throw new Error('Task must have userId for per-user ML predictions');
    }

    await hydrateTaskSubcategory(task);
    // Convert Task to ML input format
    const mlInput = taskToMLInput(task);

    // Build subcategory map from user's custom subcategories
    const userId = task.userId.toString();
    const subcategoryMap = await buildSubcategoryMap(userId);

    // Prepare payload: task input + subcategory_map
    const payload = {
      task: mlInput,
      subcategory_map: subcategoryMap
    };

    // Call Python service with userId and payload
    const jsonInput = JSON.stringify(payload);
    const result = await callPythonService('predict', [userId, jsonInput]);

    if (!result.success) {
      throw new Error(result.error || 'Prediction failed');
    }

    return {
      score: result.score,
      category: result.category,
      success: true,
    };

  } catch (error) {
    console.error('❌ ML Prediction error:', error.message);
    
    // Return rule-based fallback defaults
    return {
      score: 0.5,          // Neutral confidence
      category: 3,         // Medium difficulty
      success: false,
      fallback: true,
      error: error.message,
    };
  }
}

/**
 * Train the model with completed task data
 * 
 * @param {Object} task - Task document with actualCompletionMinutes (must have userId)
 * @returns {Promise<Object>} {success: boolean, message?: string}
 */
export async function trainTask(task) {
  try {
    // Validate userId exists
    if (!task.userId) {
      throw new Error('Task must have userId for per-user ML training');
    }

    // Validate task has required fields
    if (task.estimatedDuration === undefined || task.actualCompletionMinutes === undefined) {
      throw new Error('Task missing estimatedDuration or actualCompletionMinutes');
    }

    // Get userId early - needed for both deadline reward and training
    const userId = task.userId.toString();

    await hydrateTaskSubcategory(task);
    // Convert Task to ML input format
    const mlInput = taskToMLInput(task);

    // Calculate reward signal - prefer deadline-based, fallback to estimation-based
    let reward;
    let rewardType = 'estimation'; // Track which method was used
    
    // Try deadline-based reward if we have schedule and deadline
    if (task.dueDate) {
      try {
        // Find the earliest scheduled session for this task
        const scheduledSession = await TaskSchedule.findOne({
          taskId: task._id,
          status: 'completed'
        }).sort({ start: 1 }).lean();

        if (scheduledSession) {
          // Call Python's calculate_deadline_reward method
          const completedAt = new Date(); // Task just completed
          const scheduledAt = scheduledSession.start;
          const deadline = task.dueDate;
          
          // Convert to Unix timestamps (seconds)
          const completedTs = completedAt.getTime() / 1000;
          const scheduledTs = scheduledAt.getTime() / 1000;
          const deadlineTs = deadline.getTime() / 1000;
          
          // Call Python model service to calculate deadline reward
          const rewardResult = await callPythonService('calculate_deadline_reward', [
            userId,
            String(completedTs),
            String(scheduledTs),
            String(deadlineTs)
          ]);
          
          if (rewardResult.success && rewardResult.reward !== undefined) {
            reward = rewardResult.reward;
            rewardType = 'deadline';
            console.log(`  Using deadline-based reward: ${reward.toFixed(3)} (completed: ${completedAt.toISOString()}, scheduled: ${scheduledAt.toISOString()}, deadline: ${deadline.toISOString()})`);
          }
        }
      } catch (err) {
        console.warn(`  Could not calculate deadline-based reward: ${err.message}`);
      }
    }
    
    // Fallback to estimation-based reward
    if (reward === undefined) {
      reward = calculateReward(task.estimatedDuration, task.actualCompletionMinutes);
      rewardType = 'estimation';
      
      if (reward === undefined) {
        throw new Error('Invalid reward calculation');
      }
      
      console.log(`  Using estimation-based reward: ${reward.toFixed(3)} (estimated: ${task.estimatedDuration}min, actual: ${task.actualCompletionMinutes}min)`);
    }

    // Build subcategory map from user's custom subcategories
    const subcategoryMap = await buildSubcategoryMap(userId);

    // Prepare payload: task input + subcategory_map
    const payload = {
      task: mlInput,
      subcategory_map: subcategoryMap
    };

    // Structured log: Emit training request details (for debugging/monitoring)
    try {
      console.log(JSON.stringify({
        event: 'ml_train_request',
        userId,
        taskId: String(task._id),
        reward: reward,
        rewardType,
        mlInput,
      }));
    } catch (err) {
      // Fallback logging
      console.log('[ml_train_request] userId=%s taskId=%s reward=%s rewardType=%s', userId, String(task._id), reward, rewardType);
    }

    // Call Python service with userId, payload, and reward
    const jsonInput = JSON.stringify(payload);
    const result = await callPythonService('train', [userId, jsonInput, String(reward)]);

    // Structured log: Emit training result
    try {
      console.log(JSON.stringify({
        event: 'ml_train_result',
        userId,
        taskId: String(task._id),
        success: !!result.success,
        returnedReward: result.reward,
        message: result.message,
      }));
    } catch (err) {
      console.log('[ml_train_result] userId=%s taskId=%s success=%s returnedReward=%s', userId, String(task._id), !!result.success, result.reward);
    }

    if (!result.success) {
      throw new Error(result.error || 'Training failed');
    }

    return {
      success: true,
      reward: result.reward,
      rewardType, // 'deadline' or 'estimation'
      message: result.message || 'Model trained successfully',
    };

  } catch (error) {
    console.error('❌ ML Training error:', error.message);
    
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Check if ML service is healthy
 * 
 * @returns {Promise<Object>} Health status
 */
export async function checkHealth() {
  try {
    const result = await callPythonService('health');
    return {
      healthy: result.status === 'healthy',
      ...result,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
    };
  }
}

export async function callPythonServiceWrapper(command, jsonInput = null) {
  // Backward-compatible wrapper (tests can import callPythonService directly if needed)
  return callPythonService(command, jsonInput);
}

export { callPythonService };

export default {
  predictTask,
  trainTask,
  checkHealth,
};
