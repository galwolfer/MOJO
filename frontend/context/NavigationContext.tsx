import React, { createContext, useState, useContext, ReactNode } from "react";

export type TabName = "chat" | "calendar" | "user";

export type HeaderConfig = {
  title?: string;
  icon?: any; // Icon component or source
  show?: boolean;
  rightElement?: ReactNode;
  leftElement?: ReactNode; // e.g. Return icon
  centerElement?: ReactNode; // Custom title area
};

export type NavBarConfig = {
  show?: boolean;
  widget?: ReactNode; // Extra content to show (e.g. Chat Input)
  customComponent?: ReactNode; // Completely replace navbar content
};

type NavigationContextType = {
  activeTab: TabName;
  setActiveTab: (tab: TabName) => void;
  headerConfig: HeaderConfig;
  setHeaderConfig: (config: HeaderConfig) => void;
  navBarConfig: NavBarConfig;
  setNavBarConfig: (config: NavBarConfig) => void;
};

const NavigationContext = createContext<NavigationContextType>({} as NavigationContextType);

export const NavigationProvider = ({ children }: { children: ReactNode }) => {
  const [activeTab, setActiveTab] = useState<TabName>("chat");
  const [headerConfig, setHeaderConfig] = useState<HeaderConfig>({
    title: "Mojo",
    show: true,
  });
  const [navBarConfig, setNavBarConfig] = useState<NavBarConfig>({
    show: true,
  });

  return (
    <NavigationContext.Provider
      value={{
        activeTab,
        setActiveTab,
        headerConfig,
        setHeaderConfig,
        navBarConfig,
        setNavBarConfig,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => useContext(NavigationContext);
