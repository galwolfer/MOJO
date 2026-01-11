/**
 * LoginStep
 *
 * Presents a username/password form inside the auth message flow. Handles
 * client-side display of `loginError` and exposes `onLogin` / `onBack` actions.
 */
import React from "react";
import { View } from "react-native";
import AppText from "../../../components/common/AppText";
import ErrorText from "../../../components/common/ErrorText";
import AuthStep from "./AuthStep";
import AuthButtonsGroup from "./AuthButtonsGroup";
import Widget from "../../../components/special/Widget";
import Input from "../../../components/inputs/Input";
import { SPACING } from "../../../theme";

interface Props {
  loginUsername: string;
  loginPassword: string;
  setLoginUsername: (v: string) => void;
  setLoginPassword: (v: string) => void;
  loginError?: string | null;
  onBack: () => void;
  onLogin: () => void;
}

const LoginStep: React.FC<Props> = ({
  loginUsername,
  loginPassword,
  setLoginUsername,
  setLoginPassword,
  loginError,
  onBack,
  onLogin,
}) => {
  return (
    <View style={{ width: "100%" }}>
      <AuthStep playOnceKey="auth:login">
        {(typingDone: boolean) => (
          <>
            <AppText variant="bodyText" style={{ marginBottom: SPACING.sm }}>
              {"Welcome back \nLet's pick up where you left off."}
            </AppText>
            {loginError ? <ErrorText style={{ marginBottom: SPACING.md }}>{loginError}</ErrorText> : null}

            <Widget entranceEnabled={typingDone} entranceDelay={100} entranceDuration={200}>
              <Input
                label="Username"
                placeholder="Your username"
                value={loginUsername}
                onChangeText={setLoginUsername}
              />
              <Input
                label="Password"
                placeholder="Your password"
                value={loginPassword}
                onChangeText={setLoginPassword}
                type="password"
              />
            </Widget>

            <AuthButtonsGroup
              entranceEnabled={typingDone}
              left={{ title: "Back", onPress: onBack, icon: "left", iconPosition: "left", mode: "light" }}
              right={{ title: "Log In", onPress: onLogin, icon: "right", iconPosition: "right", color: "primary6" }}
            />
          </>
        )}
      </AuthStep>
    </View>
  );
};

export default LoginStep;
