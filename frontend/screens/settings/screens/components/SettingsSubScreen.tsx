/**
 * SettingsSubScreen
 *
 * Shared wrapper for every settings sub-screen (leaf or hub).
 * Centralists:
 *   - header setup (left back-arrow + right icon)
 *   - ScrollableContent with the standard respectHeader/respectNavBar/padding props
 *
 * Usage:
 *   <SettingsSubScreen title="Theme Mode" iconName="settings" scrollKey="..." onBack={onBack}>
 *     {content}
 *   </SettingsSubScreen>
 *
 * For dynamic right icons (e.g. OjoType where the icon changes with state):
 *   <SettingsSubScreen ... iconDeps={[selectedOjo]}>
 * Or supply a fully custom right element:
 *   <SettingsSubScreen ... rightElement={<MyIcon />}>
 */
import React, { useEffect } from "react";
import { View, StyleSheet, TouchableOpacity, type ViewStyle } from "react-native";
import { COLORS, SPACING, ICON_SIZES } from "../../../../theme";
import { useNavigation } from "../../../../context/NavigationContext";
import { ICONS } from "../../../../components/icons/icons";
import ScrollableContent from "../../../../components/layout/ScrollableContent";

export type SettingsSubScreenProps = {
  /** Header title */
  title: string;
  /** Key of ICONS to render as the right header icon */
  iconName: keyof typeof ICONS;
  /** Color of the right header icon. Defaults to COLORS.primary1 */
  iconColor?: string;
  /** Extra dependency values that should re-trigger the header useEffect (e.g. a selected ojo type) */
  iconDeps?: unknown[];
  /** Fully override the right header element */
  rightElement?: React.ReactNode;
  /** ScrollableContent scrollKey */
  scrollKey: string;
  /** Called when the back arrow is pressed */
  onBack: () => void;
  children: React.ReactNode;
  /** Merged into the default contentContainer style ({ paddingHorizontal: SPACING.md }) */
  contentContainerStyle?: ViewStyle;
  /** Defaults to SPACING.xlg * 3 */
  extraBottomPadding?: number;
  /** Passed through to ScrollableContent's outer style */
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

  useEffect(() => {
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
