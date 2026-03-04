/*
 * File: src/models/BusyBlock.js
 * Purpose: Represents user busy blocks / time-off rules.
 *
 * blockType discriminator:
 *  DAILY    – every day (no daysOfWeek needed), optional recurrenceEndDate
 *  WEEKLY   – selected daysOfWeek each week, optional recurrenceEndDate
 *  ONCE     – single window on a specific date (date + startTime/endTime)
 *  FULL_DAY – entire day(s) off; one-time when only `date` is set,
 *             recurring when `daysOfWeek` is set (e.g. every Friday)
 *
 * All time values (startTime / endTime) are stored as "HH:MM" UTC strings
 * so they are timezone-floating — consistent with how the scheduler already
 * extracts getHours()/getMinutes() from the legacy Date fields.
 *
 * Buffers expand the blocked window outward: tasks cannot be placed within
 * bufferBeforeMinutes before the block or bufferAfterMinutes after it.
 *
 * Backward compatibility: documents without blockType (blockType = null) are
 * treated as legacy and handled by the legacy branch in expandBusyBlock():
 *   isRecurring = true  → expanded via the original expandRecurringBlock()
 *   isRecurring = false → treated as a one-time start/end block
 */
import mongoose from "mongoose";

const HH_MM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Legacy recurrence sub-schema — kept so old documents still validate.
const recurrenceSchema = new mongoose.Schema(
  {
    daysOfWeek: {
      type: [Number],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.every((d) => Number.isInteger(d) && d >= 0 && d <= 6),
        message: "daysOfWeek must be integers 0–6",
      },
    },
    endDate: { type: Date, default: null },
  },
  { _id: false }
);

const busyBlockSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, default: "" },

    // ── Primary discriminator ───────────────────────────────────────────────
    /** null = legacy document (isRecurring / start / end still used) */
    blockType: {
      type: String,
      enum: ["DAILY", "WEEKLY", "ONCE", "FULL_DAY", null],
      default: null,
    },

    // ── Date targeting ──────────────────────────────────────────────────────
    /** ONCE / one-time FULL_DAY: UTC midnight of the target date */
    date: { type: Date, default: null },

    /** WEEKLY / recurring FULL_DAY: weekday indices 0 (Sun) – 6 (Sat) */
    daysOfWeek: {
      type: [Number],
      default: [],
      validate: {
        validator: (arr) => arr.every((d) => Number.isInteger(d) && d >= 0 && d <= 6),
        message: "daysOfWeek must be integers 0–6",
      },
    },

    /** DAILY / WEEKLY / FULL_DAY recurring: when the rule expires (null = forever) */
    recurrenceEndDate: { type: Date, default: null },

    // ── Time fields — HH:MM UTC; absent for FULL_DAY ────────────────────────
    startTime: {
      type: String,
      default: null,
      validate: { validator: (v) => v == null || HH_MM_RE.test(v), message: "startTime must be HH:MM" },
    },
    endTime: {
      type: String,
      default: null,
      validate: { validator: (v) => v == null || HH_MM_RE.test(v), message: "endTime must be HH:MM" },
    },

    // ── Buffer ──────────────────────────────────────────────────────────────
    /** Minutes of padding _before_ the block — tasks cannot land in this window */
    bufferBeforeMinutes: { type: Number, default: 0, min: 0, max: 120 },
    /** Minutes of padding _after_ the block */
    bufferAfterMinutes: { type: Number, default: 0, min: 0, max: 120 },

    // ── Legacy fields (kept for backward compat — not used for new docs) ────
    start: { type: Date },
    end: { type: Date },
    isRecurring: { type: Boolean, default: false },
    recurrence: { type: recurrenceSchema, default: null, required: false },
    source: { type: String, enum: ["manual", "calendar"], default: "manual" },
  },
  { timestamps: true }
);

busyBlockSchema.index({ userId: 1, blockType: 1, date: 1 });
busyBlockSchema.index({ userId: 1, isRecurring: 1, start: 1 }); // legacy index preserved

export const BusyBlock = mongoose.model("BusyBlock", busyBlockSchema);
