import React from "react";
import { Text, View, Platform } from "react-native";
import type { SvgProps } from "react-native-svg";
import { SVG_DATA_URIS } from "./svg-data-uris";

// Import original SVG files as React components (requires react-native-svg-transformer)
import BurgerIcon from "./icons-lib/burger.svg";
import CalendarIcon from "./icons-lib/calendar.svg";
import CamcelIcon from "./icons-lib/camcel.svg";
import ClockIcon from "./icons-lib/clock-1.svg";
import DefaultSvg from "./icons-lib/default.svg";
import DownIcon from "./icons-lib/down-icon.svg";
import EditIcon from "./icons-lib/edit.svg";
import FlameIcon from "./icons-lib/flame-1.svg";
import FriendsIcon from "./icons-lib/friends.svg";
import HeartIcon from "./icons-lib/heart.svg";
import LeftIcon from "./icons-lib/left.svg";
import ListIcon from "./icons-lib/list.svg";
import MedalIcon from "./icons-lib/medal.svg";
import MoveIcon from "./icons-lib/move.svg";
import PlusIcon from "./icons-lib/plus-1.svg";
import RightIcon from "./icons-lib/right.svg";
import SendIcon from "./icons-lib/send-icon.svg";
import ShoppingCartIcon from "./icons-lib/shopping-cart.svg";
import StudyIcon from "./icons-lib/study.svg";
import TrophyIcon from "./icons-lib/trophy.svg";
import UpIcon from "./icons-lib/up-icon.svg";
import UserIcon from "./icons-lib/user.svg";
import WorkoutIcon from "./icons-lib/workout.svg";
import { COLORS } from "../../theme";

export type IconProps = SvgProps;

function normalizeImport(mod: any, debugName?: string, svgFileName?: string): React.FC<SvgProps> {
  // Possible shapes:
  // - React component (function/class) — native transformer output
  // - Module object with `default` or `ReactComponent` (CRA)
  // - String URL to the asset (web bundlers)
  // - Asset object with `uri` (expo/asset)
  // - Empty object {} — web Metro doesn't transform SVGs, need fallback
  const candidate = mod && (mod.ReactComponent ?? mod.default ?? mod);

  // If it's a React component (function or class)
  if (typeof candidate === "function") {
    return (props: SvgProps) => {
      const anyProps: any = props || {};
      // Map common convenience props -> svg props
      const mapped: any = { ...anyProps };
      // Map color to both fill AND stroke to override hardcoded values
      if (anyProps.color) {
        mapped.fill = anyProps.color;
        mapped.stroke = anyProps.color;
      }
      // size prop -> width/height
      if (anyProps.size) {
        mapped.width = anyProps.size;
        mapped.height = anyProps.size;
      }
      return React.createElement(candidate, mapped);
    };
  }

  // If it's a string (URL) — render as <img> on web
  if (typeof candidate === "string") {
    return (props: SvgProps) => {
      const anyProps = props as any;
      const size = anyProps.size || anyProps.width || anyProps.height || 24;
      return (
        <img
          src={candidate}
          alt={debugName || "icon"}
          style={{
            width: size,
            height: size,
            display: "block",
          }}
        />
      );
    };
  }

  // If it's an asset object with uri
  if (candidate && typeof candidate === "object" && typeof candidate.uri === "string") {
    return (props: SvgProps) => {
      const anyProps = props as any;
      const size = anyProps.size || anyProps.width || anyProps.height || 24;
      return <img src={candidate.uri} alt={debugName || "icon"} style={{ width: size, height: size }} />;
    };
  }

  // FALLBACK: use data URI with platform-specific rendering
  const isWeb = Platform.OS === "web";

  if (svgFileName && SVG_DATA_URIS[svgFileName]) {
    const dataUri = SVG_DATA_URIS[svgFileName];

    if (isWeb) {
      // Web: use img tag with color injection
      return (props: SvgProps) => {
        const anyProps = props as any;
        const size = anyProps.size || anyProps.width || anyProps.height || 24;
        const color = anyProps.color || COLORS.black;

        // Decode base64 data URI and inject color
        const base64Content = dataUri.split(",")[1];
        const svgContent = atob(base64Content);

        // Replace currentColor with actual color value
        const coloredSvg = svgContent.replace(/currentColor/g, color);
        const coloredDataUri = `data:image/svg+xml;base64,${btoa(coloredSvg)}`;

        return (
          <img
            src={coloredDataUri}
            alt={debugName || "icon"}
            style={{
              width: size,
              height: size,
              display: "block",
            }}
          />
        );
      };
    } else {
      // Native: use SvgXml from react-native-svg
      const { SvgXml } = require("react-native-svg");

      return (props: SvgProps) => {
        const anyProps = props as any;
        const size = anyProps.size || anyProps.width || anyProps.height || 24;
        const color = anyProps.color || COLORS.black;

        // Decode base64 and inject color
        const base64Content = dataUri.split(",")[1];

        // Use atob for React Native (it's available globally)
        let svgContent;
        try {
          svgContent = global.atob ? global.atob(base64Content) : atob(base64Content);
        } catch (error) {
          console.warn(`Failed to decode base64 for ${debugName}:`, error);
          return (
            <View style={{ width: size, height: size }}>
              <Text>?</Text>
            </View>
          );
        }

        // For native, we need to replace currentColor since SvgXml doesn't support it
        const coloredSvg = svgContent
          .replace(/currentColor/g, color)
          .replace(/stroke-width/g, "strokeWidth")
          .replace(/stroke-linecap/g, "strokeLinecap")
          .replace(/stroke-linejoin/g, "strokeLinejoin")
          .replace(/clip-path/g, "clipPath");

        return <SvgXml xml={coloredSvg} width={size} height={size} />;
      };
    }
  }

  // Unknown shape — log error and return platform-specific placeholder
  console.warn(`[Icon ${debugName}] No SVG data found for ${svgFileName}`);

  return (props: SvgProps) => {
    const anyProps = props as any;
    const size = anyProps.size || 24;
    return (
      <View
        style={{
          width: size,
          height: size,
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

export const ICONS: Record<string, React.FC<SvgProps>> = {
  burger: normalizeImport(BurgerIcon, "burger", "burger.svg"),
  calendar: normalizeImport(CalendarIcon, "calendar", "calendar.svg"),
  cancel: normalizeImport(CamcelIcon, "cancel", "camcel.svg"),
  clock: normalizeImport(ClockIcon, "clock", "clock-1.svg"),
  default: normalizeImport(DefaultSvg, "default", "default.svg"),
  down: normalizeImport(DownIcon, "down", "down-icon.svg"),
  edit: normalizeImport(EditIcon, "edit", "edit.svg"),
  flame: normalizeImport(FlameIcon, "flame", "flame-1.svg"),
  friends: normalizeImport(FriendsIcon, "friends", "friends.svg"),
  heart: normalizeImport(HeartIcon, "heart", "heart.svg"),
  left: normalizeImport(LeftIcon, "left", "left.svg"),
  list: normalizeImport(ListIcon, "list", "list.svg"),
  medal: normalizeImport(MedalIcon, "medal", "medal.svg"),
  move: normalizeImport(MoveIcon, "move", "move.svg"),
  plus: normalizeImport(PlusIcon, "plus", "plus-1.svg"),
  right: normalizeImport(RightIcon, "right", "right.svg"),
  send: normalizeImport(SendIcon, "send", "send-icon.svg"),
  shoppingCart: normalizeImport(ShoppingCartIcon, "shoppingCart", "shopping-cart.svg"),
  study: normalizeImport(StudyIcon, "study", "study.svg"),
  trophy: normalizeImport(TrophyIcon, "trophy", "trophy.svg"),
  up: normalizeImport(UpIcon, "up", "up-icon.svg"),
  user: normalizeImport(UserIcon, "user", "user.svg"),
  workout: normalizeImport(WorkoutIcon, "workout", "workout.svg"),
};

export const ICON_NAMES = Object.keys(ICONS);
