import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type LayoutDimensions = {
  headerHeight: number;
  navBarHeight: number;
  effectiveNavBarHeight: number; // includes margin
};

type LayoutContextType = {
  dimensions: LayoutDimensions;
  setHeaderHeight: (height: number) => void;
  setNavBarHeight: (height: number, effectiveHeight: number) => void;
};

const LayoutContext = createContext<LayoutContextType>({
  dimensions: { headerHeight: 0, navBarHeight: 0, effectiveNavBarHeight: 0 },
  setHeaderHeight: () => {},
  setNavBarHeight: () => {},
});

export const LayoutProvider = ({ children }: { children: ReactNode }) => {
  const [dimensions, setDimensions] = useState<LayoutDimensions>({
    headerHeight: 0,
    navBarHeight: 0,
    effectiveNavBarHeight: 0,
  });

  const setHeaderHeight = useCallback((height: number) => {
    setDimensions((prev) => ({ ...prev, headerHeight: height }));
  }, []);

  const setNavBarHeight = useCallback((height: number, effectiveHeight: number) => {
    setDimensions((prev) => ({
      ...prev,
      navBarHeight: height,
      effectiveNavBarHeight: effectiveHeight,
    }));
  }, []);

  return (
    <LayoutContext.Provider value={{ dimensions, setHeaderHeight, setNavBarHeight }}>{children}</LayoutContext.Provider>
  );
};

export const useLayout = () => useContext(LayoutContext);
