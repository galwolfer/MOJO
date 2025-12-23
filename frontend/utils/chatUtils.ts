import { ChatSessionSummary } from "../services/chatService";

export type TimelineItem =
  | {
      kind: "divider";
      id: string;
      sessionId: string;
      label: string;
    }
  | {
      kind: "message";
      id: string;
      sessionId: string;
      role: "user" | "assistant";
      content: string;
      timestamp: Date;
    };

export function buildTimelineItems(sessions: ChatSessionSummary[]): TimelineItem[] {
  if (!sessions || sessions.length === 0) return [];

  const ordered = [...sessions].sort((a, b) => {
    const aDate = new Date(a.createdAt || a.lastActiveAt).getTime();
    const bDate = new Date(b.createdAt || b.lastActiveAt).getTime();
    return aDate - bDate;
  });

  const items: TimelineItem[] = [];

  for (const s of ordered) {
    const stamp = new Date(s.createdAt || s.lastActiveAt);
    const label = `${stamp.toLocaleString()}`;
    items.push({ kind: "divider", id: `divider_${s.sessionId}`, sessionId: s.sessionId, label });

    const msgs = s.messages || [];
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      if (m.role !== "user" && m.role !== "assistant") continue;
      const ts = m.timestamp ? new Date(m.timestamp) : stamp;
      items.push({
        kind: "message",
        id: `msg_${s.sessionId}_${i}_${ts.getTime()}`,
        sessionId: s.sessionId,
        role: m.role,
        content: m.content,
        timestamp: ts,
      });
    }
  }

  return items;
}
