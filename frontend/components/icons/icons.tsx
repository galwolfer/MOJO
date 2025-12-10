import React from "react";
import { Platform, View } from "react-native";
import type { SvgProps } from "react-native-svg";
import { SVG_DATA_URIS } from "./svg-data-uris";

// Import original SVG files as React components (native transformer)
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

export type IconProps = SvgProps & { size?: number; color?: string };

// Helpers to decode/encode base64 safely in browser/node
const decodeBase64 = (s: string) => {
  try {
    if (typeof Buffer !== "undefined") return Buffer.from(s, "base64").toString("utf8");
  } catch {}
  try {
    // @ts-ignore
    return atob(s);
  } catch {
    return "";
  }
};
const encodeBase64 = (str: string) => {
  try {
    if (typeof Buffer !== "undefined") return Buffer.from(str, "utf8").toString("base64");
  } catch {}
  try {
    // @ts-ignore
    return btoa(str);
  } catch {
    return "";
  }
};

function normalizeImport(mod: any, debugName?: string, svgFileName?: string): React.FC<IconProps> {
  const candidate = mod && (mod.ReactComponent ?? mod.default ?? mod);

  // Native transformer -> React component
  if (typeof candidate === "function") {
    return (props: IconProps) => {
      const anyProps: any = props || {};
      const mapped: any = { ...anyProps };
      if (anyProps.color && !anyProps.fill) mapped.fill = anyProps.color;
      if (anyProps.color && !anyProps.stroke) mapped.stroke = anyProps.color;
      if (anyProps.size && !anyProps.width) mapped.width = anyProps.size;
      if (anyProps.size && !anyProps.height) mapped.height = anyProps.size;
      return React.createElement(candidate, mapped as any);
    };
  }

  // Web asset (string URL)
  if (typeof candidate === "string") {
    return (props: IconProps) => {
      const anyProps: any = props || {};
      const size = anyProps.size || anyProps.width || anyProps.height || 24;
      return (<img src={candidate} alt={debugName || "icon"} style={{ width: size, height: size }} />) as any;
    };
  }

  // Expo asset object with uri
  if (candidate && typeof candidate === "object" && typeof candidate.uri === "string") {
    return (props: IconProps) => {
      const anyProps: any = props || {};
      const size = anyProps.size || anyProps.width || anyProps.height || 24;
      return (<img src={candidate.uri} alt={debugName || "icon"} style={{ width: size, height: size }} />) as any;
    };
  }

  // Fallback for web: use generated SVG data URIs and inject color
  if (Platform.OS === "web" && svgFileName && SVG_DATA_URIS[svgFileName]) {
    const dataUri = SVG_DATA_URIS[svgFileName];
    return (props: IconProps) => {
      const anyProps: any = props || {};
      const size = anyProps.size || anyProps.width || anyProps.height || 24;
      const color = anyProps.color || "#000";
      const base64Content = dataUri.split(",")[1] || "";
      const svgContent = decodeBase64(base64Content);
      const coloredSvg = svgContent.replace(/currentColor/g, color);
      const coloredDataUri = `data:image/svg+xml;base64,${encodeBase64(coloredSvg)}`;
      return (<img src={coloredDataUri} alt={debugName || "icon"} style={{ width: size, height: size }} />) as any;
    };
  }

  // Unknown shape: return safe placeholder (native: View, web: div)
  return (props: IconProps) => {
    const anyProps: any = props || {};
    const size = anyProps.size || 24;
    if (Platform.OS === "web") {
      return (<div title={`Icon: ${debugName || "unknown"}`}>?</div>) as any;
    }
    return (<View style={{ width: size, height: size }} />) as any;
  };
}

export const ICONS: Record<string, React.FC<IconProps>> = {
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
