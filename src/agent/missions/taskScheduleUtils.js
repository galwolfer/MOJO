import { TaskSchedule } from "../../models/TaskSchedule.js";
import { SubTask } from "../../models/SubTask.js";
import { formatLocalDate, startOfDay, addDays } from "../../utils/dateUtils.js";

function toId(value) {
  if (!value) return null;
  return typeof value === "string" ? value : value.toString();
}

export function normalizeScheduleSession(session, subtaskMap) {
  const taskId = toId(session.taskId);
  const subtaskKey = session.subtaskIndex ? `${taskId}:${session.subtaskIndex}` : null;
  const subtask = subtaskKey ? subtaskMap.get(subtaskKey) : null;

  return {
    taskId: taskId,
    id: toId(session._id),
    start: session.start ? new Date(session.start).toISOString() : null,
    end: session.end ? new Date(session.end).toISOString() : null,
    minutes: session.minutes ?? null,
    status: session.status || null,
    subtaskIndex: session.subtaskIndex ?? null,
    subtaskId: subtask ? toId(subtask._id) : null,
    subtaskTitle: subtask ? subtask.title || null : null,
    subtaskStatus: subtask ? subtask.status || null : null,
  };
}

function buildSubtaskMap(subtasks) {
  const map = new Map();
  for (const sub of subtasks) {
    if (!sub?.taskId || !sub?.index) continue;
    map.set(`${toId(sub.taskId)}:${sub.index}`, sub);
  }
  return map;
}

export function getSessionDateKey(session) {
  if (!session?.start) return null;
  const date = session.start instanceof Date ? session.start : new Date(session.start);
  return formatLocalDate(date);
}

export function getScheduleWindow(days = 7) {
  const todayStart = startOfDay(new Date());
  const horizonEnd = addDays(todayStart, days);
  return { start: todayStart, end: horizonEnd };
}

export async function fetchScheduledSessions({
  userId,
  start,
  end,
  includeSubtasks = false,
}) {
  const query = { userId };
  if (start || end) {
    query.start = {};
    if (start) query.start.$gte = start;
    if (end) query.start.$lt = end;
  }

  const sessions = await TaskSchedule.find(query).sort({ start: 1 }).lean();
  const taskIds = Array.from(new Set(sessions.map((s) => toId(s.taskId)).filter(Boolean)));
  const subtaskMap = includeSubtasks
    ? buildSubtaskMap(
        await SubTask.find({ taskId: { $in: taskIds } })
          .select({ taskId: 1, index: 1, title: 1, status: 1 })
          .lean(),
      )
    : new Map();

  return sessions.map((session) => normalizeScheduleSession(session, subtaskMap));
}

export async function fetchScheduledSessionsByTask({
  userId,
  taskIds,
  start,
  end,
  includeSubtasks = false,
}) {
  const ids = Array.isArray(taskIds) ? taskIds.filter(Boolean) : [];
  if (ids.length === 0) {
    return new Map();
  }

  const query = {
    userId,
    taskId: { $in: ids },
  };

  if (start || end) {
    query.start = {};
    if (start) query.start.$gte = start;
    if (end) query.start.$lt = end;
  }

  const sessions = await TaskSchedule.find(query).sort({ start: 1 }).lean();
  const subtaskMap = includeSubtasks
    ? buildSubtaskMap(
        await SubTask.find({ taskId: { $in: ids } })
          .select({ taskId: 1, index: 1, title: 1, status: 1 })
          .lean(),
      )
    : new Map();

  const byTaskId = new Map();
  for (const session of sessions) {
    const taskId = toId(session.taskId);
    if (!taskId) continue;
    const normalized = normalizeScheduleSession(session, subtaskMap);
    if (!byTaskId.has(taskId)) byTaskId.set(taskId, []);
    byTaskId.get(taskId).push(normalized);
  }

  return byTaskId;
}
