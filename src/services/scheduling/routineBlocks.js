/**
 * @fileoverview Routine Blocks Generator
 * @module services/scheduling/routineBlocks
 * 
 * Generates synthetic busy blocks from user-defined daily routines.
 * Converts recurring patterns (sleep, meals, breaks) into time-blocked constraints.
 * 
 * Key responsibilities:
 * - Parse routine definitions (start/end hours, wrap-around handling)
 * - Generate busy blocks for a specified date range
 * - Handle routines that span midnight (wrapsToNextDay)
 * - Validate and normalize time inputs
 * 
 * Example routines: sleep (22:00-07:00), lunch (12:00-13:00), dinner (18:00-19:00)
 * 
 * @requires utils/dateUtils - Date manipulation utilities
 */

import { addDays, startOfDay } from "../../utils/dateUtils.js";

const clamp = (value, min, max, fallback) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  if (num < min) return min;
  if (num > max) return max;
  return num;
};

function normalizeBlock(block) {
  if (!block) return null;
  const startHour = clamp(block.startHour, 0, 23, 0);
  const startMinute = clamp(block.startMinute, 0, 59, 0);
  const endHour = clamp(block.endHour, 0, 23, 0);
  const endMinute = clamp(block.endMinute, 0, 59, 0);
  const wrapsToNextDay = block.wrapsToNextDay ?? endHour < startHour;
  return {
    key: block.key || `routine_${startHour}_${startMinute}`,
    label: block.label || block.key || "Routine",
    startHour,
    startMinute,
    endHour,
    endMinute,
    wrapsToNextDay,
  };
}

export const DEFAULT_ROUTINE_BLOCKS = [
  {
    key: "sleep",
    label: "Sleep",
    startHour: 23,
    startMinute: 0,
    endHour: 7,
    endMinute: 0,
    wrapsToNextDay: true,
  },
  {
    key: "breakfast",
    label: "Breakfast",
    startHour: 8,
    startMinute: 0,
    endHour: 8,
    endMinute: 30,
  },
  {
    key: "lunch",
    label: "Lunch",
    startHour: 13,
    startMinute: 0,
    endHour: 13,
    endMinute: 45,
  },
  {
    key: "dinner",
    label: "Dinner",
    startHour: 19,
    startMinute: 0,
    endHour: 19,
    endMinute: 45,
  },
  {
    key: "shower",
    label: "Shower",
    startHour: 7,
    startMinute: 30,
    endHour: 8,
    endMinute: 0,
  },
];

const NORMALIZED_DEFAULT_BLOCKS = DEFAULT_ROUTINE_BLOCKS.map(normalizeBlock);

const DEFAULT_ROUTINE_SETTINGS = {
  enabled: false,
  blocks: NORMALIZED_DEFAULT_BLOCKS,
};

const readSettingsValue = (settings, key) => {
  if (!settings) return undefined;
  if (typeof settings.get === "function") {
    return settings.get(key);
  }
  return settings[key];
};

const splitIntervalByDay = (start, end, accumulator) => {
  let cursor = start;
  while (cursor < end) {
    const dayStart = startOfDay(cursor);
    const dayEnd = addDays(dayStart, 1);
    const chunkEnd = new Date(Math.min(dayEnd.getTime(), end.getTime()));
    if (chunkEnd > cursor) {
      const dateKey = dayStart.toISOString().slice(0, 10);
      if (!accumulator[dateKey]) accumulator[dateKey] = [];
      accumulator[dateKey].push({ start: new Date(cursor), end: new Date(chunkEnd) });
    }
    cursor = chunkEnd;
  }
};

const addRoutineBlockForDate = (date, block, accumulator) => {
  const dayStart = startOfDay(date);
  const start = new Date(dayStart);
  start.setHours(block.startHour, block.startMinute, 0, 0);
  let end = new Date(dayStart);
  end.setHours(block.endHour, block.endMinute, 0, 0);
  if (block.wrapsToNextDay && end <= start) {
    end = addDays(end, 1);
  }
  if (end <= start) return;
  splitIntervalByDay(start, end, accumulator);
};

export function getRoutineSettings(profile = {}) {
  const stored = readSettingsValue(profile?.settings, "routineBlocks");
  if (!stored) return DEFAULT_ROUTINE_SETTINGS;
  const normalizedBlocks =
    Array.isArray(stored.blocks) && stored.blocks.length
      ? stored.blocks.map(normalizeBlock).filter(Boolean)
      : NORMALIZED_DEFAULT_BLOCKS;
  return {
    enabled: Boolean(stored.enabled),
    blocks: normalizedBlocks.length ? normalizedBlocks : NORMALIZED_DEFAULT_BLOCKS,
  };
}

export function buildRoutineBusyBlocks({ startDate, endDate, profile = {} }) {
  const settings = getRoutineSettings(profile);
  if (!settings.enabled) return {};

  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  const result = {};

  let cursor = new Date(start);
  while (cursor <= end) {
    for (const block of settings.blocks) {
      addRoutineBlockForDate(cursor, block, result);
    }
    cursor = addDays(cursor, 1);
  }

  return result;
}

export function describeRoutineWindows(blocks = DEFAULT_ROUTINE_BLOCKS) {
  return blocks.map((block) => describeBlock(block));
}

const describeBlock = (block) => {
  const start = formatTime(block.startHour, block.startMinute);
  const end = formatTime(block.endHour, block.endMinute);
  const suffix = block.wrapsToNextDay ? " (next day)" : "";
  return `${block.label}: ${start} - ${end}${suffix}`;
};

const formatTime = (hour, minute) => {
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return `${hh}:${mm}`;
};
