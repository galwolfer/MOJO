import React, { useRef, forwardRef, useImperativeHandle, useCallback, useEffect } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
  KeyboardAvoidingView,
  ScrollViewProps,
} from "react-native";
import { useLayout } from "../../context/LayoutContext";
import { useNavigation } from "../../context/NavigationContext";
import { useKeyboard } from "../../hooks";

export type ScrollableContentRef = {
  scrollToEnd: (animated?: boolean) => void;
  scrollTo: (options: { x?: number; y?: number; animated?: boolean }) => void;
};

type ScrollableContentProps = ScrollViewProps & {
  children: React.ReactNode;
  /** Whether to add padding for the floating header */
  respectHeader?: boolean;
  /** Whether to add padding for the floating navbar */
  respectNavBar?: boolean;
  /** Additional top padding beyond header */
  extraTopPadding?: number;
  /** Additional bottom padding beyond navbar */
  extraBottomPadding?: number;
  /** Whether to auto-scroll content when the keyboard changes */
  keyboardScrollAdjust?: boolean;
  /** Unique key for remembering scroll position across screen switches */
  scrollKey?: string;
};

/**
 * ScrollableContent component that handles:
 * - Scrolling area that respects floating header and navbar heights
 * - Keyboard-aware scrolling behavior
 * - Automatic padding adjustment based on layout context
 */
const ScrollableContent = forwardRef<ScrollableContentRef, ScrollableContentProps>(
  (
    {
      children,
      respectHeader = true,
      respectNavBar = true,
      extraTopPadding = 0,
      extraBottomPadding = 0,
      keyboardScrollAdjust = true,
      scrollKey,
      contentContainerStyle,
      style,
      onScroll,
      scrollEventThrottle,
      onContentSizeChange,
      ...scrollViewProps
    },
    ref
  ) => {
    const scrollViewRef = useRef<ScrollView>(null);
    const { dimensions } = useLayout();
    const { scrollPositions, setScrollPosition } = useNavigation();
    const { visible: keyboardVisible, height: keyboardHeight } = useKeyboard();
    const scrollOffsetRef = useRef(0);
    const keyboardVisibleRef = useRef(false);
    const lastKeyboardHeightRef = useRef(0);
    const restoreOffsetRef = useRef<number | null>(null);
    const didRestoreRef = useRef(false);

    useImperativeHandle(ref, () => ({
      scrollToEnd: (animated = true) => {
        scrollViewRef.current?.scrollToEnd({ animated });
      },
      scrollTo: (options) => {
        scrollViewRef.current?.scrollTo(options);
      },
    }));

    /**
     * Tracks scroll position while still allowing external scroll handlers.
     */
    const handleScroll = useCallback(
      (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
        if (scrollKey) {
          setScrollPosition(scrollKey, scrollOffsetRef.current);
        }
        onScroll?.(event);
      },
      [onScroll, scrollKey, setScrollPosition]
    );

    /**
     * Restores scroll position after content lays out.
     */
    const handleContentSizeChange = useCallback(
      (width: number, height: number) => {
        if (scrollKey && !didRestoreRef.current) {
          if (restoreOffsetRef.current === null) {
            restoreOffsetRef.current = scrollPositions[scrollKey] ?? 0;
          }
          if (restoreOffsetRef.current > 0) {
            scrollViewRef.current?.scrollTo({ y: restoreOffsetRef.current, animated: false });
          }
          didRestoreRef.current = true;
        }
        onContentSizeChange?.(width, height);
      },
      [onContentSizeChange, scrollKey, scrollPositions]
    );

    // Calculate top padding based on header
    const topPadding = respectHeader ? dimensions.headerHeight + extraTopPadding : extraTopPadding;

    // Calculate bottom padding based on navbar plus keyboard height when visible.
    const navBarPadding = respectNavBar ? dimensions.effectiveNavBarHeight : 0;
    const bottomPadding = navBarPadding + extraBottomPadding + (keyboardVisible ? keyboardHeight : 0);

    const computedContentStyle = [
      styles.contentContainer,
      {
        paddingTop: topPadding,
        paddingBottom: bottomPadding,
      },
      contentContainerStyle,
    ];

    const scrollContent = (
      <ScrollView
        ref={scrollViewRef}
        style={[styles.scrollView, style]}
        contentContainerStyle={computedContentStyle}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={scrollEventThrottle ?? 16}
        {...scrollViewProps}
        onScroll={handleScroll}
        onContentSizeChange={handleContentSizeChange}
      >
        {children}
      </ScrollView>
    );

    /**
     * Offsets scroll position by keyboard height when it appears/disappears.
     */
    useEffect(() => {
      if (!keyboardScrollAdjust) return;

      const currentOffset = scrollOffsetRef.current;
      const lastKeyboardHeight = lastKeyboardHeightRef.current;

      if (keyboardVisible) {
        const heightDelta = keyboardHeight - lastKeyboardHeight;
        if (!keyboardVisibleRef.current) {
          if (keyboardHeight > 0) {
            scrollViewRef.current?.scrollTo({
              y: Math.max(currentOffset + keyboardHeight, 0),
              animated: true,
            });
          }
          keyboardVisibleRef.current = true;
          lastKeyboardHeightRef.current = keyboardHeight;
        } else if (heightDelta !== 0) {
          scrollViewRef.current?.scrollTo({
            y: Math.max(currentOffset + heightDelta, 0),
            animated: true,
          });
          lastKeyboardHeightRef.current = keyboardHeight;
        }
      } else if (keyboardVisibleRef.current) {
        if (lastKeyboardHeight > 0) {
          scrollViewRef.current?.scrollTo({
            y: Math.max(currentOffset - lastKeyboardHeight, 0),
            animated: true,
          });
        }
        keyboardVisibleRef.current = false;
        lastKeyboardHeightRef.current = 0;
      }
    }, [keyboardVisible, keyboardHeight, keyboardScrollAdjust]);

    // On iOS, use KeyboardAvoidingView for smoother keyboard handling
    if (Platform.OS === "ios") {
      return (
        <KeyboardAvoidingView style={styles.container} behavior="padding" keyboardVerticalOffset={0}>
          {scrollContent}
        </KeyboardAvoidingView>
      );
    }

    return <View style={styles.container}>{scrollContent}</View>;
  }
);

ScrollableContent.displayName = "ScrollableContent";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
  },
  scrollView: {
    flex: 1,
    width: "100%",
  },
  contentContainer: {
    flexGrow: 1,
    width: "100%",
  },
});

export default ScrollableContent;
