import { moderateScale, s, scale, verticalScale } from "react-native-size-matters";
import { Platform } from "react-native";

export const COLORS = {
  // Primary colors
  primary1: "#4361EE",
  primary2: "#4CC9F0",
  primary3: "#7209B7",
  primary4: "#F72585",
  primary5: "#ECA32E",
  primary6: "#38AF4D",
  primary7: "#F43E3E",

  // Bright palette
  brightP1: "#96a7f0",
  brightP2: "#B4E6F6",
  brightP3: "#D3A7F1",
  brightP4: "#FFBCDB",
  brightP5: "#FFD796",
  brightP6: "#A7F7B6",
  brightP7: "#FFADAD",
  lightGray: "#7d87a7",

  // Dark palette
  darkP1: "#1F3BC0",
  darkP2: "#238EAF",
  darkP3: "#5A1389",
  darkP4: "#BC105F",
  darkP5: "#D38911",
  darkP6: "#118826",
  darkP7: "#DA2727",
  darkGray: "#4a567b",

  // Light theme colors
  white1: "#F2F5FF",
  white2: "#E6E9F7",
  white3: "#D8DEF7",

  // Dark theme colors
  black1: "#141519",
  black2: "#1A1D2A",
  black3: "#202435",

  // Legacy neutrals (kept for backward compatibility)
  white: "#F2F5FF",
  colorWhite: "#F2F5FF",
  black: "#141519",

  // Misc / special
  shadow15277c14: "rgba(21, 39, 124, 0.14)",
  transparentWhite: "rgba(255, 255, 255, 0)",
};

/**
 * Dynamic theme colors based on light/dark mode.
 * Every UI surface / text element should reference these tokens
 * so the entire app can flip between light and dark with one toggle.
 */
export type ThemeMode = "light" | "dark";

export interface ThemeColors {
  // Backgrounds
  bg1: string;
  bg2: string;
  bg3: string;

  // Gray tones (swap in dark mode for contrast)
  gray1: string;
  gray2: string;

  // Text
  text1: string; // primary text (all body / heading text)
  text2: string; // text on coloured buttons – always light

  // Primary accent colors (unchanged between modes)
  primary1: string;
  primary2: string;
  primary3: string;
  primary4: string;
  primary5: string;
  primary6: string;
  primary7: string;

  // "Light" palette (bright in light mode, dark-tint in dark mode)
  lightP1: string;
  lightP2: string;
  lightP3: string;
  lightP4: string;
  lightP5: string;
  lightP6: string;
  lightP7: string;

  // "Dark" palette (dark-tint in light mode, bright in dark mode)
  darkP1: string;
  darkP2: string;
  darkP3: string;
  darkP4: string;
  darkP5: string;
  darkP6: string;
  darkP7: string;

  // Misc / derived
  shadow: string;
  divider: string;
  inputBg: string;
  inputBorder: string;
}

/**
 * @deprecated Use `getDynamicColors` instead. Kept only for backwards-compat
 * in files that haven't been migrated yet.
 */
export function getThemeColors(
  mode: ThemeMode = "light",
): Pick<ThemeColors, "bg1" | "bg2" | "bg3" | "text1" | "text2"> & { text3: string } {
  const dc = getDynamicColors(mode);
  return { bg1: dc.bg1, bg2: dc.bg2, bg3: dc.bg3, text1: dc.text1, text2: dc.text2, text3: dc.gray1 };
}

export function getDynamicColors(mode: ThemeMode = "light"): ThemeColors {
  if (mode === "dark") {
    return {
      bg1: COLORS.black1,
      bg2: COLORS.black2,
      bg3: COLORS.black3,
      gray1: COLORS.darkGray,
      gray2: COLORS.lightGray,
      text1: COLORS.white1,
      text2: COLORS.white1,
      primary1: COLORS.primary1,
      primary2: COLORS.primary2,
      primary3: COLORS.primary3,
      primary4: COLORS.primary4,
      primary5: COLORS.primary5,
      primary6: COLORS.primary6,
      primary7: COLORS.primary7,
      lightP1: COLORS.darkP1,
      lightP2: COLORS.darkP2,
      lightP3: COLORS.darkP3,
      lightP4: COLORS.darkP4,
      lightP5: COLORS.darkP5,
      lightP6: COLORS.darkP6,
      lightP7: COLORS.darkP7,
      darkP1: COLORS.brightP1,
      darkP2: COLORS.brightP2,
      darkP3: COLORS.brightP3,
      darkP4: COLORS.brightP4,
      darkP5: COLORS.brightP5,
      darkP6: COLORS.brightP6,
      darkP7: COLORS.brightP7,
      shadow: "rgba(0, 0, 0, 0.3)",
      divider: COLORS.black3,
      inputBg: COLORS.black2,
      inputBorder: COLORS.black3,
    };
  }
  // Light mode (default)
  return {
    bg1: COLORS.white1,
    bg2: COLORS.white2,
    bg3: COLORS.white3,
    gray1: COLORS.lightGray,
    gray2: COLORS.darkGray,
    text1: COLORS.black,
    text2: COLORS.white1,
    primary1: COLORS.primary1,
    primary2: COLORS.primary2,
    primary3: COLORS.primary3,
    primary4: COLORS.primary4,
    primary5: COLORS.primary5,
    primary6: COLORS.primary6,
    primary7: COLORS.primary7,
    lightP1: COLORS.brightP1,
    lightP2: COLORS.brightP2,
    lightP3: COLORS.brightP3,
    lightP4: COLORS.brightP4,
    lightP5: COLORS.brightP5,
    lightP6: COLORS.brightP6,
    lightP7: COLORS.brightP7,
    darkP1: COLORS.darkP1,
    darkP2: COLORS.darkP2,
    darkP3: COLORS.darkP3,
    darkP4: COLORS.darkP4,
    darkP5: COLORS.darkP5,
    darkP6: COLORS.darkP6,
    darkP7: COLORS.darkP7,
    shadow: COLORS.shadow15277c14,
    divider: COLORS.white3,
    inputBg: COLORS.white,
    inputBorder: COLORS.brightP1,
  };
}

export const SPACING = {
  xs: moderateScale(3),
  sm: moderateScale(5),
  md: moderateScale(10),
  lg: moderateScale(17),
  xlg: moderateScale(28),
};

export const FONTS = {
  fredokaExtraLight: "Fredoka-ExtraLight",
  fredokaThin: "Fredoka-Thin",
  fredokaLight: "Fredoka-Light",
  fredokaMedium: "Fredoka-Medium",
  fredokaRegular: "Fredoka-Regular",
  fredokaSemiBold: "Fredoka-SemiBold",
  fredokaBold: "Fredoka-Bold",
  fredokaHeavy: "Fredoka-Heavy",
};

export const FONT_SIZES = {
  sm: moderateScale(12),
  base: moderateScale(14),
  md: moderateScale(18),
  lg: moderateScale(24),
  xlg: moderateScale(28),
};

// Icon size tokens used across the app
export type IconSizeKey = "xs" | "sm" | "md" | "big";

export const ICON_SIZES: Record<IconSizeKey, number> = {
  xs: moderateScale(14),
  sm: moderateScale(20),
  md: moderateScale(24),
  big: moderateScale(35),
};

// Convert a hex color like "#4361EE" to an rgba() string with the given alpha.
function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

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

// Reusable shadow variants (automatically platform-aware)
export const SHADOWS = {
  card: {
    // explicit CSS token for web + RN shadow props for native
    boxShadow: "0 1px 10px 0 rgba(21, 39, 124, 0.14)",
    shadowColor: "rgba(21, 39, 124, 0.14)",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 1,
    elevation: 4,
  },
  glowingMessage: {
    // use COLORS.primary1 at 50% opacity via helper (keeps the source color variable-driven)
    boxShadow: `0 0 15px 0 rgba(0, 0, 0, 0.05) inset, 0px 1px 2px ${hexToRgba(COLORS.primary1, 0.1)}`,
    shadowColor: COLORS.primary1,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 4,
  },
};

export const DIVIDER = {
  color: COLORS.white3,
  width: 0.9,
};

export const GLASS = {
  surface: hexToRgba(COLORS.colorWhite, 0.5),
  border: hexToRgba(COLORS.white, 0.65),
  highlight: hexToRgba(COLORS.colorWhite, 0.9),
  shade: hexToRgba(COLORS.colorWhite, 0.2),
};

// Reusable component-level styles. Keep UI surface tokens here so components
// can import a consistent set of style primitives (web + RN friendly).
export const COMPONENT_STYLES = {
  glassSurface: {
    backgroundColor: GLASS.surface,
    borderWidth: 1,
    borderColor: GLASS.border,
    // rounded corners and overflow hidden help the blur to render cleanly on native
    overflow: "hidden" as any, // TypeScript workaround for web blur compatibility
    ...(Platform.OS === "web"
      ? {
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
        }
      : {}),
  },
  inputWrapper: {
    display: "flex",
    flexDirection: "row",
    width: "100%",
    alignItems: "center",
    // small additional gap used by Input
    gap: SPACING.sm + 2,
    alignSelf: "stretch",
    borderTopRightRadius: SPACING.lg,
    borderTopLeftRadius: SPACING.lg,
    borderBottomRightRadius: SPACING.lg,
    borderBottomLeftRadius: SPACING.lg,

    borderWidth: 0.15,
    borderColor: COLORS.brightP1,
    backgroundColor: COLORS.white,

    minHeight: FONT_SIZES.base * 2.5,
    paddingRight: SPACING.sm,

    ...(SHADOWS.card as object),
  },
  inputWrapperPressable: {
    width: "100%",
    alignSelf: "stretch",
    borderRadius: SPACING.lg,
    backgroundColor: "transparent",
    minHeight: 44,
    justifyContent: "center",
  },
  // Container style for grouped list-like surfaces (cards containing rows)
  listContainer: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    alignSelf: "stretch",
    borderRadius: SPACING.lg,
    // Use a pixel-visible border on web/native (0.15 was too thin to render reliably)
    borderWidth: 0.15,
    borderStyle: "solid",
    borderColor: COLORS.brightP1,
    backgroundColor: COLORS.white,
    shadowColor: "rgba(21, 39, 124, 0.14)",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 4,
    padding: SPACING.sm,
  },
  // Individual row/item inside a listContainer. Keep background transparent
  // so the container's rounded corners remain visible; padding is applied
  // per-row so items have spacing and can show separators between them.
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    backgroundColor: "transparent",
  },
};

export const TYPOGRAPHY = {
  title: {
    fontFamily: FONTS.fredokaSemiBold,
    fontSize: FONT_SIZES.xlg,
    textTransform: "uppercase" as const,
    color: COLORS.primary1,
    letterSpacing: 1.1,
  },
  title2: {
    fontFamily: FONTS.fredokaBold,
    fontSize: FONT_SIZES.lg,
    textTransform: "uppercase" as const,
    color: COLORS.primary1,
    letterSpacing: 1.1,
  },
  title3: {
    fontFamily: FONTS.fredokaBold,
    fontSize: FONT_SIZES.md,
    textTransform: "uppercase" as const,
    color: COLORS.black,
    letterSpacing: 1.1,
  },
  bodyText: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.base,
    color: COLORS.black,
  },
  boldText: {
    fontFamily: FONTS.fredokaSemiBold,
    fontSize: FONT_SIZES.base,
    color: COLORS.black,
  },
  notes: {
    fontFamily: FONTS.fredokaLight,
    fontSize: FONT_SIZES.sm,
    color: COLORS.black,
  },
  // Error text: same sizing as notes but red color for inline form errors
  errorText: {
    fontFamily: FONTS.fredokaLight,
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary7,
  },
  input: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.base,
    // 'line-height: normal' maps to letting the system choose a sensible height.
    lineHeight: Math.round(FONT_SIZES.base * 1.2),
    // Entered text should be black; placeholder will remain light gray via `placeholderTextColor`.
    color: COLORS.black,
  },
};

const COLORS_NUM = 8;

// Returns a bright/dark color pair for a given palette index (1-8).
// If `index` is omitted or invalid, a random index between 1 and 8 is chosen.
export function getPalettePair(index?: number) {
  const idx =
    Number.isInteger(index) && index! >= 1 && index! <= COLORS_NUM
      ? (index as number)
      : Math.floor(Math.random() * COLORS_NUM) + 1;

  if (idx === 8) {
    return { bg: COLORS.lightGray, text: COLORS.darkGray, index: 8 };
  }

  const brightKey = `brightP${idx}` as keyof typeof COLORS;
  const darkKey = `darkP${idx}` as keyof typeof COLORS;
  return { bg: COLORS[brightKey], text: COLORS[darkKey], index: idx };
}

// Deterministically map a string key to a palette index 1..8.
export function paletteIndexFromKey(key?: string): number {
  if (!key) return Math.floor(Math.random() * COLORS_NUM) + 1;
  // normalize (trim + lowercase) so keys that only differ by case/whitespace map same
  const normalized = key.trim().toLowerCase();
  if (normalized.length === 0) return Math.floor(Math.random() * COLORS_NUM) + 1;
  // djb2-like hash
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 33) ^ normalized.charCodeAt(i);
  }
  const idx = Math.abs(hash) % COLORS_NUM;
  return idx + 1;
}

/**
 * Translate a color token or string into a palette index (1..8).
 * - If token looks like a palette token containing a digit (e.g., 'p1','primary2','brightP3'), return that digit.
 * - Otherwise, deterministically map arbitrary strings to an index via `paletteIndexFromKey`.
 * - If token appears to be a hex or rgba(...) color and `fallback` is provided, return `fallback` (usually category's colorIndex).
 * - Returns a number between 1 and 8.
 */
export function paletteIndexFromColorToken(token?: string, fallback?: number): number {
  if (!token) return fallback ?? paletteIndexFromKey(token);
  const s = String(token).trim();

  // If token is a hex color, try to find an exact match in our palette
  if (/^#/.test(s)) {
    const hex = s.toLowerCase();
    for (const key in COLORS) {
      const val = (COLORS as any)[key];
      if (typeof val === "string" && val.toLowerCase() === hex) {
        const mKey = key.match(/([1-8])\b/);
        if (mKey) return Number(mKey[1]);
      }
    }
    // Not found in palette: fall back to provided fallback or deterministic mapping
    return fallback ?? paletteIndexFromKey(s);
  }

  // If token is rgba(...), try to exact-match a palette entry (rare) then fallback
  if (/^rgba?\(/i.test(s)) {
    for (const key in COLORS) {
      const val = (COLORS as any)[key];
      if (typeof val === "string" && val.toLowerCase() === s.toLowerCase()) {
        const mKey = key.match(/([1-8])\b/);
        if (mKey) return Number(mKey[1]);
      }
    }
    return fallback ?? paletteIndexFromKey(s);
  }

  // Look for a palette digit 1..8 in the token (e.g., 'primary1', 'brightP2')
  const m = s.toLowerCase().match(/([1-8])\b/);
  if (m) return Number(m[1]);

  // Fall back to deterministic mapping
  return paletteIndexFromKey(s);
}
