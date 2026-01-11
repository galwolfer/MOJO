import React, { ReactNode, useState } from "react";
import TextBouble from "../../chat/components/TextBouble";

interface Props {
  playOnceKey?: string;
  mode?: "agent" | "user";
  /**
   * Child can be a function that receives typingDone boolean or a ReactNode
   * If function: (typingDone) => ReactNode
   */
  children?: ReactNode | ((typingDone: boolean) => ReactNode);
}

/**
 * AuthStep
 *
 * Wrapper used by auth flow steps to centralize the message bubble and typing
 * state. Accepts children either as React nodes or as a function that receives
 * `typingDone` boolean so children can react to the typing animation.
 */
const AuthStep: React.FC<Props> = ({ playOnceKey, mode = "agent", children }) => {
  const [typingDone, setTypingDone] = useState(false);

  return (
    <TextBouble mode={mode} playOnceKey={playOnceKey} onTypingDone={() => setTypingDone(true)}>
      {typeof children === "function" ? (children as (t: boolean) => ReactNode)(typingDone) : children}
    </TextBouble>
  );
};

export default AuthStep;
