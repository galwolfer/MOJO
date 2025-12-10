import React from "react";
import { Platform, Text, View } from "react-native";
import { SvgXml, type SvgProps } from "react-native-svg";
import { SVG_DATA_URIS } from "./svg-data-uris";
import { COLORS } from "../../theme";

export type IconProps = SvgProps & { size?: number };

const ICON_FILES: Record<string, string> = {
  burger: "burger.svg",
  calendar: "calendar.svg",
  cancel: "camcel.svg",
  clock: "clock-1.svg",
  default: "default.svg",
  down: "down-icon.svg",
  edit: "edit.svg",
  flame: "flame-1.svg",
  friends: "friends.svg",
  heart: "heart.svg",
  left: "left.svg",
  list: "list.svg",
  medal: "medal.svg",
  move: "move.svg",
  plus: "plus-1.svg",
  right: "right.svg",
  send: "send-icon.svg",
  shoppingCart: "shopping-cart.svg",
  study: "study.svg",
  trophy: "trophy.svg",
  up: "up-icon.svg",
  user: "user.svg",
  workout: "workout.svg",
};

function decodeBase64(base64: string) {
  if (typeof atob === "function") return atob(base64);
  if (typeof global.atob === "function") return global.atob(base64);
  if (typeof Buffer !== "undefined") return Buffer.from(base64, "base64").toString("utf8");
  throw new Error("No base64 decoder available");
}

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

    if (Platform.OS === "web") {
      const coloredDataUri = `data:image/svg+xml;base64,${btoa(coloredSvg)}`;
      return (
        <img src={coloredDataUri} alt={debugName} style={{ width: numericSize, height: numericSize, display: "block" }} />
      );
    }

    return <SvgXml xml={coloredSvg} width={resolvedSize} height={resolvedSize} {...rest} />;
  };
}

export const ICONS: Record<string, React.FC<IconProps>> = Object.fromEntries(
  Object.entries(ICON_FILES).map(([key, file]) => [key, createIcon(file, key)]),
) as Record<string, React.FC<IconProps>>;

export const ICON_NAMES = Object.keys(ICONS);
