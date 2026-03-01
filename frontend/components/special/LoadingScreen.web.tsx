import React, { useRef, useEffect, useState, useCallback } from "react";
import { View, StyleSheet } from "react-native";

import { COLORS } from "../../theme";
import { getDynamicColors } from "../../theme";
import { useColors } from "../../context/ThemeContext";
import { getApiBase } from "../../services/config";

// Animation timing constants (in seconds)
const FAST_LOAD_END = 2.25; // If loaded before this, finish animation here
const LOOP_START = 4; // Start looping from this point if still loading
const ANIMATION_END = 7.05; // Total animation duration

// Frame constants (60fps)
const FRAME_RATE = 60;
const FAST_LOAD_END_FRAME = Math.round(FAST_LOAD_END * FRAME_RATE); // ~135
const LOOP_START_FRAME = Math.round(LOOP_START * FRAME_RATE); // ~240
const ANIMATION_END_FRAME = 423;

interface LoadingScreenProps {
  onLoadingComplete: () => void;
  isAppReady: boolean;
}

type LoadingPhase = "initial" | "waitingForLoop" | "looping" | "finishing" | "complete";

export default function LoadingScreen({ onLoadingComplete, isAppReady }: LoadingScreenProps) {
  let colors;
  try {
    colors = useColors();
  } catch {
    colors = getDynamicColors("light");
  }
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<any | null>(null);
  const [serverConnected, setServerConnected] = useState(false);
  const [phase, setPhase] = useState<LoadingPhase>("initial");
  const phaseRef = useRef<LoadingPhase>("initial");
  const appReadyRef = useRef(isAppReady);
  const serverConnectedRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    appReadyRef.current = isAppReady;
  }, [isAppReady]);

  useEffect(() => {
    serverConnectedRef.current = serverConnected;
  }, [serverConnected]);

  // Check server connectivity
  useEffect(() => {
    let isMounted = true;
    let retryTimeout: ReturnType<typeof setTimeout>;

    const checkServer = async () => {
      try {
        const apiBase = getApiBase();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        // apiBase is like "http://localhost:3000/api"; hit /api/health
        const healthUrl = `${apiBase}/health`;
        const response = await fetch(healthUrl, {
          method: "GET",
          signal: controller.signal,
        }).catch(() => null);

        clearTimeout(timeoutId);

        if (isMounted) {
          if (response && response.ok) {
            setServerConnected(true);
          } else {
            retryTimeout = setTimeout(checkServer, 1000);
          }
        }
      } catch (error) {
        if (isMounted) {
          retryTimeout = setTimeout(checkServer, 1000);
        }
      }
    };

    checkServer();

    return () => {
      isMounted = false;
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, []);

  const isFullyLoaded = isAppReady && serverConnected;
  const isFullyLoadedRef = useRef(isFullyLoaded);

  useEffect(() => {
    isFullyLoadedRef.current = isFullyLoaded;
  }, [isFullyLoaded]);

  // Timing constants (ms)
  const FAST_LOAD_END_MS = 2250;
  const LOOP_START_MS = 4000;

  // Timers: check at 2.25s and 4s to decide completion/looping
  useEffect(() => {
    const fastLoadTimer = setTimeout(() => {
      if (phaseRef.current === "initial") {
        if (isFullyLoadedRef.current) {
          console.log("[LoadingScreen.web] Loaded before 2.25s, completing now");
          const anim = animationRef.current;
          if (anim && typeof anim.goToAndStop === "function") {
            try {
              anim.goToAndStop(ANIMATION_END_FRAME, true);
            } catch (e) {
              // ignore
            }
          }
          setPhase("complete");
          onLoadingComplete();
        } else {
          setPhase("waitingForLoop");
        }
      }
    }, FAST_LOAD_END_MS);

    const loopStartTimer = setTimeout(() => {
      if (phaseRef.current === "waitingForLoop") {
        if (isFullyLoadedRef.current) {
          console.log("[LoadingScreen.web] Loaded before 4s, completing now");
          const anim = animationRef.current;
          if (anim && typeof anim.goToAndStop === "function") {
            try {
              anim.goToAndStop(ANIMATION_END_FRAME, true);
            } catch (e) {
              // ignore
            }
          }
          setPhase("complete");
          onLoadingComplete();
        } else {
          setPhase("looping");
          const anim = animationRef.current;
          if (anim && typeof anim.goToAndPlay === "function") {
            try {
              anim.goToAndPlay(LOOP_START_FRAME, true);
            } catch (e) {
              // ignore
            }
          }
        }
      }
    }, LOOP_START_MS);

    return () => {
      clearTimeout(fastLoadTimer);
      clearTimeout(loopStartTimer);
    };
  }, [onLoadingComplete]);

  // If the app becomes loaded during waitingForLoop/looping, act accordingly
  useEffect(() => {
    if (isFullyLoaded && phaseRef.current === "waitingForLoop") {
      console.log("[LoadingScreen.web] Loaded during waitingForLoop, completing now");
      const anim = animationRef.current;
      if (anim && typeof anim.goToAndStop === "function") {
        try {
          anim.goToAndStop(ANIMATION_END_FRAME, true);
        } catch (e) {
          // ignore
        }
      }
      setPhase("complete");
      onLoadingComplete();
    } else if (isFullyLoaded && phaseRef.current === "looping") {
      console.log("[LoadingScreen.web] Loaded during looping, transitioning to finishing");
      setPhase("finishing");
    }
  }, [isFullyLoaded, onLoadingComplete]);

  // Initialize lottie-web animation on mount
  useEffect(() => {
    if (!containerRef.current) return;

    try {
      // Use require() to avoid TypeScript complaining about missing types for lottie-web
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const lottie = require("lottie-web");
      const anim = lottie.loadAnimation({
        container: containerRef.current,
        renderer: "svg",
        loop: false,
        autoplay: true,
        animationData: require("../../assets/lottieFiles/loadingScreen.json"),
      });

      animationRef.current = anim;

      // frame event
      anim.addEventListener("enterFrame", (e: any) => {
        const currentFrame = e.currentTime || e.currentFrame || 0;
        const currentPhase = phaseRef.current;
        const loaded = isFullyLoadedRef.current;

        if (currentPhase === "complete") return;

        if (currentPhase === "initial" && currentFrame >= FAST_LOAD_END_FRAME) {
          if (loaded) setPhase("finishing");
          else setPhase("waitingForLoop");
        }

        if (currentPhase === "waitingForLoop" && currentFrame >= LOOP_START_FRAME) {
          if (loaded) setPhase("finishing");
          else setPhase("looping");
        }

        if (currentPhase === "looping") {
          if (loaded) setPhase("finishing");
          else if (currentFrame >= ANIMATION_END_FRAME - 2) {
            anim.goToAndPlay(LOOP_START_FRAME, true);
          }
        }

        if (currentPhase === "finishing" && currentFrame >= ANIMATION_END_FRAME - 2) {
          setPhase("complete");
          onLoadingComplete();
        }
      });

      anim.addEventListener("complete", () => {
        const currentPhase = phaseRef.current;
        const loaded = isFullyLoadedRef.current;

        if (currentPhase === "finishing" || currentPhase === "initial") {
          if (loaded) {
            setPhase("complete");
            onLoadingComplete();
          }
        } else if (currentPhase === "looping" || currentPhase === "waitingForLoop") {
          if (!loaded) {
            anim.goToAndPlay(LOOP_START_FRAME, true);
          } else {
            setPhase("complete");
            onLoadingComplete();
          }
        }
      });

      return () => {
        anim.removeEventListener("enterFrame");
        anim.removeEventListener("complete");
        anim.destroy();
      };
    } catch (e) {
      console.error("Failed to load lottie animation on web:", e);
      // Fallback: if animation cannot be loaded on web, don't block the app
      setTimeout(() => {
        if (phaseRef.current !== "complete") {
          console.warn("LoadingScreen.web: Lottie failed, forcing completion");
          setPhase("complete");
          onLoadingComplete();
        }
      }, 500);
    }
  }, [onLoadingComplete]);

  // Effect to handle when app becomes fully loaded during looping
  useEffect(() => {
    if (isFullyLoaded && phase === "looping") {
      setPhase("finishing");
    }
  }, [isFullyLoaded, phase]);

  // Safety timeout
  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      if (phaseRef.current !== "complete") {
        console.warn("LoadingScreen: Safety timeout reached, forcing completion");
        setPhase("complete");
        onLoadingComplete();
      }
    }, 30000);

    return () => clearTimeout(safetyTimeout);
  }, [onLoadingComplete]);

  if (phase === "complete") {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg3 }]}>
      <div ref={containerRef as any} style={{ width: "100%", height: "100%" }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.white3,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
});
