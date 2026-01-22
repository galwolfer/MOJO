import React from "react";
import { View, StyleProp, ViewStyle } from "react-native";
import { ICONS } from "./icons";

type IconProps = {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

const Icon: React.FC<IconProps> = ({ name, size = 24, color, style, ...rest }) => {
  const Comp = ICONS[name];
  if (!Comp) return null;
  return (
    <View style={[{ width: size, height: size, alignItems: "center", justifyContent: "center" }, style]}>
      {/* Comp accepts size and color props */}
      <Comp size={size} color={color} {...(rest as any)} />
    </View>
  );
};

export default Icon;
