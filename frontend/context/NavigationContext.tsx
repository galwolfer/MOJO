import React, { createContext, useState, useContext, ReactNode } from "react";

/**
 * NavigationContext
 *
 * Centralized navigation and header/navbar configuration for the app.
 */

export type TabName = "chat" | "calendar" | "user" | "create" | "edit" | "overdue";

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
};

const NavigationContext = createContext<NavigationContextType>({} as NavigationContextType);

export const NavigationProvider = ({ children }: { children: ReactNode }) => {
  const [activeTab, setActiveTab] = useState<TabName>("chat");
  const [navigationParams, setNavigationParams] = useState<NavigationParams>({});

  const setActiveTabWithParams = (tab: TabName, params: NavigationParams) => {
    setNavigationParams(params);
    setActiveTab(tab);
  };

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
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => useContext(NavigationContext);
