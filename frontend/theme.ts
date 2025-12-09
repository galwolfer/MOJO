export const COLORS = {
  // Primary colors
  primary1: "#4361EE",
  primary2: "#4CC9F0",
  primary3: "#7209B7",
  primary4: "#F72585",
  primary5: "#ECA32E",
  primary6: "#F43E3E",

  // Bright palette
  brightP1: "#6F86F2",
  brightP2: "#B4E6F6",
  brightP3: "#D3A7F1",
  brightP4: "#FFBCDB",
  brightP5: "#FFD796",
  brightP6: "#A7F7B6",
  brightP7: "#FFADAD",

  // Dark palette
  darkP1: "#1F3BC0",
  darkP2: "#238EAF",
  darkP3: "#5A1389",
  darkP4: "#BC105F",
  darkP5: "#D38911",
  darkP6: "#118826",
  darkP7: "#DA2727",

  // Neutrals
  white: "#F2F5FF",
  white2: "#E6E9F7",
  white3: "#D8DEF7",
  colorWhite: "#FFFFFF",
  black: "#141519",
  darkGray: "#3B3E50",
  lightGray: "#A1A8C8",
  grayLight: "#A1A8C8",

  // Misc / special
  shadow15277c14: "rgba(21, 39, 124, 0.14)",
  transparentWhite: "rgba(255, 255, 255, 0)",
};

export const SPACING = {
  sm: 5,
  md: 10,
  lg: 17,
  xlg: 28,
};

export const FONTS = {
  fredokaExtraLight: "Fredoka-ExtraLight",
  fredokaThin: "Fredoka-Thin",
  fredokaLight: "Fredoka-Light",
  fredokaMedium: "Fredoka-Medium",
  fredokaDemiBold: "Fredoka-DemiBold",
  fredokaBold: "Fredoka-Bold",
  fredokaHeavy: "Fredoka-Heavy",
};

// System fonts as fallback when custom fonts aren't available (Expo Go)
export const SYSTEM_FONTS = {
  fredokaExtraLight: "sans-serif-light",
  fredokaThin: "sans-serif-light",
  fredokaLight: "sans-serif-light",
  fredokaMedium: "sans-serif-medium",
  fredokaDemiBold: "sans-serif-medium",
  fredokaBold: "sans-serif",
  fredokaHeavy: "sans-serif-black",
};

export const TYPOGRAPHY = {
  title: {
    fontFamily: FONTS.fredokaMedium,
    fontSize: 28,
    fontWeight: "600" as const,
    textTransform: "uppercase" as const,
    color: COLORS.primary1,
  },
  title2: {
    fontFamily: FONTS.fredokaMedium,
    fontSize: 22,
    fontWeight: "600" as const,
    textTransform: "uppercase" as const,
    color: COLORS.primary1,
  },
  title3: {
    fontFamily: FONTS.fredokaBold,
    fontSize: 14,
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    color: COLORS.black,
  },
  bodyText: {
    fontFamily: FONTS.fredokaLight,
    fontSize: 14,
    fontWeight: "300" as const,
    color: COLORS.black,
  },
  notes: {
    fontFamily: FONTS.fredokaExtraLight,
    fontSize: 11,
    fontWeight: "300" as const,
    color: COLORS.black,
  },
};
