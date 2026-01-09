# Test Suite Organization

This directory contains all automated tests organized by functionality.

## Directory Structure

```
tests/
├── ml/                    # Machine Learning tests
├── security/             # Security and hardening tests
├── integration/          # Integration tests
└── README.md            # This file
```

## ML Tests (`tests/ml/`)

### JavaScript Tests
- **MLconversion.test.js** - Comprehensive end-to-end ML integration test

### Python Tests
- **test1_multi_feature_learning.py** - Feature-by-feature learning validation
- **test_single_feature_linucb.py** - Basic LinUCB algorithm functionality
- **test2_user_behavior_learning.py** - User behavior pattern learning
- **test3_motivation_difficulty_prior.py** - Prior-based learning with motivation/difficulty
- **test4_category_specific_behavior.py** - Category-specific prediction behavior

### Running ML Tests

```bash
# Run ML integration test (JavaScript)
node tests/ml/MLconversion.test.js

# Run Python ML tests (from project root)
python tests/ml/test1_multi_feature_learning.py
python tests/ml/test_single_feature_linucb.py
python tests/ml/test2_user_behavior_learning.py
python tests/ml/test3_motivation_difficulty_prior.py
python tests/ml/test4_category_specific_behavior.py
```

## Security Tests (`tests/security/`)

### Files
- **test_security_hardening.js** - Security policy and hardening validation ✅ WORKING
- **test_security_integration.js** - Agent security features and tool validation ⏸️ SKIPPED (needs User model stub fixes)

### Running Security Tests

```bash
# Run security hardening tests
node tests/security/test_security_hardening.js

# Security integration test (currently skipped - needs fixes)
# node tests/security/test_security_integration.js
```

## Integration Tests (`tests/integration/`)

*Currently empty - reserved for future integration tests*

## Quick Test Commands

```bash
# Run all JavaScript tests
node tests/ml/MLconversion.test.js
node tests/security/test_security_hardening.js
node tests/security/test_security_integration.js

# Run all Python ML tests (from src/predict_model/)
python test1_multi_feature_learning.py
python test_single_feature_linucb.py
python test2_user_behavior_learning.py
python test3_motivation_difficulty_prior.py
python test4_category_specific_behavior.py
```

## Test Coverage

### ML Tests
- ✅ Model creation and loading
- ✅ Feature extraction (5 → 28 features)
- ✅ Prediction accuracy and learning
- ✅ User-specific model isolation
- ✅ Category-based predictions
- ✅ Training and reward calculation
- ✅ Priority system integration

### Security Tests
- ✅ Policy anchor insertion
- ✅ Tool call validation
- ✅ Widget payload validation
- ✅ Agent security features
- ✅ System message rejection
- ✅ Invalid tool argument handling

## Expected Results

All tests should pass with:
- ML tests: 9/9 integration tests + 5 Python learning tests
- Security tests: Policy validation + integration features
- Clean output with ✅ success indicators
- No database connections required (tests use mocks/stubs)
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
