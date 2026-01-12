import React from "react";
import { View } from "react-native";
import AnimatedButtonsContainer from "../../../components/common/AnimatedButtonsContainer";
import AppButton from "../../../components/common/AppButton";
import { SPACING } from "../../../theme";

interface BtnSpec {
  title: string;
  onPress: () => void;
  icon?: string;
  iconPosition?: "left" | "right";
  color?: string;
  mode?: "light" | "filled";
  width?: string | number;
}

interface Props {
  left?: BtnSpec;
  right?: BtnSpec;
  vertical?: boolean;
  entranceEnabled?: boolean;
  containerDelay?: number;
}

/**
 * AuthButtonsGroup
 *
 * Small helper to render paired action buttons for auth steps. Uses
 * `AnimatedButtonsContainer` so entrance animations remain consistent across
 * all steps.
 */
const AuthButtonsGroup: React.FC<Props> = ({ left, right, vertical, entranceEnabled, containerDelay }) => {
  return (
    <AnimatedButtonsContainer
      entranceEnabled={!!entranceEnabled}
      vertical={vertical}
      paddingTop={SPACING.md}
      paddingBottom={0}
      containerDelay={containerDelay}
    >
      <View style={{ flexDirection: "row", width: "100%", justifyContent: "center" }}>
        {left ? (
          <AppButton
            title={left.title}
            icon={left.icon}
            iconPosition={left.iconPosition as any}
            mode={left.mode}
            onPress={left.onPress}
            width={left.width}
            color={left.color}
            style={{ marginRight: right ? SPACING.md : 0 }}
          />
        ) : null}

        {right ? (
          <AppButton
            title={right.title}
            icon={right.icon}
            iconPosition={right.iconPosition as any}
            onPress={right.onPress}
            width={right.width}
            color={right.color}
          />
        ) : null}
      </View>
    </AnimatedButtonsContainer>
  );
};

export default AuthButtonsGroup;
