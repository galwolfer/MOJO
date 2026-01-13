/**
 * ChatScreen
 *
 * Main chat UI for interacting with Mojo. Responsibilities:
 * - Render timeline of messages and session dividers (virtualized FlatList)
 * - Provide message composer in the shared NavBar (Input + send button)
 * - Handle auto-scroll behavior, keyboard offset adjustments, and session restoration
 * - Integrate with `useChatSessions` and `useChatMessages` for fetching/sending
 *
 * Usage:
 * <ChatScreen /> (registered in app navigation)
 *
 * Notes:
 * - The timeline uses `TimelineItem` for rendering message/divider entries and
 *   `ChatMessageBubble` for per-message presentation.
 * - Scrolling/restore logic is intentionally conservative to avoid jank on
 *   low-end devices (uses InteractionManager and measured offsets).
 */
import React, { useEffect, useMemo, useRef, useCallback, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
  LayoutChangeEvent,
  InteractionManager,
} from "react-native";
import AppText from "../components/common/AppText";
import { COLORS, FONT_SIZES, SHADOWS, SPACING } from "../theme";
import { useNavigation } from "../context/NavigationContext";
import { useAuth } from "../context/AuthContext";
import { ICONS } from "../components/icons/icons";
import { setChatAuthToken } from "../services/chatService";
import { useKeyboard, useContentInsets } from "../hooks";
import GlassSurface from "../components/common/GlassSurface";
import { useChatSessions, useChatMessages } from "../hooks";
import { TimelineItem, buildTimelineItems } from "../utils/chatUtils";
import ChatComposer from "./chat/components/ChatComposer";
import TimelineItemComponent from "./chat/components/TimelineItem";
import type { ChatSessionSummary } from "../services/chatService";

export default function ChatScreen() {
  const { setHeaderConfig, setNavBarConfig, scrollPositions, setScrollPosition } = useNavigation();
  const { token } = useAuth();
  const sessionsRef = useRef<ChatSessionSummary[]>([]);
  const listRef = useRef<FlatList<TimelineItem>>(null);
  const scrollOffsetRef = useRef(0);
  const keyboardVisibleRef = useRef(false);
  const lastKeyboardHeightRef = useRef(0);
  const restoreOffsetRef = useRef<number | null>(null);
  const didRestoreRef = useRef(false);
  const contentHeightRef = useRef(0);
  const layoutHeightRef = useRef(0);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const { visible: keyboardVisible, height: keyboardHeight } = useKeyboard();
  const contentInsets = useContentInsets();

  const { sessions, isLoadingSessions, isLoadingMoreSessions, hasMoreSessions, loadMoreSessions, updateSession } =
    useChatSessions();

  const { isLoading, sessionId, setSessionId, sendText, handleRetry } = useChatMessages(updateSession);

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

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  const getTodaySessionId = useCallback((list: ChatSessionSummary[]) => {
    if (!list.length) return undefined;
    const today = new Date();
    const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
    const todaySession = [...list]
      .map((s) => ({
        sessionId: s.sessionId,
        stamp: new Date(s.lastActiveAt || s.createdAt || 0),
      }))
      .filter((s) => !Number.isNaN(s.stamp.getTime()) && sameDay(s.stamp, today))
      .sort((a, b) => b.stamp.getTime() - a.stamp.getTime())[0];

    return todaySession?.sessionId;
  }, []);

  useEffect(() => {
    const todaySessionId = getTodaySessionId(sessions);
    if (todaySessionId && todaySessionId !== sessionId) {
      setSessionId(todaySessionId);
    }
  }, [sessions, sessionId, setSessionId, getTodaySessionId]);

  const onSend = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;
      const todaySessionId = getTodaySessionId(sessionsRef.current);
      const activeSessionId = todaySessionId || sessionId;
      if (todaySessionId && todaySessionId !== sessionId) {
        setSessionId(todaySessionId);
      }
      sendText(activeSessionId, trimmed, () => sessionsRef.current);
    },
    [getTodaySessionId, isLoading, sendText, sessionId, setSessionId]
  );

  const onRetry = useCallback(
    (sessionIdToRetry: string, clientId: string) => {
      handleRetry(sessionIdToRetry, clientId, () => sessionsRef.current);
    },
    [handleRetry]
  );

  // Put the chat input back into the shared NavBar (original behavior)
  const navWidget = useMemo(() => <ChatComposer isLoading={isLoading} onSend={onSend} />, [isLoading, onSend]);

  useEffect(() => {
    setNavBarConfig({ show: true, widget: navWidget });
  }, [navWidget, setNavBarConfig]);

  const timelineItems: TimelineItem[] = useMemo(() => buildTimelineItems(sessions), [sessions]);

  const renderTimelineItem = useCallback(
    ({ item, index }: { item: TimelineItem; index: number }) => (
      <TimelineItemComponent item={item} isLastItem={index === timelineItems.length - 1} onRetry={onRetry} />
    ),
    [timelineItems.length, onRetry]
  );

  const keyExtractor = useCallback((item: TimelineItem) => item.id, []);

  // Dynamic content container style based on floating header/navbar
  const listContentStyle = useMemo(
    () => ({
      paddingHorizontal: SPACING.lg,
      paddingTop: contentInsets.top + SPACING.md,
      paddingBottom: contentInsets.keyboardVisible
        ? contentInsets.bottomWithKeyboard + SPACING.md
        : contentInsets.bottom + SPACING.md,
      flexGrow: 1,
    }),
    [contentInsets]
  );

  /**
   * Tracks list scroll offset for keyboard adjustments.
   */
  const handleListScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      scrollOffsetRef.current = contentOffset.y;
      if (didRestoreRef.current) {
        setScrollPosition("chat", scrollOffsetRef.current);
      }
      const bottomThreshold = SPACING.lg * 10;
      const reachedBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - bottomThreshold;
      setIsAtBottom(reachedBottom);
    },
    [setScrollPosition]
  );

  /**
   * Restores list position after content lays out.
   */
  const handleContentSizeChange = useCallback(() => {
    if (timelineItems.length === 0) return;
    if (!didRestoreRef.current) {
      if (restoreOffsetRef.current === null) {
        restoreOffsetRef.current = scrollPositions.chat ?? 0;
      }
      if (restoreOffsetRef.current > 0) {
        listRef.current?.scrollToOffset({ offset: restoreOffsetRef.current, animated: false });
      } else {
        listRef.current?.scrollToEnd({ animated: false });
      }
      const bottomThreshold = SPACING.lg;
      const currentOffset = restoreOffsetRef.current ?? 0;
      const reachedBottom = currentOffset + layoutHeightRef.current >= contentHeightRef.current - bottomThreshold;
      setIsAtBottom(reachedBottom);
      didRestoreRef.current = true;
    }
  }, [scrollPositions.chat, timelineItems.length]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    layoutHeightRef.current = event.nativeEvent.layout.height;
  }, []);

  const handleListContentSizeChange = useCallback(
    (width: number, height: number) => {
      contentHeightRef.current = height;
      handleContentSizeChange();
    },
    [handleContentSizeChange]
  );

  useEffect(() => {
    if (didRestoreRef.current) return;
    if ((scrollPositions.chat ?? 0) > 0) return;
    if (timelineItems.length === 0) return;
    const task = InteractionManager.runAfterInteractions(() => {
      listRef.current?.scrollToEnd({ animated: false });
      setIsAtBottom(true);
      didRestoreRef.current = true;
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: false });
      });
    });
    return () => task.cancel();
  }, [timelineItems.length, scrollPositions.chat]);

  /**
   * Offsets list position by keyboard height when it appears/disappears.
   */
  useEffect(() => {
    const currentOffset = scrollOffsetRef.current;
    const lastKeyboardHeight = lastKeyboardHeightRef.current;

    if (keyboardVisible) {
      const heightDelta = keyboardHeight - lastKeyboardHeight;
      if (!keyboardVisibleRef.current) {
        if (keyboardHeight > 0) {
          listRef.current?.scrollToOffset({
            offset: Math.max(currentOffset + keyboardHeight, 0),
            animated: true,
          });
        }
        keyboardVisibleRef.current = true;
        lastKeyboardHeightRef.current = keyboardHeight;
      } else if (heightDelta !== 0) {
        listRef.current?.scrollToOffset({
          offset: Math.max(currentOffset + heightDelta, 0),
          animated: true,
        });
        lastKeyboardHeightRef.current = keyboardHeight;
      }
    } else if (keyboardVisibleRef.current) {
      if (lastKeyboardHeight > 0) {
        listRef.current?.scrollToOffset({
          offset: Math.max(currentOffset - lastKeyboardHeight, 0),
          animated: true,
        });
      }
      keyboardVisibleRef.current = false;
      lastKeyboardHeightRef.current = 0;
    }
  }, [keyboardVisible, keyboardHeight]);

  const scrollToBottom = useCallback(() => {
    const offset = Math.max(contentHeightRef.current - layoutHeightRef.current, 0);
    if (offset <= 0) {
      // If content fits or is shorter than the view, fall back to scrollToEnd
      listRef.current?.scrollToEnd({ animated: true });
    } else {
      // Add a small extra to ensure the last item is fully visible
      listRef.current?.scrollToOffset({ offset: offset + SPACING.sm, animated: true });
    }
    setIsAtBottom(true);
  }, []);

  // Auto-scroll when a new message arrives and the user is already at the bottom.
  // This keeps the view pinned to the latest message if the user hasn't scrolled up.
  useEffect(() => {
    if (!isAtBottom) return;
    // Wait for layout to settle, then scroll
    const task = InteractionManager.runAfterInteractions(() => {
      const offset = Math.max(contentHeightRef.current - layoutHeightRef.current, 0);
      if (offset <= 0) {
        listRef.current?.scrollToEnd({ animated: true });
      } else {
        listRef.current?.scrollToOffset({ offset: offset + SPACING.sm, animated: true });
      }
    });

    return () => {
      // cancel if unmounted before interactions finish
      try {
        task.cancel();
      } catch (_) {}
    };
  }, [timelineItems.length, isAtBottom]);

  return (
    <View style={styles.container}>
      {/* Messages List */}
      <FlatList
        ref={listRef}
        data={timelineItems}
        renderItem={renderTimelineItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={listContentStyle}
        showsVerticalScrollIndicator={false}
        scrollEnabled={true}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        onScroll={handleListScroll}
        onContentSizeChange={handleListContentSizeChange}
        onLayout={handleLayout}
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
      {!isAtBottom && (
        <TouchableOpacity
          style={[
            styles.scrollToBottomButtonContainer,
            {
              // Align horizontally with the NavBar's visual content:
              // when keyboard visible the NavBar uses paddingHorizontal = SPACING.lg
              // otherwise it uses marginHorizontal + paddingHorizontal = SPACING.lg + SPACING.md
              right: keyboardVisible ? SPACING.lg : SPACING.lg + SPACING.md,
              // Position it just above the send button area (slightly lower than before)
              bottom: contentInsets.keyboardVisible
                ? contentInsets.bottomWithKeyboard + SPACING.sm
                : contentInsets.bottom + SPACING.sm,
            },
          ]}
          onPress={scrollToBottom}
          activeOpacity={0.8}
        >
          <GlassSurface intensity={50} style={styles.scrollToBottomButtonSurface}>
            <ICONS.down size={FONT_SIZES.base} color={COLORS.primary1} />
          </GlassSurface>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white3,
    width: "100%",
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
  // Container to position the glossy button
  scrollToBottomButtonContainer: {
    position: "absolute",
  },
  // Glass surface that matches the send button's size and proportions
  scrollToBottomButtonSurface: {
    width: FONT_SIZES.base * 2.5 + 1.5,
    height: FONT_SIZES.base * 2.5 + 1.5,
    borderRadius: FONT_SIZES.base,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...(SHADOWS.card as object),
  },
});
