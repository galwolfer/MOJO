// src/services/busyBlockService.js
// CRUD operations for user busy blocks.

import { BusyBlock } from "../models/BusyBlock.js";
import { startOfDay } from "../utils/dateUtils.js";

/**
 * Create a busy block for a user.
 * @param {object} params
 * @returns {Promise<object>}
 */
export async function createBusyBlock({ userId, title = "", start, end }) {
  if (end <= start) {
    throw new Error("End time must be after start time.");
  }

  return BusyBlock.create({ userId, title, start, end });
}

/**
 * Fetch upcoming busy blocks for a user.
 * @param {string | import("mongoose").Types.ObjectId} userId
 * @returns {Promise<object[]>}
 */
export async function getUpcomingBusyBlocks(userId) {
  const now = startOfDay(new Date());
  return BusyBlock.find({
    userId,
    end: { $gte: now },
  })
    .sort({ start: 1 })
    .lean();
}

/**
 * Delete a busy block by ID.
 * @param {string | import("mongoose").Types.ObjectId} blockId
 * @param {string | import("mongoose").Types.ObjectId} userId
 * @returns {Promise<boolean>}
 */
export async function deleteBusyBlock(blockId, userId) {
  const result = await BusyBlock.deleteOne({ _id: blockId, userId });
  return result.deletedCount > 0;
}
