import React, { useEffect, useMemo, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
  InteractionManager,
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
  // Keep a small padding inside the list; overall keyboard offset is handled at layout level to avoid double-padding
  const listPaddingBottom = SPACING.md;
  // Prevent scheduling multiple concurrent scroll timers when keyboard toggles repeatedly
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    // Clear any pending schedule to avoid buildup
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current as any);
      scrollTimeoutRef.current = null;
    }
    // Schedule a scroll after layout settles. Use InteractionManager on native to be safer.
    const run = () => flatListRef.current?.scrollToEnd({ animated: true });
    if (Platform.OS !== "web" && InteractionManager?.runAfterInteractions) {
      InteractionManager.runAfterInteractions(() => {
        scrollTimeoutRef.current = setTimeout(() => {
          run();
          scrollTimeoutRef.current = null;
        }, 50);
      });
    } else {
      scrollTimeoutRef.current = setTimeout(() => {
        run();
        scrollTimeoutRef.current = null;
      }, 100);
    }
  }, []);

  // When keyboard appears or its height changes, ensure the list scrolls to bottom
  useEffect(() => {
    if (keyboardVisible) {
      // Ensure list scrolls to bottom after keyboard opens and layout updates
      scrollToBottom();
    } else {
      // If keyboard closed, clear any pending scroll
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current as any);
        scrollTimeoutRef.current = null;
      }
    }
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current as any);
        scrollTimeoutRef.current = null;
      }
    };
  }, [keyboardVisible, keyboardHeight, scrollToBottom]);

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
  const navWidget = useMemo(
    () => (
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
    [message, isLoading, onSend]
  );

  useEffect(() => {
    setNavBarConfig({ show: true, widget: navWidget });
  }, [navWidget, setNavBarConfig]);

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
        // Performance tweaks for large lists and frequent layout updates (keyboard)
        removeClippedSubviews={Platform.OS !== "web"}
        initialNumToRender={20}
        maxToRenderPerBatch={12}
        windowSize={21}
        updateCellsBatchingPeriod={50}
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
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
    minHeight: FONT_SIZES.base * 3.5,
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
