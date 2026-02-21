/**
 * @file tests/scheduling/scheduleDeduplication.test.js
 *
 * Reproduction test for the taskSchedule duplication bug.
 *
 * Proof-of-concept JSON from a real observed incident:
 *   - Two sessions share the same taskId + start + end (pure duplicates)
 *
 * The test verifies:
 *   1. deduplicatePlan() removes plan-level duplicates before any DB write.
 *   2. computeSessionHash() is deterministic for the same inputs.
 *   3. Concurrent calls to a locked persistPlan-equivalent are serialized,
 *      producing exactly plan.length sessions (not 2×plan.length).
 *
 * These three properties together prevent the observed duplication.
 *
 * Run with:
 *   node --test tests/scheduling/scheduleDeduplication.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Inline copies of the two pure helper functions from the fixed
// schedulingService so the test has zero external dependencies.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute a deterministic SHA-256 hash for a schedule session.
 * Identical to the implementation added to schedulingService.js.
 */
function computeSessionHash(userId, taskId, start, end, subtaskIndex) {
  const key = `${userId}|${taskId}|${new Date(start).toISOString()}|${new Date(end).toISOString()}|${subtaskIndex ?? ""}`;
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Deduplicate a plan array by (taskId, start, end, subtaskIndex).
 * Identical to the implementation added to schedulingService.js.
 */
function deduplicatePlan(userId, plan) {
  const seen = new Set();
  return plan.filter((slot) => {
    const h = computeSessionHash(
      userId,
      slot.taskId.toString(),
      slot.start,
      slot.end,
      slot.subtaskIndex
    );
    if (seen.has(h)) return false;
    seen.add(h);
    return true;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Reproduction JSON – mirrors a real duplicated schedule snapshot
// ─────────────────────────────────────────────────────────────────────────────

const REPRODUCTION_PLAN = [
  // ── session 1 (original) ──────────────────────────────────────────────────
  {
    taskId: "665f1a2b3c4d5e6f7a8b9c01",
    start: "2026-02-22T09:00:00.000Z",
    end: "2026-02-22T10:00:00.000Z",
    minutes: 60,
    subtaskIndex: null,
  },
  // ── session 2 (original) ──────────────────────────────────────────────────
  {
    taskId: "665f1a2b3c4d5e6f7a8b9c01",
    start: "2026-02-23T09:00:00.000Z",
    end: "2026-02-23T10:00:00.000Z",
    minutes: 60,
    subtaskIndex: null,
  },
  // ── DUPLICATE of session 1 (same taskId + start + end) ───────────────────
  {
    taskId: "665f1a2b3c4d5e6f7a8b9c01",
    start: "2026-02-22T09:00:00.000Z",
    end: "2026-02-22T10:00:00.000Z",
    minutes: 60,
    subtaskIndex: null,
  },
  // ── session 3 for a different task (not a duplicate) ─────────────────────
  {
    taskId: "665f1a2b3c4d5e6f7a8b9c02",
    start: "2026-02-22T11:00:00.000Z",
    end: "2026-02-22T12:00:00.000Z",
    minutes: 60,
    subtaskIndex: 1,
  },
  // ── DUPLICATE of session 3 (same taskId + start + end + subtaskIndex) ────
  {
    taskId: "665f1a2b3c4d5e6f7a8b9c02",
    start: "2026-02-22T11:00:00.000Z",
    end: "2026-02-22T12:00:00.000Z",
    minutes: 60,
    subtaskIndex: 1,
  },
];

const USER_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

test("computeSessionHash produces the same hash for identical inputs", () => {
  const h1 = computeSessionHash(
    USER_ID,
    "665f1a2b3c4d5e6f7a8b9c01",
    "2026-02-22T09:00:00.000Z",
    "2026-02-22T10:00:00.000Z",
    null
  );
  const h2 = computeSessionHash(
    USER_ID,
    "665f1a2b3c4d5e6f7a8b9c01",
    new Date("2026-02-22T09:00:00.000Z"),
    new Date("2026-02-22T10:00:00.000Z"),
    null
  );
  assert.equal(h1, h2, "hash must be equal regardless of Date vs ISO-string input");
  assert.equal(h1.length, 64, "SHA-256 hex digest must be 64 chars");
});

test("computeSessionHash produces DIFFERENT hashes for different sessions", () => {
  const h1 = computeSessionHash(USER_ID, "task1", "2026-02-22T09:00:00.000Z", "2026-02-22T10:00:00.000Z", null);
  const h2 = computeSessionHash(USER_ID, "task1", "2026-02-23T09:00:00.000Z", "2026-02-23T10:00:00.000Z", null);
  const h3 = computeSessionHash(USER_ID, "task2", "2026-02-22T09:00:00.000Z", "2026-02-22T10:00:00.000Z", null);
  const h4 = computeSessionHash(USER_ID, "task1", "2026-02-22T09:00:00.000Z", "2026-02-22T10:00:00.000Z", 1);
  assert.notEqual(h1, h2, "different start/end → different hash");
  assert.notEqual(h1, h3, "different taskId → different hash");
  assert.notEqual(h1, h4, "different subtaskIndex → different hash");
});

test("deduplicatePlan removes duplicates from REPRODUCTION_PLAN", () => {
  const before = REPRODUCTION_PLAN.length; // 5
  const deduped = deduplicatePlan(USER_ID, REPRODUCTION_PLAN);
  const after = deduped.length;           // should be 3

  assert.equal(before, 5, "reproduction plan must have 5 entries (3 unique + 2 duplicates)");
  assert.equal(after, 3, `deduplication must reduce to 3 unique sessions, got ${after}`);
});

test("deduplicatePlan is idempotent – applying it twice yields the same result", () => {
  const once = deduplicatePlan(USER_ID, REPRODUCTION_PLAN);
  const twice = deduplicatePlan(USER_ID, once);
  assert.equal(
    once.length,
    twice.length,
    "a second dedup pass must not change the count"
  );
  assert.deepEqual(once, twice, "contents must be identical after two passes");
});

test("concurrent persistPlan calls are serialized by the per-user lock", async () => {
  /**
   * Simulates the race condition:
   *   - Two callers invoke persistPlan "at the same time" for the same user.
   *   - Without the lock, both delete → both insert → duplicate sessions.
   *   - With the lock, the second call waits for the first to finish → only
   *     one set of sessions is ultimately stored.
   */

  // Simple in-memory store that mimics the MongoDB operations
  const db = { sessions: [] };

  // Simulate the BUGGY (un-locked) behaviour
  async function persistPlanBuggy(userId, plan) {
    const deduped = deduplicatePlan(userId, plan); // still dedup the plan itself
    // deleteMany (future planned sessions)
    db.sessions = db.sessions.filter((s) => s.userId !== userId);
    // Small async yield to let the second concurrent call also reach deleteMany
    await new Promise((r) => setImmediate(r));
    // insertMany
    deduped.forEach((slot) => db.sessions.push({ userId, ...slot }));
  }

  // Call persistPlanBuggy concurrently without a lock
  const threeSessions = deduplicatePlan(USER_ID, REPRODUCTION_PLAN);
  db.sessions = [];
  await Promise.all([
    persistPlanBuggy(USER_ID, REPRODUCTION_PLAN),
    persistPlanBuggy(USER_ID, REPRODUCTION_PLAN),
  ]);

  const buggyCount = db.sessions.filter((s) => s.userId === USER_ID).length;
  // Buggy variant doubles up (both inserts succeed after both deletes)
  assert.equal(
    buggyCount,
    threeSessions.length * 2,
    `[BUG REPRODUCED] Expected ${threeSessions.length * 2} duplicated sessions, got ${buggyCount}`
  );

  // ── Now simulate the FIXED (locked) behaviour ──────────────────────────────
  const userLocks = new Map();

  async function withUserLock(userId, fn) {
    const prev = userLocks.get(userId) ?? Promise.resolve();
    let releaseFn;
    const token = new Promise((resolve) => { releaseFn = resolve; });
    userLocks.set(userId, prev.then(() => token));
    await prev;
    try {
      return await fn();
    } finally {
      releaseFn();
    }
  }

  async function persistPlanFixed(userId, plan) {
    return withUserLock(userId, async () => {
      const deduped = deduplicatePlan(userId, plan);
      db.sessions = db.sessions.filter((s) => s.userId !== userId);
      await new Promise((r) => setImmediate(r));
      deduped.forEach((slot) => db.sessions.push({ userId, ...slot }));
    });
  }

  db.sessions = [];
  await Promise.all([
    persistPlanFixed(USER_ID, REPRODUCTION_PLAN),
    persistPlanFixed(USER_ID, REPRODUCTION_PLAN),
  ]);

  const fixedCount = db.sessions.filter((s) => s.userId === USER_ID).length;
  assert.equal(
    fixedCount,
    threeSessions.length,
    `[FIX VERIFIED] Expected exactly ${threeSessions.length} sessions, got ${fixedCount}`
  );
});

test("no duplicate sessions in REPRODUCTION_PLAN after dedup (final assertion)", () => {
  const deduped = deduplicatePlan(USER_ID, REPRODUCTION_PLAN);

  // Build "duplicate detector" key → count
  const counts = new Map();
  for (const slot of deduped) {
    const key = `${slot.taskId}|${new Date(slot.start).toISOString()}|${new Date(slot.end).toISOString()}|${slot.subtaskIndex ?? ""}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const dupes = [...counts.entries()].filter(([, c]) => c > 1);
  assert.equal(
    dupes.length,
    0,
    `Found ${dupes.length} duplicate key(s) after dedup: ${JSON.stringify(dupes)}`
  );
});
