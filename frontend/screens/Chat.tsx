import React, { useEffect, useMemo, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import AppText from "../components/common/AppText";
import Input from "../components/inputs/Input";
import { COLORS, FONT_SIZES, SHADOWS, SPACING } from "../theme";
import { useNavigation } from "../context/NavigationContext";
import { useAuth } from "../context/AuthContext";
import { ICONS } from "../components/icons/icons";
import { setChatAuthToken } from "../services/chatService";
import { useKeyboard } from "../hooks";
import { useChatSessions, useChatMessages } from "../hooks";
import { TimelineItem, buildTimelineItems } from "../utils/chatUtils";
import TimelineItemComponent from "../components/chat/TimelineItem";

export default function ChatScreen() {
  const { setHeaderConfig, setNavBarConfig } = useNavigation();
  const { token } = useAuth();
  const flatListRef = useRef<FlatList>(null);
  const { visible: keyboardVisible, height: keyboardHeight } = useKeyboard();
  const listPaddingBottom = SPACING.md + (keyboardVisible ? keyboardHeight : 0);

  const { sessions, isLoadingSessions, isLoadingMoreSessions, hasMoreSessions, loadMoreSessions, updateSession } =
    useChatSessions();

  const { message, setMessage, isLoading, sessionId, setSessionId, handleSend } = useChatMessages(updateSession);

  // Set auth token for chat service
  useEffect(() => {
    if (token) {
      setChatAuthToken(token);
    }
  }, [token]);

  useEffect(() => {
    // Configure Header
    setHeaderConfig({
      title: "Mojo",
      show: true,
      icon: ICONS.ojo,
    });
  }, []);

  // Cleanup when leaving screen
  useEffect(() => {
    return () => {
      setNavBarConfig({ show: true, widget: null });
    };
  }, [setNavBarConfig]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  const onScrollLoadMore = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      // Trigger load more when scrolling near the top
      if (y <= 50 && hasMoreSessions && !isLoadingMoreSessions) {
        loadMoreSessions();
      }
    },
    [loadMoreSessions, hasMoreSessions, isLoadingMoreSessions]
  );

  const onSend = useCallback(() => {
    handleSend(sessionId, sessions);
    scrollToBottom();
  }, [handleSend, sessionId, sessions, scrollToBottom]);

  // Put the chat input back into the shared NavBar (original behavior)
  useEffect(() => {
    setNavBarConfig({
      show: true,
      widget: (
        <View style={[styles.inputContainer]}>
          <View style={{ flex: 1 }}>
            <Input
              placeholder="Type a message..."
              value={message}
              onChangeText={setMessage}
              onSubmitEditing={onSend}
              returnKeyType="send"
              editable={!isLoading}
              multiline
            />
          </View>
          <TouchableOpacity
            style={[styles.sendButton, (!message.trim() || isLoading) && styles.sendButtonDisabled]}
            onPress={onSend}
            disabled={!message.trim() || isLoading}
            activeOpacity={0.7}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={COLORS.colorWhite} />
            ) : (
              <ICONS.send size={FONT_SIZES.base} color={COLORS.colorWhite} />
            )}
          </TouchableOpacity>
        </View>
      ),
    });
  }, [handleSend, isLoading, message, setNavBarConfig]);

  const timelineItems: TimelineItem[] = useMemo(() => buildTimelineItems(sessions), [sessions]);

  const renderTimelineItem = useCallback(
    ({ item, index }: { item: TimelineItem; index: number }) => (
      <TimelineItemComponent item={item} isLastItem={index === timelineItems.length - 1} />
    ),
    [timelineItems.length]
  );

  const keyExtractor = useCallback((item: TimelineItem) => item.id, []);

  return (
    <View style={styles.container}>
      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={timelineItems}
        renderItem={renderTimelineItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={[styles.messagesList, { paddingBottom: listPaddingBottom }]}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={scrollToBottom}
        onScroll={onScrollLoadMore}
        scrollEventThrottle={16}
        ListHeaderComponent={
          isLoadingMoreSessions ? (
            <View style={styles.loadMoreHeader}>
              <ActivityIndicator size="small" color={COLORS.lightGray} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <AppText variant="bodyText" style={styles.emptyText}>
              Start a conversation with Mojo!
            </AppText>
            <AppText variant="notes" style={styles.emptySubtext}>
              Ask me anything about your tasks, schedule, or how I can help you stay productive.
            </AppText>
            {isLoadingSessions ? (
              <View style={{ marginTop: SPACING.md }}>
                <ActivityIndicator size="small" color={COLORS.lightGray} />
              </View>
            ) : null}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white3,
  },
  messagesList: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
    flexGrow: 1,
  },
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

  sessionDivider: {
    alignSelf: "center",
    paddingVertical: SPACING.sm,
  },
  sessionDividerText: {
    color: COLORS.lightGray,
    textAlign: "center",
  },

  loadMoreHeader: {
    paddingVertical: SPACING.sm,
    alignItems: "center",
  },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING.xlg,
    paddingTop: 100,
  },
  emptyText: {
    color: COLORS.darkGray,
    textAlign: "center",
    marginBottom: SPACING.sm,
  },
  emptySubtext: {
    color: COLORS.lightGray,
    textAlign: "center",
  },
  inputContainer: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  sendButton: {
    width: FONT_SIZES.base * 2.5 + 1.5,
    height: FONT_SIZES.base * 2.5 + 1.5,
    borderRadius: FONT_SIZES.base,
    backgroundColor: COLORS.primary1,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.card,
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.lightGray,
  },
});
