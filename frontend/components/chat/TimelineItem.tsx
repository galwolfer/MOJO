import React from "react";
import SessionDivider from "./SessionDivider";
import ChatMessageBubble from "./ChatMessageBubble";

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

interface TimelineItemProps {
  item: TimelineItem;
  isLastItem: boolean;
}

function TimelineItemComponent({ item, isLastItem }: TimelineItemProps) {
  if (item.kind === "divider") {
    return <SessionDivider label={item.label} />;
  }

  return <ChatMessageBubble role={item.role} content={item.content} isLastMessage={isLastItem} playOnceKey={item.id} />;
}

function areEqual(prev: TimelineItemProps, next: TimelineItemProps) {
  if (prev.isLastItem !== next.isLastItem) return false;
  const p = prev.item;
  const n = next.item;
  if (p.kind !== n.kind) return false;
  if (p.kind === "divider" && n.kind === "divider") {
    return p.id === n.id && p.label === n.label && p.sessionId === n.sessionId;
  }
  // message
  if (p.kind === "message" && n.kind === "message") {
    return p.id === n.id && p.content === n.content && p.role === n.role && +p.timestamp === +n.timestamp;
  }
  return false;
}

export default React.memo(TimelineItemComponent, areEqual);
