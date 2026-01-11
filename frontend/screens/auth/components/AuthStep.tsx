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

const AuthStep: React.FC<Props> = ({ playOnceKey, mode = "agent", children }) => {
  const [typingDone, setTypingDone] = useState(false);

  return (
    <TextBouble mode={mode} playOnceKey={playOnceKey} onTypingDone={() => setTypingDone(true)}>
      {typeof children === "function" ? (children as (t: boolean) => ReactNode)(typingDone) : children}
    </TextBouble>
  );
};

export default AuthStep;
