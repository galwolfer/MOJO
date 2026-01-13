import React from "react";
import AppText from "./AppText";

/**
 * ErrorText
 *
 * Small convenience wrapper for rendering error messages consistently.
 * Uses `AppText` with the `errorText` variant and accepts style overrides.
 */
const ErrorText: React.FC<{ style?: any; children?: React.ReactNode }> = ({ style, children }) => (
  <AppText variant="errorText" style={style}>
    {children}
  </AppText>
);

export default ErrorText;
