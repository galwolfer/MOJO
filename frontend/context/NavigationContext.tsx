import React, { createContext, useState, useContext, ReactNode, useRef, useCallback, useEffect } from "react";
import { BackHandler, Platform } from "react-native";

/**
 * NavigationContext
 *
 * Centralized navigation and header/navbar configuration for the app.
 *
 * Back navigation is handled via a LIFO handler stack (registerBackHandler).
 * Components push a handler on mount and pop it on unmount. goBack() tries
 * all handlers newest-first; if none handle it, the default tab-level logic
 * runs (add/edit/alltasks → calendar, others → no-op / let OS handle it).
 */

export type TabName = "chat" | "calendar" | "user" | "create" | "edit" | "alltasks" | "notifications";

export type HeaderConfig = {
  title?: string;
  icon?: React.ComponentType<{ size?: number; color?: string }>; // Icon component that accepts size/color
  show?: boolean;
  rightElement?: ReactNode;
  leftElement?: ReactNode; // e.g. Return icon
  element?: ReactNode; // Custom title area
};

export type NavBarConfig = {
  show?: boolean;
  widget?: ReactNode; // Extra content to show (e.g. Chat Input)
  customComponent?: ReactNode; // Completely replace navbar content
};

export type ChatScrollState = {
  offset: number;
  isAtBottom: boolean;
  hasScroll: boolean;
  distanceFromBottom: number;
};

export type ScrollPositions = Record<string, number>;

export type NavigationParams = Record<string, any>;

type NavigationContextType = {
  activeTab: TabName;
  setActiveTab: (tab: TabName) => void;
  navigationParams: NavigationParams;
  setActiveTabWithParams: (tab: TabName, params: NavigationParams) => void;
  headerConfig: HeaderConfig;
  setHeaderConfig: (config: HeaderConfig) => void;
  navBarConfig: NavBarConfig;
  setNavBarConfig: (config: NavBarConfig) => void;
  chatScrollState: ChatScrollState;
  setChatScrollState: (state: ChatScrollState) => void;
  scrollPositions: ScrollPositions;
  setScrollPosition: (key: string, offset: number) => void;
  /** Persists the calendar's selected date across tab switches. */
  calendarSelectedDate: Date;
  setCalendarSelectedDate: (date: Date) => void;
  /**
   * Register a back-navigation handler. The handler should return `true` if it
   * consumed the back action, `false` to let the next handler (or default) run.
   * Returns an unregister function – call it in the component's cleanup.
   *
   * Handlers are invoked LIFO (last registered fires first), so inner modals
   * and sub-screens always take priority over outer screens.
   */
  registerBackHandler: (fn: () => boolean) => () => void;
  /** Programmatically trigger back navigation (same logic as hardware back). */
  goBack: () => void;
};

const NavigationContext = createContext<NavigationContextType>({} as NavigationContextType);

export const NavigationProvider = ({ children }: { children: ReactNode }) => {
  const [activeTab, _setActiveTab] = useState<TabName>("chat");
  const [navigationParams, setNavigationParams] = useState<NavigationParams>({});

  // Track previous tab in a ref so goBack() can read it without stale closures
  const activeTabRef = useRef<TabName>("chat");
  const previousTabRef = useRef<TabName | null>(null);

  const setActiveTab = useCallback((tab: TabName) => {
    previousTabRef.current = activeTabRef.current;
    activeTabRef.current = tab;
    _setActiveTab(tab);
  }, []);

  const setActiveTabWithParams = useCallback(
    (tab: TabName, params: NavigationParams) => {
      setNavigationParams(params);
      setActiveTab(tab);
    },
    [setActiveTab],
  );

  // ── Back handler stack (LIFO) ───────────────────────────────────────────
  const backHandlersRef = useRef<Array<() => boolean>>([]);

  const registerBackHandler = useCallback((fn: () => boolean): (() => void) => {
    backHandlersRef.current = [...backHandlersRef.current, fn];
    return () => {
      backHandlersRef.current = backHandlersRef.current.filter((h) => h !== fn);
    };
  }, []);

  const goBack = useCallback(() => {
    // Try registered handlers newest-first
    const handlers = [...backHandlersRef.current].reverse();
    for (const handler of handlers) {
      if (handler()) return;
    }

    // Default tab-level back logic
    const tab = activeTabRef.current;
    if (tab === "create") {
      setActiveTab("calendar");
    } else if (tab === "edit") {
      setActiveTab(previousTabRef.current ?? "calendar");
    } else if (tab === "alltasks") {
      setActiveTab("calendar");
    } else if (tab === "notifications") {
      setActiveTab(previousTabRef.current ?? "chat");
    }
    // chat / calendar / user → let OS handle it (minimize / exit)
  }, [setActiveTab]);

  // Android hardware back button
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      goBack();
      return true; // always consume — our goBack handles the no-op cases
    });
    return () => subscription.remove();
  }, [goBack]);

  const [headerConfig, setHeaderConfig] = useState<HeaderConfig>({
    title: "Mojo",
    show: true,
  });
  const [navBarConfig, setNavBarConfig] = useState<NavBarConfig>({
    show: true,
  });
  const [chatScrollState, setChatScrollState] = useState<ChatScrollState>({
    offset: 0,
    isAtBottom: true,
    hasScroll: false,
    distanceFromBottom: 0,
  });
  const [scrollPositions, setScrollPositions] = useState<ScrollPositions>({});

  const setScrollPosition = (key: string, offset: number) => {
    setScrollPositions((prev) => ({ ...prev, [key]: offset }));
  };

  const [calendarSelectedDate, setCalendarSelectedDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  return (
    <NavigationContext.Provider
      value={{
        activeTab,
        setActiveTab,
        navigationParams,
        setActiveTabWithParams,
        headerConfig,
        setHeaderConfig,
        navBarConfig,
        setNavBarConfig,
        chatScrollState,
        setChatScrollState,
        scrollPositions,
        setScrollPosition,
        calendarSelectedDate,
        setCalendarSelectedDate,
        registerBackHandler,
        goBack,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => useContext(NavigationContext);
