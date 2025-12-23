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

export default function TimelineItemComponent({ item, isLastItem }: TimelineItemProps) {
  if (item.kind === "divider") {
    return <SessionDivider label={item.label} />;
  }

  return <ChatMessageBubble role={item.role} content={item.content} isLastMessage={isLastItem} playOnceKey={item.id} />;
}
