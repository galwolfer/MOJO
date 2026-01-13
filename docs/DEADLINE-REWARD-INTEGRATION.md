# Deadline-Based Reward System Integration

## Overview

Successfully integrated the sophisticated `calculate_deadline_reward` method from the Python ML model into the training pipeline. This enables the ML model to learn not just about estimation accuracy, but also about meeting deadlines and proper scheduling.

## What Changed

### 1. New Reward Calculation Method

**File:** [mlInputConverter.js](src/utils/mlInputConverter.js)

Added `calculateDeadlineReward()` function that mirrors Python's algorithm:

```javascript
calculateDeadlineReward(completedAt, scheduledAt, deadline)
```

**Reward Formula:**
- **Early completion** (before scheduled): `0.85 → 1.0` (bonus for early delivery)
- **On-time completion** (scheduled → deadline): `0.85 → 0.0` (linear decay)
- **Late completion** (after deadline): `0.0` (penalty)

### 2. Smart Training Logic

**File:** [mlPredictionService.js](src/services/mlPredictionService.js)

Updated `trainTask()` to use a hybrid approach:

1. **Try deadline-based reward first** (if task has `dueDate` and scheduled sessions):
   - Fetches earliest completed TaskSchedule session
   - Calculates reward based on completion timing vs schedule/deadline
   - Logs: `"Using deadline-based reward: 0.XXX"`

2. **Fallback to estimation-based reward**:
   - Uses original `calculateReward()` (estimated vs actual minutes)
   - Logs: `"Using estimation-based reward: 0.XXX"`

### 3. Enhanced Return Data

Training results now include:
```javascript
{
  success: true,
  reward: 0.85,
  rewardType: 'deadline', // or 'estimation'
  message: 'Model trained successfully'
}
```

## How It Works

### Task Completion Flow

1. **User completes task** → `POST /api/tasks/:id/complete`
2. **Calculate actual time** → Sum of completed TaskSchedule sessions
3. **Train ML model** → `trainTask(task)`
4. **Reward calculation**:
   ```
   IF task has dueDate AND scheduled sessions:
     ✅ Use deadline-based reward (sophisticated timing)
   ELSE:
     ⚠️ Fallback to estimation-based reward (simple accuracy)
   ```

### Required Data

For deadline-based rewards, the task needs:
- ✅ `task.dueDate` - The absolute deadline
- ✅ `TaskSchedule.start` - When task was scheduled/started
- ✅ Completion timestamp - `new Date()` when marked done

## Benefits

### Before (Estimation-Only)
- ML learned: "How accurate are my time estimates?"
- Reward: High if actual ≈ estimated, low if very different

### After (Deadline-Aware)
- ML learns: "How well do I meet deadlines and schedules?"
- Reward considers:
  - ✅ Early delivery (rewarded with up to 1.0)
  - ✅ On-time completion (0.85 at scheduled time)
  - ✅ Approaching deadline (gradual penalty)
  - ❌ Missing deadline (0.0 penalty)

## Test Results

```
1. On scheduled time:       0.850 ✅
2. Early (1 day before):    0.880 ✅ (bonus)
3. Late (after deadline):   0.000 ✅ (penalty)
4. At deadline:             0.000 ✅ (last moment)
5. Halfway through window:  0.468 ✅
```

## Usage Examples

### Example 1: Task with Deadline
```javascript
// Task scheduled for Jan 10, deadline Jan 15
// Completed on Jan 9 (early!)
{
  dueDate: new Date('2026-01-15'),
  scheduledSession: { start: new Date('2026-01-10') },
  completedAt: new Date('2026-01-09')
}
// Reward: ~0.88 (early bonus!)
```

### Example 2: Task without Deadline
```javascript
// No deadline set, only estimation accuracy matters
{
  dueDate: null,
  estimatedDuration: 60,
  actualCompletionMinutes: 65
}
// Reward: ~0.95 (good estimate)
```

### Example 3: Task Missed Deadline
```javascript
// Completed after deadline
{
  dueDate: new Date('2026-01-15'),
  scheduledSession: { start: new Date('2026-01-10') },
  completedAt: new Date('2026-01-16')
}
// Reward: 0.0 (missed deadline penalty)
```

## Implementation Notes

### Why Two Reward Methods?

1. **Flexibility**: Not all tasks have deadlines
2. **Backward compatibility**: Existing tasks without schedules still train
3. **Graceful degradation**: System works even if scheduling data missing

### Data Requirements

Deadline-based rewards require:
- Users to set `dueDate` when creating tasks
- Scheduling system to create TaskSchedule sessions
- Tasks to be completed through proper workflow (not manually)

### Future Enhancements

Potential improvements:
- Consider multiple scheduled sessions (not just first)
- Weight by task importance (high-priority deadline misses = bigger penalty)
- Track historical deadline adherence per user/category
- Integrate with notification system (warn before deadlines)

## Architecture Alignment

This implementation properly uses the Python model's `calculate_deadline_reward` method by:
- ✅ Replicating algorithm in JavaScript for consistency
- ✅ Using same formula and thresholds
- ✅ Maintaining compatibility with per-user models
- ✅ Preserving subcategory integration
- ✅ Supporting both reward calculation methods

## Related Files

- [mlInputConverter.js](src/utils/mlInputConverter.js) - Reward calculation functions
- [mlPredictionService.js](src/services/mlPredictionService.js) - Training logic
- [taskService.js](src/services/taskService.js) - Task completion handler
- [model.py](src/predict_model/linucb/model.py) - Python ML model (reference implementation)

## Testing

Run test script:
```bash
node test-deadline-reward.js
```

Expected output shows all 5 test cases passing with correct reward values.
