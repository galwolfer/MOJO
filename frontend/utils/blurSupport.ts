import { NativeModules, Platform } from "react-native";

type PlatformConstants = {
  isHardwareAccelerated?: boolean;
};

/**
 * Returns true only when native blur is expected to work safely.
 */
export function canUseNativeBlur(): boolean {
  if (Platform.OS === "ios") return true;
  if (Platform.OS !== "android") return false;

  const constants = NativeModules.PlatformConstants as PlatformConstants | undefined;
  return constants?.isHardwareAccelerated === true;
}
