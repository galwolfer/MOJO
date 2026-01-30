import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getUserPreferences } from "../services/apiClient";
import { getOjoType } from "../config/ojoTypeConfig";

type OjoContextType = {
  gradient: string[] | null;
  ojoName?: string | null;
  refresh?: () => Promise<void>;
};

const OjoContext = createContext<OjoContextType>({ gradient: null });

export const OjoProvider = ({ children }: { children: ReactNode }) => {
  const [gradient, setGradient] = useState<string[] | null>(null);
  const [ojoName, setOjoName] = useState<string | null>(null);

  const load = async () => {
    try {
      const prefs = await getUserPreferences();
      const name = prefs?.ojoType?.name as any;
      const cfg = name ? getOjoType(name) : getOjoType("mentorjo");
      setGradient(cfg.gradient2 ?? cfg.gradient ?? [cfg.color, cfg.color]);
      setOjoName(name ?? null);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    load();
  }, []);

  return <OjoContext.Provider value={{ gradient, ojoName, refresh: load }}>{children}</OjoContext.Provider>;
};

export const useOjo = () => useContext(OjoContext);
