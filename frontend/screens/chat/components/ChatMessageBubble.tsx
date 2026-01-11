import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";

/**
 * ChatMessageBubble
 *
 * Renders a single chat message with different presentation for the user vs assistant.
 * Handles simple heuristics for error content and provides hooks for retrying failed messages.
 */
import AppText from "../../../components/common/AppText";
import TextBouble from "./TextBouble";
import { COLORS, SPACING } from "../../../theme";

interface ChatMessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  isLastMessage: boolean;
  playOnceKey: string;
  timestamp?: Date;
  isError?: boolean;
  status?: "pending" | "failed" | "sent";
  onRetry?: () => void;
}

function ChatMessageBubble({
  role,
  content,
  isLastMessage,
  playOnceKey,
  timestamp,
  isError,
  status,
  onRetry,
}: ChatMessageBubbleProps) {
  const isUser = role === "user";
  const normalized = content.trim().toLowerCase();
  const isErrorContent =
    !isUser &&
    (isError ||
      normalized.includes("unable to connect") ||
      normalized.includes("check your connection") ||
      normalized.includes("something went wrong") ||
      normalized.includes("request failed"));

  if (isErrorContent) {
    return (
      <View style={[styles.messageRow, styles.errorRow]}>
        <AppText variant="errorText">{content.endsWith("\n") ? content.slice(0, -1) : content}</AppText>
      </View>
    );
  }

  return (
    <View style={[styles.messageRow, isUser ? styles.userMessageRow : styles.agentMessageRow]}>
      <TextBouble
        mode={isUser ? "user" : "agent"}
        // Only animate typewriter for assistant messages that arrived very recently
        typewriter={!isUser && isLastMessage && Boolean(timestamp && Date.now() - new Date(timestamp).getTime() < 5000)}
        playOnceKey={playOnceKey}
        style={styles.messageBubble}
      >
        <AppText variant="bodyText">{content.endsWith("\n") ? content.slice(0, -1) : content}</AppText>
      </TextBouble>
      {isUser && status === "failed" && onRetry ? (
        <TouchableOpacity onPress={onRetry} style={styles.retryRow} activeOpacity={0.7}>
          <AppText variant="errorText" style={styles.pendingText}>
            Try again
          </AppText>
        </TouchableOpacity>
      ) : null}
      {isUser && status === "pending" ? (
        <AppText variant="notes" style={styles.pendingText}>
          Sending...
        </AppText>
      ) : null}
    </View>
  );
}

function areEqual(prev: ChatMessageBubbleProps, next: ChatMessageBubbleProps) {
  return (
    prev.role === next.role &&
    prev.content === next.content &&
    prev.isLastMessage === next.isLastMessage &&
    prev.playOnceKey === next.playOnceKey &&
    prev.isError === next.isError &&
    prev.status === next.status
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
  errorRow: {
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  messageBubble: {
    maxWidth: "100%",
  },
  retryRow: {
    marginTop: SPACING.sm,
    alignSelf: "flex-end",
  },

  pendingText: {
    marginTop: SPACING.sm,
    alignSelf: "flex-end",
    color: COLORS.lightGray,
  },
});
