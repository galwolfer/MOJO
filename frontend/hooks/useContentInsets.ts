import { useMemo } from "react";
import { useLayout } from "../context/LayoutContext";
import useKeyboard from "./useKeyboard";

export type ContentInsets = {
  top: number;
  bottom: number;
  /** Bottom inset when keyboard is visible */
  bottomWithKeyboard: number;
  /** Whether keyboard is currently visible */
  keyboardVisible: boolean;
  /** Raw header height */
  headerHeight: number;
  /** Raw navbar height */
  navBarHeight: number;
  /** Navbar height including margins */
  effectiveNavBarHeight: number;
};

/**
 * Hook to get content insets for screens that need to respect
 * floating header and navbar while managing their own scrolling.
 *
 * Usage:
 * ```tsx
 * const { top, bottom, keyboardVisible, bottomWithKeyboard } = useContentInsets();
 *
 * // For FlatList:
 * <FlatList
 *   contentContainerStyle={{
 *     paddingTop: top,
 *     paddingBottom: keyboardVisible ? bottomWithKeyboard : bottom,
 *   }}
 * />
 * ```
 */
export default function useContentInsets(): ContentInsets {
  const { dimensions } = useLayout();
  const { visible: keyboardVisible, height: keyboardHeight } = useKeyboard();

  return useMemo(
    () => ({
      top: dimensions.headerHeight,
      bottom: dimensions.effectiveNavBarHeight,
      bottomWithKeyboard: keyboardHeight,
      keyboardVisible,
      headerHeight: dimensions.headerHeight,
      navBarHeight: dimensions.navBarHeight,
      effectiveNavBarHeight: dimensions.effectiveNavBarHeight,
    }),
    [dimensions, keyboardVisible, keyboardHeight]
  );
}
