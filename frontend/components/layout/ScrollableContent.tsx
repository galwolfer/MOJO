import React, { useRef, forwardRef, useImperativeHandle } from "react";
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
      contentContainerStyle,
      style,
      ...scrollViewProps
    },
    ref
  ) => {
    const scrollViewRef = useRef<ScrollView>(null);
    const { dimensions } = useLayout();
    const { visible: keyboardVisible, height: keyboardHeight } = useKeyboard();

    useImperativeHandle(ref, () => ({
      scrollToEnd: (animated = true) => {
        scrollViewRef.current?.scrollToEnd({ animated });
      },
      scrollTo: (options) => {
        scrollViewRef.current?.scrollTo(options);
      },
    }));

    // Calculate top padding based on header
    const topPadding = respectHeader ? dimensions.headerHeight + extraTopPadding : extraTopPadding;

    // Calculate bottom padding based on keyboard or navbar
    // When keyboard is visible, we adjust for keyboard height
    // When keyboard is hidden, we adjust for navbar
    const bottomPadding = keyboardVisible
      ? keyboardHeight + extraBottomPadding
      : respectNavBar
      ? dimensions.effectiveNavBarHeight + extraBottomPadding
      : extraBottomPadding;

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
        scrollEventThrottle={16}
        {...scrollViewProps}
      >
        {children}
      </ScrollView>
    );

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
