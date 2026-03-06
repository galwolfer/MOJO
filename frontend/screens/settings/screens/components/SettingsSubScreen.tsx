import React, { useLayoutEffect } from "react";
import { View, StyleSheet, TouchableOpacity, type ViewStyle } from "react-native";
import { COLORS, SPACING, ICON_SIZES } from "../../../../theme";
import { useNavigation } from "../../../../context/NavigationContext";
import { useBackHandler } from "../../../../hooks/useBackHandler";
import { ICONS } from "../../../../components/icons/icons";
import ScrollableContent from "../../../../components/layout/ScrollableContent";

export type SettingsSubScreenProps = {
  title: string;
  iconName: keyof typeof ICONS;
  iconColor?: string;
  iconDeps?: unknown[];
  rightElement?: React.ReactNode;
  scrollKey: string;
  onBack: () => void;
  children: React.ReactNode;
  contentContainerStyle?: ViewStyle;
  extraBottomPadding?: number;
  style?: ViewStyle;
};

export default function SettingsSubScreen({
  title,
  iconName,
  iconColor = COLORS.primary1,
  iconDeps = [],
  rightElement,
  scrollKey,
  onBack,
  children,
  contentContainerStyle,
  extraBottomPadding = SPACING.xlg * 3,
  style,
}: SettingsSubScreenProps) {
  const { setHeaderConfig } = useNavigation();
  const LeftIcon = ICONS.left;
  const RightIcon = ICONS[iconName];

  // Register onBack with the global back handler stack so hardware back works
  useBackHandler(() => {
    onBack();
    return true;
  });

  // useLayoutEffect fires synchronously before paint � eliminates header flicker on navigation
  useLayoutEffect(() => {
    setHeaderConfig({
      title,
      show: true,
      icon: ICONS[iconName],
      leftElement: (
        <TouchableOpacity onPress={onBack} style={styles.headerTouchable}>
          <LeftIcon size={ICON_SIZES.sm} color={COLORS.primary1} />
        </TouchableOpacity>
      ),
      rightElement: rightElement ?? (
        <View style={styles.headerIcon}>
          <RightIcon size={ICON_SIZES.sm} color={iconColor} />
        </View>
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, iconName, iconColor, ...iconDeps]);

  return (
    <ScrollableContent
      respectHeader={true}
      respectNavBar={true}
      extraTopPadding={SPACING.lg}
      scrollKey={scrollKey}
      contentContainerStyle={[styles.contentContainer, contentContainerStyle]}
      extraBottomPadding={extraBottomPadding}
      style={style}
    >
      {children}
    </ScrollableContent>
  );
}

const styles = StyleSheet.create({
  contentContainer: { paddingHorizontal: SPACING.md },
  headerTouchable: { padding: SPACING.xs },
  headerIcon: { padding: SPACING.xs },
});
