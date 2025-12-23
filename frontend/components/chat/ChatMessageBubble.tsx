import React from "react";
import { View, StyleSheet } from "react-native";
import AppText from "../common/AppText";
import TextBouble from "../common/TextBouble";
import { SPACING } from "../../theme";

interface ChatMessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  isLastMessage: boolean;
  playOnceKey: string;
}

function ChatMessageBubble({ role, content, isLastMessage, playOnceKey }: ChatMessageBubbleProps) {
  const isUser = role === "user";

  return (
    <View style={[styles.messageRow, isUser ? styles.userMessageRow : styles.agentMessageRow]}>
      <TextBouble
        mode={isUser ? "user" : "agent"}
        typewriter={!isUser && isLastMessage}
        playOnceKey={playOnceKey}
        style={styles.messageBubble}
      >
        <AppText variant="bodyText">{content.endsWith("\n") ? content.slice(0, -1) : content}</AppText>
      </TextBouble>
    </View>
  );
}

function areEqual(prev: ChatMessageBubbleProps, next: ChatMessageBubbleProps) {
  return (
    prev.role === next.role &&
    prev.content === next.content &&
    prev.isLastMessage === next.isLastMessage &&
    prev.playOnceKey === next.playOnceKey
  );
}

export default React.memo(ChatMessageBubble, areEqual);

const styles = StyleSheet.create({
  messageRow: {
    marginBottom: SPACING.md,
    maxWidth: "85%",
  },
  userMessageRow: {
    alignSelf: "flex-end",
  },
  agentMessageRow: {
    alignSelf: "flex-start",
  },
  messageBubble: {
    maxWidth: "100%",
  },
});
