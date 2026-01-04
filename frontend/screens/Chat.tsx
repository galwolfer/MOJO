import React, { useEffect, useMemo, useRef, useCallback, useState } from "react";
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
import { COLORS, FONT_SIZES, SHADOWS, SPACING, ICON_SIZES } from "../theme";
import { useNavigation } from "../context/NavigationContext";
import { useAuth } from "../context/AuthContext";
import { ICONS } from "../components/icons/icons";
import { setChatAuthToken } from "../services/chatService";
import { useKeyboard, useContentInsets } from "../hooks";
import { useChatSessions, useChatMessages } from "../hooks";
import { TimelineItem, buildTimelineItems } from "../utils/chatUtils";
import TimelineItemComponent from "../components/chat/TimelineItem";
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
  const [isAtBottom, setIsAtBottom] = useState(true);
  const { visible: keyboardVisible, height: keyboardHeight } = useKeyboard();
  const contentInsets = useContentInsets();

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

  const onSend = useCallback(() => {
    const todaySessionId = getTodaySessionId(sessionsRef.current);
    const activeSessionId = todaySessionId || sessionId;
    if (todaySessionId && todaySessionId !== sessionId) {
      setSessionId(todaySessionId);
    }
    handleSend(activeSessionId, () => sessionsRef.current);
  }, [handleSend, sessionId, getTodaySessionId, setSessionId]);

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
      const bottomThreshold = SPACING.lg;
      const reachedBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - bottomThreshold;
      setIsAtBottom(reachedBottom);
    },
    [setScrollPosition]
  );

  /**
   * Restores list position after content lays out.
   */
  const handleContentSizeChange = useCallback(() => {
    if (!didRestoreRef.current) {
      if (restoreOffsetRef.current === null) {
        restoreOffsetRef.current = scrollPositions.chat ?? 0;
      }
      if (restoreOffsetRef.current > 0) {
        listRef.current?.scrollToOffset({ offset: restoreOffsetRef.current, animated: false });
      } else {
        listRef.current?.scrollToEnd({ animated: false });
      }
      didRestoreRef.current = true;
    }
  }, [scrollPositions.chat]);

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
        onContentSizeChange={handleContentSizeChange}
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
            styles.scrollToBottomButton,
            {
              bottom: contentInsets.keyboardVisible
                ? contentInsets.bottomWithKeyboard + SPACING.lg
                : contentInsets.bottom + SPACING.lg,
            },
          ]}
          onPress={() => listRef.current?.scrollToEnd({ animated: true })}
          activeOpacity={0.8}
        >
          <ICONS.down size={ICON_SIZES.sm} color={COLORS.primary1} />
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
  scrollToBottomButton: {
    position: "absolute",
    right: SPACING.lg,
    width: SPACING.xlg,
    height: SPACING.xlg,
    borderRadius: SPACING.xlg,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    ...(SHADOWS.card as object),
  },
});
