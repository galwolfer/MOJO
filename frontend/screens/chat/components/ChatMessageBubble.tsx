/**
 * ChatMessageBubble
 *
 * Renders a single chat message with different presentation for the user vs assistant.
 * Handles simple heuristics for error content and provides hooks for retrying failed messages.
 *
 * Usage:
 * <ChatMessageBubble role="assistant" content={text} isLastMessage playOnceKey={id} />
 */
import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";

import AppText from "../../../components/common/AppText";
import ErrorText from "../../../components/common/ErrorText";
import TextBouble from "./TextBouble";
import { COLORS, FONT_SIZES, SPACING } from "../../../theme";
import { ICONS } from "../../../components/icons/icons";
import { getOjoType } from "../../../config/ojoTypeConfig";
import { useOjoType } from "../../../hooks";

interface ChatMessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  isLastMessage: boolean;
  playOnceKey: string;
  timestamp?: Date;
  isError?: boolean;
  status?: "pending" | "failed" | "sent";
  onRetry?: () => void;
  // OjoType metadata for assistant messages
  ojoTypeName?: string;
  ojoTypeDisplayName?: string;
  // Widget action callback (for agent messages with widgets)
  onWidgetAction?: (actionId: string, actionData?: any) => void;
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
  ojoTypeName,
  ojoTypeDisplayName,
  onWidgetAction,
}: ChatMessageBubbleProps) {
  const isUser = role === "user";
  const normalized = content.trim().toLowerCase();
  const isErrorContent =
    !isUser &&
    (isError ||
      normalized.includes("unable to connect") ||
      normalized.includes("check your connection") ||
      normalized.includes("something went wrong") ||
      normalized.includes("request failed") ||
      normalized.includes("couldn't connect") ||
      normalized.includes("server error"));

  // Determine gradient colors from the message OjoType if present; otherwise fall back to current user's OjoType
  let personaGradient: string[] | undefined = undefined;
  if (!isUser && ojoTypeName) {
    try {
      const cfg = getOjoType(ojoTypeName as any);
      personaGradient = cfg.gradient;
    } catch (err) {
      personaGradient = undefined;
    }
  }

  // use current user OjoType as fallback when message doesn't have a persona
  const { currentOjoType } = useOjoType();
  if (!isUser && !personaGradient && currentOjoType) {
    try {
      const cfg = getOjoType(currentOjoType as any);
      personaGradient = cfg.gradient;
    } catch (err) {
      personaGradient = undefined;
    }
  }

  if (isErrorContent) {
    return (
      <View style={[styles.messageRow, styles.errorRow]}>
        <ErrorText>{content.endsWith("\n") ? content.slice(0, -1) : content}</ErrorText>
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
        gradientColors={personaGradient}
        onWidgetAction={!isUser ? onWidgetAction : undefined}
      >
        <AppText variant="bodyText">{content.endsWith("\n") ? content.slice(0, -1) : content}</AppText>
      </TextBouble>
      {isUser && status === "failed" && onRetry ? (
        <TouchableOpacity onPress={onRetry} style={styles.retryRow} activeOpacity={0.7}>
          <View style={styles.retryContent}>
            <ErrorText style={styles.retryText}>Try again</ErrorText>
            <ICONS.repeat size={FONT_SIZES.sm * 0.7} color={COLORS.lightGray} />
          </View>
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
    prev.status === next.status &&
    prev.ojoTypeName === next.ojoTypeName &&
    prev.ojoTypeDisplayName === next.ojoTypeDisplayName &&
    prev.onWidgetAction === next.onWidgetAction
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
  retryContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm / 2,
  },
  retryText: {
    marginLeft: SPACING.sm,
    color: COLORS.lightGray,
  },
});
