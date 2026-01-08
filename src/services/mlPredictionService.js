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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to Python model service
const PYTHON_SERVICE_PATH = path.join(__dirname, '../predict_model/model_service.py');

// Timeout for Python subprocess (ms)
const SUBPROCESS_TIMEOUT = 5000;

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

    const pythonProcess = spawn('python', args);
    
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

    // Convert Task to ML input format
    const mlInput = taskToMLInput(task);

    // Call Python service with userId and task data
    const userId = task.userId.toString();
    const jsonInput = JSON.stringify(mlInput);
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

    // Convert Task to ML input format
    const mlInput = taskToMLInput(task);

    // Calculate reward signal
    const reward = calculateReward(task.estimatedDuration, task.actualCompletionMinutes);
    
    if (reward === undefined) {
      throw new Error('Invalid reward calculation');
    }

    // Call Python service with userId, task input, and reward
    const userId = task.userId.toString();
    const jsonInput = JSON.stringify(mlInput);
    const result = await callPythonService('train', [userId, jsonInput, String(reward)]);

    if (!result.success) {
      throw new Error(result.error || 'Training failed');
    }

    return {
      success: true,
      reward: result.reward,
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

export default {
  predictTask,
  trainTask,
  checkHealth,
};
