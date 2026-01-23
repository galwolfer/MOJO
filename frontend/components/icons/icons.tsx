/**
 * Icon registry
 *
 * Centralized icon creation & registry used across the app. Icons are created
 * from SVG files and rendered using `react-native-svg` on native and an
 * inlined data URI `<img>` on web. The `ICONS` map provides a convenient
 * lookup by key (e.g., `ICONS.send`).
 *
 * Notes:
 * - SVGs are colorized by replacing `currentColor` in the SVG payload with
 *   the requested color.
 * - On web we build a colored data URI and render an `<img>` for simplicity.
 */
import React from "react";
import { Platform, Text, View } from "react-native";
import { SvgXml, type SvgProps } from "react-native-svg";
import { SVG_DATA_URIS } from "./svg-data-uris";
import { COLORS } from "../../theme";

export type IconProps = SvgProps & { size?: number };

export const ICON_FILES: Record<string, string> = {
  bag: 'bag.svg',
  bestojo: 'bestojo.svg',
  brojo: 'brojo.svg',
  burger: 'burger.svg',
  calendar: 'calendar.svg',
  cancel: 'cancel.svg',
  check: 'check.svg',
  clock: 'clock-1.svg',
  creative: 'creative.svg',
  default: 'default.svg',
  down: 'down-icon.svg',
  edit: 'edit.svg',
  explore: 'explore.svg',
  family: 'family.svg',
  flame: 'flame-1.svg',
  friends: 'friends.svg',
  goals: 'goals.svg',
  health: 'health.svg',
  heart: 'heart.svg',
  highEffort: 'high effort.svg',
  highPriority: 'high Priority.svg',
  hobbies: 'hobbies.svg',
  home: 'Home.svg',
  left: 'left.svg',
  list: 'list.svg',
  lowEffort: 'low effort.svg',
  lowImportant: 'low important.svg',
  medal: 'medal.svg',
  mediumImportant: 'medium important.svg',
  mediumPiority: 'medium piority.svg',
  mentorjo: 'mentorjo.svg',
  mindfulness: 'mindfulness.svg',
  mojo: 'mojo-logo.svg',
  move: 'move.svg',
  notifications: 'notifications.svg',
  ojo: 'ojo.svg',
  other: 'other.svg',
  plus: 'plus-1.svg',
  prefrences: 'prefrences.svg',
  puzzle: 'puzzle.svg',
  reflection: 'reflection.svg',
  repeat: 'repeat.svg',
  right: 'right.svg',
  send: 'send-icon.svg',
  settings: 'settings.svg',
  shoppingCart: 'shopping-cart.svg',
  skills: 'Skills.svg',
  split: 'split.svg',
  strictojo: 'strictojo.svg',
  study: 'study.svg',
  trash: 'trash.svg',
  trophy: 'trophy.svg',
  up: 'up-icon.svg',
  user: 'user.svg',
  work: 'Work.svg',
  workout: 'workout.svg',
};

function decodeBase64(base64: string) {
  if (typeof atob === "function") return atob(base64);
  if (typeof global.atob === "function") return global.atob(base64);
  if (typeof Buffer !== "undefined") return Buffer.from(base64, "base64").toString("utf8");
  throw new Error("No base64 decoder available");
}

/**
 * Creates an icon component from an SVG file.
 * @param svgFileName - The name of the SVG file.
 * @param debugName - The debug name for the icon.
 * @returns A React component for the icon.
 */
function createIcon(svgFileName: string, debugName: string): React.FC<IconProps> {
  const dataUri = SVG_DATA_URIS[svgFileName];

  if (!dataUri) {
    console.warn(`[Icon ${debugName}] Missing SVG data for ${svgFileName}`);
    return (props: IconProps) => {
      const resolvedSize = props.size || props.width || props.height || 24;
      const numericSize = typeof resolvedSize === "string" ? Number(resolvedSize) : resolvedSize;
      return (
        <View
          style={{
            width: numericSize,
            height: numericSize,
            backgroundColor: "#f0f0f0",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 10 }}>?</Text>
        </View>
      );
    };
  }

  return (props: IconProps) => {
    const { size: sizeProp, color, width, height, ...rest } = props;
    const resolvedSize = sizeProp || width || height || 24;
    const numericSize = typeof resolvedSize === "string" ? Number(resolvedSize) : resolvedSize;
    const tint = typeof color === "string" ? color : color ? String(color) : COLORS.black;

    const base64Content = dataUri.split(",")[1];
    let svgContent = "";
    try {
      svgContent = decodeBase64(base64Content);
    } catch (error) {
      console.warn(`[Icon ${debugName}] Failed to decode base64:`, error);
    }

    const coloredSvg = svgContent.replace(/currentColor/g, tint);

    if ((Platform as any).OS === "web") {
      const coloredDataUri = `data:image/svg+xml;base64,${btoa(coloredSvg)}`;
      return (
        <img
          src={coloredDataUri}
          alt={debugName}
          style={{ width: numericSize, height: numericSize, display: "block" }}
        />
      );
    }

    return <SvgXml xml={coloredSvg} width={resolvedSize} height={resolvedSize} {...rest} />;
  };
}

export const ICONS: Record<string, React.FC<IconProps>> = Object.fromEntries(
  Object.entries(ICON_FILES).map(([key, file]) => [key, createIcon(file, key)]),
) as Record<string, React.FC<IconProps>>;

export const ICON_NAMES = Object.keys(ICONS);

function encodeBase64(str: string) {
  if (typeof btoa === "function") return btoa(str);
  if (typeof Buffer !== "undefined") return Buffer.from(str, "utf8").toString("base64");
  throw new Error("No base64 encoder available");
}

/**
 * Returns a colored SVG data URI for the given icon key.
 * Falls back to the default icon if not found.
 */
export function getIconDataUri(iconKey: string, color?: string) {
  const file = ICON_FILES[iconKey] || ICON_FILES.default;
  const dataUri = (SVG_DATA_URIS as Record<string, string>)[file];
  if (!dataUri) return undefined;

  const base64 = dataUri.split(",")[1];
  let svg = "";
  try {
    svg = decodeBase64(base64);
  } catch (e) {
    return dataUri;
  }

  const tint = typeof color === "string" ? color : COLORS.black;
  const colored = svg.replace(/currentColor/g, tint);

  try {
    const encoded = encodeBase64(colored);
    return `data:image/svg+xml;base64,${encoded}`;
  } catch (e) {
    return dataUri;
  }
}
