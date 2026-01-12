import React, { ReactNode, useState, useMemo } from "react";
import TextBouble from "../../chat/components/TextBouble";

// Access the same playedMap used in TextBouble
const playedMap = new Map<string, boolean>();

interface Props {
  playOnceKey?: string;
  mode?: "agent" | "user";
  /**
   * Child can be a function that receives typingDone boolean or a ReactNode
   * If function: (typingDone, skipAnimation) => ReactNode
   */
  children?: ReactNode | ((typingDone: boolean, skipAnimation: boolean) => ReactNode);
}

/**
 * AuthStep
 *
 * Wrapper used by auth flow steps to centralize the message bubble and typing
 * state. Accepts children either as React nodes or as a function that receives
 * `typingDone` boolean and `skipAnimation` boolean so children can react to the typing animation.
 */
const AuthStep: React.FC<Props> = ({ playOnceKey, mode = "agent", children }) => {
  const [typingDone, setTypingDone] = useState(false);

  // Check if this playOnceKey has already been played
  const hasPlayed = useMemo(() => {
    return Boolean(playOnceKey && playedMap.get(playOnceKey));
  }, [playOnceKey]);

  // If already played, widgets should skip their animations
  const skipAnimation = hasPlayed;

  return (
    <TextBouble
      mode={mode}
      playOnceKey={playOnceKey}
      onTypingDone={() => {
        setTypingDone(true);
        if (playOnceKey) playedMap.set(playOnceKey, true);
      }}
    >
      {typeof children === "function"
        ? (children as (t: boolean, s: boolean) => ReactNode)(typingDone || hasPlayed, skipAnimation)
        : children}
    </TextBouble>
  );
};

export default AuthStep;
