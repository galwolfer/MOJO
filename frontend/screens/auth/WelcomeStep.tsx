import React from "react";
import { View } from "react-native";
import AppText from "../../components/common/AppText";
import AppButton from "../../components/common/AppButton";
import TextBouble from "../../components/chat/TextBouble";
import { COLORS, SPACING } from "../../theme";

interface Props {
  onStartNew: () => void;
  onHaveAccount: () => void;
}

const WelcomeStep: React.FC<Props> = ({ onStartNew, onHaveAccount }) => {
  return (
    <View style={{ alignItems: "center", gap: SPACING.lg }}>
      <TextBouble mode="agent" playOnceKey="auth:welcome">
        <AppText variant="bodyText">
          {"Hi, I’m "}
          <AppText variant="boldText" style={{ color: COLORS.primary1 }}>
            ojo
          </AppText>
          {" 👋\nLet’s get to know each other so I can help you reach your goals."}
        </AppText>
        <View style={{ width: "100%", gap: SPACING.md }}>
          <AppButton title="Ready to start?" iconPosition="right" onPress={onStartNew} color="primary6" width="100%" />
          <AppButton title="Have an account" iconPosition="left" mode="light" width="100%" onPress={onHaveAccount} />
        </View>
      </TextBouble>
    </View>
  );
};

export default WelcomeStep;
