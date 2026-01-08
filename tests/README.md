# ML Integration Tests

This directory contains automated tests for the complete ML prediction system.

## Test Files

### MLconversion.test.js
**Comprehensive end-to-end ML integration test**

Tests the complete workflow from backend to ML model:
1. **System Health Check** - Verifies ML service is running
2. **User Setup** - Creates test users with isolated models
3. **Task Creation** - Tests automatic predictions on task save
4. **Work Session Tracking** - Validates actual work time calculation
5. **Task Completion** - Tests automatic ML training on completion
6. **Model Learning** - Verifies predictions improve after training
7. **Priority Scoring** - Tests ML influence on task prioritization
8. **Feature Extraction** - Validates 5 inputs → 28 features conversion
9. **Multi-User Isolation** - Confirms per-user model separation

## Running Tests

```bash
# Run full ML integration test
node tests/MLconversion.test.js
```

## Expected Output

✅ All 9 tests should pass, showing:
- Model files created automatically on first task
- Predictions change dramatically after training (e.g., 0.197 → 0.686)
- Per-user models remain isolated
- actualCompletionMinutes calculated correctly from work sessions
- Reward-based learning working (0-1 scale based on estimation accuracy)

## What Gets Tested

### Automatic Model Creation
- User creates first task → Model file automatically generated
- Location: `src/predict_model/user_models/model_{userId}.pkl`
- Size: ~13 KB per user

### Prediction Workflow
- Task created/modified → pre-save hook triggers
- Calls `predictTask()` → Python ML service
- Returns: score (0-1) + category (1-5)
- Stored in task: `predictionScore`, `predictedCompletionCategory`

### Training Workflow
- Task completed → `completeTask()` function
- Calculates `actualCompletionMinutes` from TaskSchedule sessions
- Calls `trainTask()` → Python ML service with reward
- Reward formula: `1.0 / (1.0 + 2.0 * |log(actual/estimated)|)`
- Model updates weights using LinUCB algorithm

### Learning Verification
- Before training: Low confidence, category 5 (uncertain)
- After 2 completions: High confidence, category 2 (fairly confident)
- Improvement: +248% average confidence increase
- Demonstrates fast learning capability

## Test Data Cleanup

The test automatically:
- Creates test users: `mltest@automated.com`, `mltest2@automated.com`
- Creates temporary tasks and work sessions
- Cleans up test tasks after completion
- Keeps test users and model files for future testing

## Troubleshooting

**Test fails at health check:**
- Ensure MongoDB is running
- Check Python environment has required packages

**Model files not created:**
- Check `src/predict_model/user_models/` directory exists
- Verify write permissions

**Predictions not changing:**
- Ensure tasks are being completed (not just created)
- Check actualCompletionMinutes is being calculated
- Verify trainTask() is being called

## Key Metrics from Test

From successful test run:
- **New user predictions**: 0.197-0.224 (category 5 - uncertain)
- **After 2 completions**: 0.686-0.707 (category 2 - confident)
- **Reward for accurate estimates**: 0.733 (good accuracy)
- **Per-user isolation**: 0.553 prediction difference for identical tasks

## Architecture Verified

```
Task Create → pre-save hook → predictTask() → Python ML
     ↓                                              ↓
  MongoDB                                    Load/Create Model
                                                    ↓
                                            28 Features → LinUCB
                                                    ↓
                                         Return (score, category)
     ↓
Task Complete → completeTask() → trainTask() → Python ML
     ↓                               ↓              ↓
Calculate actualCompletionMinutes → Calculate reward
                                                    ↓
                                           Update Model Weights
                                                    ↓
                                              Save model_{userId}.pkl
```

## Future Enhancements

Consider adding tests for:
- Model performance after 10+ completions
- Category-specific learning patterns
- Reward calculation edge cases
- Model file size growth over time
- Concurrent user training (race conditions)
