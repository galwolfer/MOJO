import React, { useEffect, useMemo, useRef, useCallback, useState } from "react";
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
  Animated,
  Easing,
} from "react-native";
import AppText from "../components/common/AppText";
import Input from "../components/inputs/Input";
import { COLORS, FONT_SIZES, SHADOWS, SPACING } from "../theme";
import { useNavigation, type ChatScrollState } from "../context/NavigationContext";
import { useAuth } from "../context/AuthContext";
import { ICONS } from "../components/icons/icons";
import { setChatAuthToken } from "../services/chatService";
import { useKeyboard } from "../hooks";
import { useChatSessions, useChatMessages } from "../hooks";
import { TimelineItem, buildTimelineItems } from "../utils/chatUtils";
import TimelineItemComponent from "../components/chat/TimelineItem";
import type { ChatSessionSummary } from "../services/chatService";

const SCROLL_DOWN_THRESHOLD = 120;
const KEYBOARD_SCROLL_THRESHOLD = 80;

export default function ChatScreen() {
  const { setHeaderConfig, setNavBarConfig, chatScrollState, setChatScrollState } = useNavigation();
  const { token } = useAuth();
  const flatListRef = useRef<FlatList>(null);
  const sessionsRef = useRef<ChatSessionSummary[]>([]);
  const scrollStateRef = useRef<ChatScrollState>(chatScrollState);
  const scrollDownOpacity = useRef(new Animated.Value(0)).current;
  const scrollDownVisibleRef = useRef(false);
  const lastDistanceFromBottomRef = useRef(0);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const { visible: keyboardVisible, height: keyboardHeight } = useKeyboard();
  // Keep a small padding inside the list; overall keyboard offset is handled at layout level to avoid double-padding
  const listPaddingBottom = SPACING.md;
  // Prevent scheduling multiple concurrent scroll timers when keyboard toggles repeatedly
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAtBottomRef = useRef(true);
  const hasInitialScrollRef = useRef(false);

  const { sessions, isLoadingSessions, isLoadingMoreSessions, hasMoreSessions, loadMoreSessions, updateSession } =
    useChatSessions();

  const { message, setMessage, isLoading, sessionId, setSessionId, handleSend, handleRetry } =
    useChatMessages(updateSession);

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
      setChatScrollState(scrollStateRef.current);
    };
  }, [setNavBarConfig, setChatScrollState]);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    scrollStateRef.current = chatScrollState;
    lastDistanceFromBottomRef.current = chatScrollState.distanceFromBottom ?? 0;
  }, [chatScrollState]);

  const setScrollDownVisible = useCallback(
    (nextVisible: boolean) => {
      if (scrollDownVisibleRef.current === nextVisible) return;
      scrollDownVisibleRef.current = nextVisible;
      setShowScrollDown(nextVisible);
      Animated.timing(scrollDownOpacity, {
        toValue: nextVisible ? 1 : 0,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    },
    [scrollDownOpacity]
  );

  const scrollDownTranslate = useMemo(
    () => scrollDownOpacity.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }),
    [scrollDownOpacity]
  );

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

  const scrollToBottom = useCallback(
    (animated = true) => {
    // Clear any pending schedule to avoid buildup
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current as any);
      scrollTimeoutRef.current = null;
    }
    // Schedule a scroll after layout settles. Use InteractionManager on native to be safer.
    const run = () => {
      flatListRef.current?.scrollToEnd({ animated });
      isAtBottomRef.current = true;
      lastDistanceFromBottomRef.current = 0;
      scrollStateRef.current = {
        ...scrollStateRef.current,
        isAtBottom: true,
        hasScroll: scrollStateRef.current.hasScroll,
        distanceFromBottom: 0,
      };
      setScrollDownVisible(false);
    };
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
    },
    [setScrollDownVisible]
  );

  const restoreScrollPosition = useCallback(() => {
    const saved = scrollStateRef.current;
    if (!saved.hasScroll || saved.isAtBottom) {
      scrollToBottom(false);
      return;
    }
    const offset = Math.max(0, saved.offset);
    flatListRef.current?.scrollToOffset({ offset, animated: false });
    isAtBottomRef.current = false;
    lastDistanceFromBottomRef.current = saved.distanceFromBottom ?? SCROLL_DOWN_THRESHOLD + 1;
    setScrollDownVisible(true);
  }, [scrollToBottom, setScrollDownVisible]);

  // When keyboard appears or its height changes, ensure the list scrolls to bottom
  useEffect(() => {
    if (keyboardVisible) {
      // Only auto-scroll if the user is already at the bottom
      if (isAtBottomRef.current || lastDistanceFromBottomRef.current <= KEYBOARD_SCROLL_THRESHOLD) {
        scrollToBottom();
      }
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
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      const y = contentOffset.y;
      const distanceFromBottom = Math.max(0, contentSize.height - (y + layoutMeasurement.height));
      const atBottom = y + layoutMeasurement.height >= contentSize.height - 20;
      isAtBottomRef.current = atBottom;
      lastDistanceFromBottomRef.current = distanceFromBottom;
      scrollStateRef.current = {
        offset: y,
        isAtBottom: atBottom,
        hasScroll: true,
        distanceFromBottom,
      };
      setScrollDownVisible(distanceFromBottom > SCROLL_DOWN_THRESHOLD);
      // Trigger load more when scrolling near the top
      if (y <= 50 && hasMoreSessions && !isLoadingMoreSessions) {
        loadMoreSessions();
      }
    },
    [loadMoreSessions, hasMoreSessions, isLoadingMoreSessions, setScrollDownVisible]
  );

  const onSend = useCallback(() => {
    const todaySessionId = getTodaySessionId(sessionsRef.current);
    const activeSessionId = todaySessionId || sessionId;
    if (todaySessionId && todaySessionId !== sessionId) {
      setSessionId(todaySessionId);
    }
    handleSend(activeSessionId, () => sessionsRef.current);
    scrollToBottom();
  }, [handleSend, sessionId, scrollToBottom, getTodaySessionId, setSessionId]);

  const onRetry = useCallback(
    (sessionIdToRetry: string, clientId: string) => {
      handleRetry(sessionIdToRetry, clientId, () => sessionsRef.current);
    },
    [handleRetry]
  );

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
      <TimelineItemComponent
        item={item}
        isLastItem={index === timelineItems.length - 1}
        onRetry={onRetry}
      />
    ),
    [timelineItems.length, onRetry]
  );

  const keyExtractor = useCallback((item: TimelineItem) => item.id, []);
  const persistScrollState = useCallback(() => {
    setChatScrollState(scrollStateRef.current);
  }, [setChatScrollState]);

  const onContentSizeChange = useCallback(() => {
    if (!hasInitialScrollRef.current) {
      if (timelineItems.length === 0 && isLoadingSessions) {
        return;
      }
      const saved = scrollStateRef.current;
      if (saved.hasScroll && !saved.isAtBottom) {
        restoreScrollPosition();
      } else {
        scrollToBottom(false);
      }
      hasInitialScrollRef.current = true;
      return;
    }

    if (isAtBottomRef.current) {
      scrollToBottom();
    }
  }, [restoreScrollPosition, scrollToBottom, timelineItems.length, isLoadingSessions]);

  useEffect(() => {
    if (timelineItems.length === 0) {
      setScrollDownVisible(false);
    }
  }, [timelineItems.length, setScrollDownVisible]);

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
        onContentSizeChange={onContentSizeChange}
        onScroll={onScrollLoadMore}
        onScrollEndDrag={persistScrollState}
        onMomentumScrollEnd={persistScrollState}
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
      {timelineItems.length > 0 ? (
        <Animated.View
          pointerEvents={showScrollDown ? "auto" : "none"}
          style={[
            styles.scrollToBottomWrapper,
            { opacity: scrollDownOpacity, transform: [{ translateY: scrollDownTranslate }] },
          ]}
        >
          <TouchableOpacity style={styles.scrollToBottomButton} onPress={() => scrollToBottom()}>
            <ICONS.down size={FONT_SIZES.base} color={COLORS.lightGray} />
          </TouchableOpacity>
        </Animated.View>
      ) : null}
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
  scrollToBottomWrapper: {
    position: "absolute",
    right: SPACING.lg,
    bottom: SPACING.lg,
  },
  scrollToBottomButton: {
    width: FONT_SIZES.base * 2.2,
    height: FONT_SIZES.base * 2.2,
    borderRadius: FONT_SIZES.base,
    backgroundColor: COLORS.white2,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.card,
  },
});
