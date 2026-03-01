import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { moderateScale } from "react-native-size-matters";
import AppText from "../../components/common/AppText";
import { COLORS, SPACING } from "../../theme";
import type { ListCellProps } from "./List";
import { useColors } from "../../context/ThemeContext";

export type ListItemProps = {
  title: string;
  subtitle?: string;
  logo?: React.ReactNode;
  style?: ViewStyle;
  rightElement?: React.ReactNode;
};

export default function ListItem({ title, subtitle, logo, style, rightElement }: ListItemProps) {
  const colors = useColors();

  return (
    <View style={[styles.container, style]}>
      {logo ? <View style={styles.logo}>{logo}</View> : null}
      <View style={styles.textWrap}>
        <AppText variant="bodyText" style={[{ color: colors.text1 }]}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="notes" style={[styles.subtitle, { color: colors.gray1 }]}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {rightElement ? <View style={styles.rightElement}>{rightElement}</View> : null}
    </View>
  );
}

export const makeListCell = (
  id: string,
  opts: {
    title: string;
    logo?: React.ReactNode;
    onPress?: () => void;
    divider?: boolean;
    dividerColor?: string;
    disabled?: boolean;
    style?: ViewStyle;
    subtitle?: string;
    rightElement?: React.ReactNode;
  },
): ListCellProps => ({
  id,
  content: <ListItem title={opts.title} logo={opts.logo} subtitle={opts.subtitle} rightElement={opts.rightElement} />,
  onPress: opts.onPress,
  divider: opts.divider,
  dividerColor: opts.dividerColor,
  disabled: opts.disabled,
  style: opts.style,
});

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    width: "100%",
  },
  logo: {
    width: moderateScale(24),
    alignItems: "center",
  },
  textWrap: {
    flex: 1,
  },

  subtitle: {
    color: COLORS.lightGray,
    marginTop: 2,
  },
  rightElement: {
    alignItems: "center",
    justifyContent: "center",
  },
});
