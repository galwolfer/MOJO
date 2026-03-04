import React from "react";
import { View, Image, TouchableOpacity, StyleProp, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { moderateScale } from "react-native-size-matters";
import { ICONS } from "../icons/icons";
import { useOjo } from "../../context/OjoContext";
import { COLORS } from "../../theme";
import { useColors } from "../../context/ThemeContext";

const UserAvatar: React.FC<{
  imageUri?: string | null;
  size?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  placeholderSize?: number;
}> = ({ imageUri, size = 110, onPress, style }) => {
  const { gradient } = useOjo();
  const colors = useColors();
  const AvatarWrapper: any = onPress ? TouchableOpacity : View;
  const Icon = ICONS.user;

  return (
    <AvatarWrapper onPress={onPress} style={style} activeOpacity={0.8}>
      <LinearGradient
        colors={(gradient ?? [COLORS.primary1, COLORS.primary2]) as [string, string, ...string[]]}
        end={{ x: 1, y: 1 }}
        style={{ width: size, height: size, borderRadius: size / 2, padding: moderateScale(2) }}
      >
        <View
          style={{
            width: "100%",
            height: "100%",
            borderRadius: size / 2,
            backgroundColor: colors.bg1,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={{ width: "100%", height: "100%" }} />
          ) : (
            <View style={{ alignItems: "center", justifyContent: "center" }}>
              <Icon size={moderateScale(size / 3)} color={colors.gray1} />
            </View>
          )}
        </View>
      </LinearGradient>
    </AvatarWrapper>
  );
};

export default UserAvatar;
