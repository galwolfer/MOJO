# ML System Monitoring & Error Handling Guide

## 🛡️ Production-Ready Error Handling

The ML system now includes comprehensive error handling and monitoring to catch edge cases in production.

## ✅ What's Protected

### 1. **Prediction Failures (Task.pre('save') hook)**

**Location:** `src/models/Task.js`

**Protection:**
- ✅ Validates prediction response structure
- ✅ Catches Python subprocess timeouts
- ✅ Logs detailed error context (taskId, userId, error stack)
- ✅ **Never breaks task creation** - predictions are optional

**What Gets Logged:**
```javascript
⚠️  ML Prediction failed (task will save without predictions): {
  taskId: "...",
  userId: "...",
  error: "Python subprocess timed out after 5000ms",
  stack: "at callPythonService..."
}
```

**Monitoring:** Check for tasks with `predictionScore === undefined`

---

### 2. **Training Failures (completeTask function)**

**Location:** `src/services/taskService.js`

**Protection:**
- ✅ Warns if actualCompletionMinutes = 0 (no sessions tracked)
- ✅ Validates training result success status
- ✅ Catches Python subprocess crashes
- ✅ Logs comprehensive error details
- ✅ **Never breaks task completion** - training is optional

**What Gets Logged:**
```javascript
⚠️  Task completed with 0 minutes tracked: {
  taskId: "...",
  taskname: "...",
  estimatedDuration: 60,
  sessionCount: 0
}

❌ ML training error (task still completed): {
  taskId: "...",
  taskname: "...",
  error: "Model file corrupted",
  stack: "at pickle.load..."
}
```

**Monitoring:** Check for tasks with `actualCompletionMinutes === 0`

---

### 3. **Data Validation (mlInputConverter)**

**Location:** `src/utils/mlInputConverter.js`

**Protection:**
- ✅ Validates task object exists
- ✅ Validates required fields (userId, estimatedDuration)
- ✅ Validates field ranges (importance 1-5, effort 1-5)
- ✅ Provides safe defaults for invalid values
- ✅ Throws clear error messages for debugging

**What Gets Logged:**
```javascript
⚠️  Task has invalid importance: undefined, defaulting to 3
⚠️  Task has invalid effort: 7, defaulting to 3

Error: Task has invalid estimatedDuration: -10 (taskId: 507f1f77bcf86cd799439011)
```

**Monitoring:** Watch for validation warnings in logs

---

## 📊 Key Metrics to Monitor

### 1. **Prediction Success Rate**
```javascript
// Query tasks without predictions
const noPredictions = await Task.countDocuments({
  createdAt: { $gte: new Date(Date.now() - 86400000) }, // Last 24h
  predictionScore: { $exists: false }
});
```

**Expected:** <5% failure rate  
**Action if >10%:** Check Python service health, subprocess timeout settings

---

### 2. **Training Success Rate**
```javascript
// Query completed tasks with 0 minutes
const zeroMinutes = await Task.countDocuments({
  status: 'done',
  updatedAt: { $gte: new Date(Date.now() - 86400000) },
  actualCompletionMinutes: 0
});
```

**Expected:** <10% (users might complete without tracking)  
**Action if >20%:** Check TaskSchedule creation workflow

---

### 3. **Model Learning Effectiveness**
```javascript
// Average prediction score change over time for a user
const userTasks = await Task.find({ userId })
  .sort({ createdAt: 1 })
  .select('predictionScore predictedCompletionCategory');

// Should see improvement: early tasks ~0.2, later tasks ~0.7
```

**Expected:** Confidence increases with completions  
**Action if flat:** Check reward calculation, feature engineering

---

## 🚨 Critical Errors to Alert On

### **Error 1: Python Subprocess Timeout**
```
Python subprocess timed out after 5000ms
```
**Cause:** Model loading/prediction taking too long  
**Action:** 
- Check model file size (should be ~13 KB)
- Increase timeout in `mlPredictionService.js`
- Check Python environment performance

---

### **Error 2: Model File Corrupted**
```
pickle.load() error: invalid format
```
**Cause:** Concurrent writes, disk corruption, incomplete save  
**Action:**
- Delete corrupted model file: `user_models/model_{userId}.pkl`
- Let system recreate on next prediction
- Investigate concurrent training (race conditions)

---

### **Error 3: Invalid Task Data**
```
Task has invalid estimatedDuration: -10
```
**Cause:** Frontend validation failed, database corruption  
**Action:**
- Fix validation on frontend/API layer
- Add database constraints
- Reject invalid task creation

---

## 🔍 Debugging Checklist

### **Predictions Not Working?**
1. ✅ Check MongoDB connection
2. ✅ Check Python executable path
3. ✅ Verify `model_service.py` exists
4. ✅ Test health check: `node -e "import('./src/services/mlPredictionService.js').then(s => s.checkHealth().then(console.log))"`
5. ✅ Check logs for timeout errors

### **Training Not Improving Predictions?**
1. ✅ Verify actualCompletionMinutes > 0
2. ✅ Check reward calculation: should be 0.5-1.0 for good estimates
3. ✅ Confirm model file timestamp updates after completion
4. ✅ Test with similar tasks (same category, importance, effort)
5. ✅ Check if user has enough completions (need 2+ for noticeable improvement)

### **Model Files Growing Too Large?**
1. ✅ Check user completion count: `Task.countDocuments({ userId, status: 'done' })`
2. ✅ Model size should stay ~13 KB regardless of completions (LinUCB is constant size)
3. ✅ If growing: Check for data leaks in model serialization

---

## 📈 Performance Benchmarks

From automated testing:

| Metric | Value | Notes |
|--------|-------|-------|
| Prediction latency | <500ms | Including subprocess spawn |
| Training latency | <1000ms | Including file save |
| Model file size | ~13 KB | Per user, constant |
| Learning speed | 2 completions | For category 5 → 2 improvement |
| Confidence gain | +248% | Average after 2 completions |
| Per-user isolation | 100% | 0.553 prediction diff for identical tasks |

---

## 🛠️ Recovery Procedures

### **Scenario 1: All Predictions Failing**
```bash
# Check Python service health
node -e "import('./src/services/mlPredictionService.js').then(s => s.checkHealth().then(console.log))"

# If unhealthy, check Python environment
python src/predict_model/model_service.py health

# Restart Node.js server
npm restart
```

### **Scenario 2: Single User's Model Corrupted**
```bash
# Delete corrupted model
rm src/predict_model/user_models/model_{userId}.pkl

# System will recreate on next task creation
```

### **Scenario 3: Training Not Triggering**
```bash
# Check completeTask function is called
# Look for log: "🎯 Training ML model for completed task: ..."

# If missing, check taskService import in controller
# Verify completeTask is used (not direct Task.updateOne)
```

---

## 🎯 Success Indicators

Your ML system is working well if:

✅ **>95% of new tasks get predictions** (predictionScore exists)  
✅ **Model files exist for active users** (`ls user_models/`)  
✅ **Predictions improve over time** (0.2 → 0.7 confidence)  
✅ **Training occurs on completion** (check model timestamps)  
✅ **actualCompletionMinutes matches work sessions** (not 0 or huge)  
✅ **No critical errors in logs** (no timeouts, no corruption)

---

## 📚 Related Documentation

- [ML Implementation Summary](ML-IMPLEMENTATION-SUMMARY.md) - Complete architecture
- [Test Documentation](../tests/README.md) - Automated test suite
- [mlPredictionService.js](../src/services/mlPredictionService.js) - Node.js bridge
- [model_service.py](../src/predict_model/model_service.py) - Python ML API

---

**Last Updated:** January 8, 2026  
**System Status:** ✅ Production-Ready with Comprehensive Error Handling
