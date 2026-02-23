/*
 * File: src/models/BusyBlock.js
 * Purpose: Represents user busy blocks (calendar or manual).
 *
 * Two block types are supported:
 *
 *  ONE-TIME  (isRecurring = false, default)
 *    • start / end  — absolute UTC datetimes for the unavailable window.
 *
 *  RECURRING (isRecurring = true)
 *    • start — reference datetime whose DATE component marks when the rule
 *              begins and whose TIME component is the daily start time.
 *    • end   — same reference DATE as start; TIME component is the daily
 *              end time (end time must be after start time within the day).
 *    • recurrence.daysOfWeek — weekday numbers [0=Sun … 6=Sat] on which
 *                              the block repeats.
 *    • recurrence.endDate    — when the rule expires (null = ongoing).
 *
 * Backward compatibility: existing documents without isRecurring are treated
 * as one-time blocks (isRecurring is falsy → $ne: true queries match them).
 */
import mongoose from "mongoose";

const recurrenceSchema = new mongoose.Schema(
  {
    /** Weekday indices: 0 = Sunday, 1 = Monday, …, 6 = Saturday */
    daysOfWeek: {
      type: [Number],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.every((d) => Number.isInteger(d) && d >= 0 && d <= 6),
        message: "daysOfWeek must be integers 0–6",
      },
    },
    /** null = recurring forever */
    endDate: { type: Date, default: null },
  },
  { _id: false }
);

const busyBlockSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, default: "" },
    /**
     * One-time : absolute start datetime.
     * Recurring: reference date (= recurrence activation date) + daily start time.
     */
    start: { type: Date, required: true },
    /**
     * One-time : absolute end datetime.
     * Recurring: same reference date as start + daily end time.
     */
    end: { type: Date, required: true },
    source: { type: String, enum: ["manual", "calendar"], default: "manual" },
    /** Discriminator: true = recurring rule; false/absent = one-time block */
    isRecurring: { type: Boolean, default: false },
    /** Populated only when isRecurring = true */
    recurrence: { type: recurrenceSchema, default: null, required: false },
  },
  { timestamps: true }
);

busyBlockSchema.index({ userId: 1, isRecurring: 1, start: 1 });

export const BusyBlock = mongoose.model("BusyBlock", busyBlockSchema);
