import React, { useRef, useEffect, useState, useCallback } from "react";
import { View, StyleSheet } from "react-native";
import LottieView from "lottie-react-native";
import { COLORS } from "../../theme";
import { getDynamicColors } from "../../theme";
import { useColors } from "../../context/ThemeContext";
import { getApiBase } from "../../services/config";

// Animation timing constants (in milliseconds)
const FAST_LOAD_END_MS = 2250; // If loaded before 2.25s, let animation finish
const LOOP_START_MS = 4000; // Start looping from 4s if still loading

// Frame constants (60fps)
const FRAME_RATE = 60;
const LOOP_START_FRAME = Math.round((LOOP_START_MS / 1000) * FRAME_RATE); // ~240
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
  const lottieRef = useRef<LottieView>(null);
  const [serverConnected, setServerConnected] = useState(false);
  const [phase, setPhase] = useState<LoadingPhase>("initial");
  const phaseRef = useRef<LoadingPhase>("initial");
  const isFullyLoadedRef = useRef(false);
  const serverCheckAttemptsRef = useRef(0);

  // Determine size for the lottie animation (smaller on native/Android)
  const { width } = require("react-native").Dimensions.get("window");
  const animSize = Math.min(350, Math.round(width * 1.5));

  // Keep phase ref in sync
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Colorize animation JSON for Android to use COLORS.primary1
  const rawAnimation: any = require("../../assets/lottieFiles/loadingScreen.json");
  const colorizedAnimation = React.useMemo(() => {
    // Only colorize on Android (web should remain untouched)
    if (require("react-native").Platform.OS !== "android") return rawAnimation;

    const deepCopy: any = JSON.parse(JSON.stringify(rawAnimation));
    const hex = require("../../theme").COLORS.primary1;

    function hexToRgbNormalized(h: string) {
      const hex = h.replace("#", "");
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;
      return [r, g, b];
    }

    const rgb = hexToRgbNormalized(hex);

    function walk(node: any) {
      if (!node || typeof node !== "object") return;

      // Lottie color property heuristic: { c: { k: [r,g,b,a] } } or animated keyframes where k is array of frames
      if (node.c && node.c.k) {
        const k = node.c.k;
        if (Array.isArray(k) && typeof k[0] === "number") {
          // simple RGB array, set to primary1 with full alpha
          node.c.k = [rgb[0], rgb[1], rgb[2], 1];
        } else if (Array.isArray(k) && k.length > 0 && k[0] && k[0].s) {
          // animated color keyframes: set each s to the desired color
          for (const frame of k) {
            if (frame.s && Array.isArray(frame.s)) {
              frame.s = [rgb[0], rgb[1], rgb[2], 1];
            }
          }
        }
      }

      // Also check for stroke color (sc) or fills under other keys
      if (node.sc && node.sc.k) {
        node.sc.k = [rgb[0], rgb[1], rgb[2], 1];
      }

      // Recurse
      for (const key of Object.keys(node)) {
        walk(node[key]);
      }
    }

    walk(deepCopy);
    return deepCopy;
  }, [rawAnimation]);

  // Check if fully loaded
  const isFullyLoaded = isAppReady && serverConnected;

  useEffect(() => {
    isFullyLoadedRef.current = isFullyLoaded;
  }, [isFullyLoaded, isAppReady, serverConnected]);

  // Check server connectivity
  useEffect(() => {
    let isMounted = true;
    let retryTimeout: ReturnType<typeof setTimeout>;

    const checkServer = async () => {
      try {
        serverCheckAttemptsRef.current += 1;
        const apiBase = getApiBase();

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout

        const healthUrl = `${apiBase}/health`;
        const response = await fetch(healthUrl, {
          method: "GET",
          signal: controller.signal,
        }).catch((err) => {
          return null;
        });

        clearTimeout(timeoutId);

        if (isMounted) {
          if (response && response.ok) {
            setServerConnected(true);
          } else {
            // Keep retrying indefinitely until server is reachable
            retryTimeout = setTimeout(checkServer, 1000);
          }
        }
      } catch (error) {
        if (isMounted) {
          // Keep retrying indefinitely
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

  // Timer-based phase management
  useEffect(() => {
    // Check at 2.25s mark
    const fastLoadTimer = setTimeout(() => {
      if (phaseRef.current === "initial") {
        if (isFullyLoadedRef.current) {
          // Loaded fast! Complete immediately at 2.25s
          setPhase("complete");
          onLoadingComplete();
        } else {
          setPhase("waitingForLoop");
        }
      }
    }, FAST_LOAD_END_MS);

    // Check at 4s mark
    const loopStartTimer = setTimeout(() => {
      if (phaseRef.current === "waitingForLoop") {
        if (isFullyLoadedRef.current) {
          // Loaded before 4s, complete immediately at 4s
          setPhase("complete");
          onLoadingComplete();
        } else {
          setPhase("looping");
        }
      }
    }, LOOP_START_MS);

    return () => {
      clearTimeout(fastLoadTimer);
      clearTimeout(loopStartTimer);
    };
  }, [onLoadingComplete]);

  // Handle entering looping phase - restart loop segment
  useEffect(() => {
    if (phase === "looping" && lottieRef.current) {
      lottieRef.current.play(LOOP_START_FRAME, ANIMATION_END_FRAME);
    }
  }, [phase]);

  // When fully loaded during looping phase, transition to finishing (let current loop complete)
  useEffect(() => {
    if (isFullyLoaded && phase === "looping") {
      setPhase("finishing");
    } else if (isFullyLoaded && phase === "waitingForLoop") {
      // Edge case: if app becomes loaded while in waitingForLoop phase (before 4s timer fires)
      // We should complete immediately rather than waiting for the 4s timer
      setPhase("complete");
      onLoadingComplete();
    }
  }, [isFullyLoaded, phase, onLoadingComplete]);

  // Handle animation finish
  const handleAnimationFinish = useCallback(() => {
    const currentPhase = phaseRef.current;
    const loaded = isFullyLoadedRef.current;

    if (currentPhase === "complete") return;

    if (currentPhase === "finishing") {
      // Animation finished while in finishing phase (during loop) - complete!
      setPhase("complete");
      onLoadingComplete();
    } else if (currentPhase === "looping") {
      if (loaded) {
        // Loaded during loop, complete now
        setPhase("complete");
        onLoadingComplete();
      } else {
        // Not loaded yet, restart the loop segment
        if (lottieRef.current) {
          lottieRef.current.play(LOOP_START_FRAME, ANIMATION_END_FRAME);
        }
      }
    } else if (currentPhase === "initial" || currentPhase === "waitingForLoop") {
      // Animation finished during initial/waiting phase (shouldn't happen normally with timers)
      if (loaded) {
        setPhase("complete");
        onLoadingComplete();
      } else {
        // Keep looping until loaded
        setPhase("looping");
        if (lottieRef.current) {
          lottieRef.current.play(LOOP_START_FRAME, ANIMATION_END_FRAME);
        }
      }
    }
  }, [onLoadingComplete]);

  // Safety timeout: Don't block forever
  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      if (phaseRef.current !== "complete") {
        setPhase("complete");
        onLoadingComplete();
      }
    }, 30000); // 30 second max

    return () => clearTimeout(safetyTimeout);
  }, [onLoadingComplete]);

  if (phase === "complete") {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg3 }]}>
      <LottieView
        ref={lottieRef}
        source={colorizedAnimation}
        style={[styles.animation, { width: animSize, height: animSize }]}
        autoPlay
        loop={false}
        onAnimationFinish={handleAnimationFinish}
        speed={1}
        resizeMode="contain"
      />
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
  animation: {
    width: "100%",
    height: "100%",
    maxWidth: 420,
    maxHeight: 420,
  },
});
