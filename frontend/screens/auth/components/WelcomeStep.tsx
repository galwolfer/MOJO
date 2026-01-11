/**
 * WelcomeStep
 *
 * Small, welcoming onboarding step used at the start of the auth flow.
 * Renders a short greeting inside a `TextBouble` and two large primary
 * action buttons for starting a new account or entering an existing one.
 *
 * Usage:
 * <WelcomeStep onStartNew={...} onHaveAccount={...} />
 */
import React from "react";
import { View } from "react-native";
import AppText from "../../../components/common/AppText";
import AuthStep from "./AuthStep";
import AuthButtonsGroup from "./AuthButtonsGroup";
import { COLORS, SPACING } from "../../../theme";

interface Props {
  onStartNew: () => void;
  onHaveAccount: () => void;
}

const WelcomeStep: React.FC<Props> = ({ onStartNew, onHaveAccount }) => {
  return (
    <View style={{ alignItems: "center", gap: SPACING.lg }}>
      <AuthStep playOnceKey="auth:welcome">
        {(typingDone: boolean) => (
          <>
            <AppText variant="bodyText">
              {"Hi, I’m "}
              <AppText variant="boldText" style={{ color: COLORS.primary1 }}>
                ojo
              </AppText>
              {" 👋\nLet’s get to know each other so I can help you reach your goals."}
            </AppText>

            <View style={{ width: "100%" }}>
              <AuthButtonsGroup
                entranceEnabled={typingDone}
                vertical
                containerDelay={300}
                left={{
                  title: "Ready to start?",
                  onPress: onStartNew,
                  iconPosition: "right",
                  color: "primary6",
                  width: "100%",
                }}
              />

              <AuthButtonsGroup
                entranceEnabled={typingDone}
                vertical
                containerDelay={430}
                left={{
                  title: "Have an account",
                  onPress: onHaveAccount,
                  iconPosition: "left",
                  mode: "light",
                  width: "100%",
                }}
              />
            </View>
          </>
        )}
      </AuthStep>
    </View>
  );
};

export default WelcomeStep;
