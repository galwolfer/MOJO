/**
 * scripts/migrate-session-hashes.js
 *
 * One-time migration:
 *  1. Backfill `sessionHash` on every TaskSchedule document that lacks it.
 *  2. Delete exact duplicates revealed by the backfill
 *     (same userId+taskId+start+end+subtaskIndex → keep the newest one).
 *  3. Drop the old sparse unique index and recreate it as non-sparse.
 *
 * Run once:
 *   node src/scripts/migrate-session-hashes.js
 */

import mongoose from "mongoose";
import { createHash } from "crypto";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../.env") });

function computeHash(userId, taskId, start, end, subtaskIndex) {
  const key = [
    userId.toString(),
    taskId.toString(),
    new Date(start).toISOString(),
    new Date(end).toISOString(),
    subtaskIndex ?? "",
  ].join("|");
  return createHash("sha256").update(key).digest("hex");
}

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("❌  MONGODB_URI not set");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("✅  Connected to MongoDB");

  const collection = mongoose.connection.collection("taskschedules");

  // ── 1. Fetch all documents missing sessionHash ──────────────────────────
  const missing = await collection
    .find({ sessionHash: { $exists: false } })
    .project({ _id: 1, userId: 1, taskId: 1, start: 1, end: 1, subtaskIndex: 1 })
    .toArray();

  console.log(`📋  Documents missing sessionHash: ${missing.length}`);

  if (missing.length > 0) {
    // Group by computed hash to detect collisions BEFORE writing
    const hashMap = new Map(); // hash → [doc, ...]
    for (const doc of missing) {
      const h = computeHash(doc.userId, doc.taskId, doc.start, doc.end, doc.subtaskIndex);
      if (!hashMap.has(h)) hashMap.set(h, []);
      hashMap.get(h).push({ ...doc, _computedHash: h });
    }

    // Also check existing hashed docs so we don't produce a collision with them
    const existingHashes = new Set(
      (await collection.find({ sessionHash: { $exists: true } }).project({ sessionHash: 1 }).toArray()).map(
        (d) => d.sessionHash,
      ),
    );

    // For each collision group: keep the newest, delete the rest
    let deleted = 0;
    const toUpdate = [];
    for (const [hash, docs] of hashMap.entries()) {
      if (existingHashes.has(hash)) {
        // A hashed doc already occupies this slot — delete ALL un-hashed duplicates
        const ids = docs.map((d) => d._id);
        await collection.deleteMany({ _id: { $in: ids } });
        deleted += ids.length;
        console.log(`  🗑️  Hash ${hash.slice(0, 12)}… already exists — deleted ${ids.length} legacy doc(s)`);
        continue;
      }

      if (docs.length > 1) {
        // Multiple un-hashed docs with the same fingerprint — keep the latest
        docs.sort((a, b) => new Date(b.start) - new Date(a.start));
        const [keep, ...dupes] = docs;
        const dupeIds = dupes.map((d) => d._id);
        await collection.deleteMany({ _id: { $in: dupeIds } });
        deleted += dupeIds.length;
        console.log(
          `  🗑️  Hash ${hash.slice(0, 12)}… had ${docs.length} duplicates — deleted ${dupeIds.length}, keeping ${keep._id}`,
        );
        toUpdate.push({ _id: keep._id, hash });
      } else {
        toUpdate.push({ _id: docs[0]._id, hash });
      }
    }

    console.log(`  Deleted ${deleted} duplicate document(s)`);

    // Bulk-write the computed hashes
    if (toUpdate.length > 0) {
      const ops = toUpdate.map(({ _id, hash }) => ({
        updateOne: { filter: { _id }, update: { $set: { sessionHash: hash } } },
      }));
      const result = await collection.bulkWrite(ops, { ordered: false });
      console.log(`✅  Backfilled sessionHash on ${result.modifiedCount} document(s)`);
    }
  }

  // ── 2. Rebuild the index as non-sparse ──────────────────────────────────
  console.log("\n🔑  Rebuilding sessionHash index as non-sparse unique...");
  try {
    await collection.dropIndex("sessionHash_1");
    console.log("  Dropped old index");
  } catch (e) {
    console.log(`  Could not drop index (may not exist yet): ${e.message}`);
  }

  await collection.createIndex({ sessionHash: 1 }, { unique: true, sparse: false, name: "sessionHash_1" });
  console.log("  ✅  Created new non-sparse unique index on sessionHash");

  await mongoose.disconnect();
  console.log("\n✅  Migration complete.");
}

run().catch((err) => {
  console.error("❌  Migration failed:", err);
  process.exit(1);
});
