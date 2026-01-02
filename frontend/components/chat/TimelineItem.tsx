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
      isError?: boolean;
      clientId?: string;
      status?: "pending" | "failed" | "sent";
    };

interface TimelineItemProps {
  item: TimelineItem;
  isLastItem: boolean;
  onRetry?: (sessionId: string, clientId: string) => void;
}

function TimelineItemComponent({ item, isLastItem, onRetry }: TimelineItemProps) {
  if (item.kind === "divider") {
    return <SessionDivider label={item.label} />;
  }

  const retryHandler =
    item.status === "failed" && item.clientId && onRetry ? () => onRetry(item.sessionId, item.clientId) : undefined;

  return (
    <ChatMessageBubble
      role={item.role}
      content={item.content}
      isLastMessage={isLastItem}
      playOnceKey={item.id}
      timestamp={item.timestamp}
      isError={item.isError}
      status={item.status}
      onRetry={retryHandler}
    />
  );
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
    return (
      p.id === n.id &&
      p.content === n.content &&
      p.role === n.role &&
      p.isError === n.isError &&
      p.clientId === n.clientId &&
      p.status === n.status &&
      +p.timestamp === +n.timestamp
    );
  }
  return false;
}

export default React.memo(TimelineItemComponent, areEqual);
