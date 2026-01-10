import React from "react";
import { View } from "react-native";
import AppText from "../../components/common/AppText";
import AppButton from "../../components/common/AppButton";
import TextBouble from "../../components/chat/TextBouble";
import Input from "../../components/inputs/Input";
import { SPACING } from "../../theme";

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
    <TextBouble mode="agent" playOnceKey="auth:login">
      <AppText variant="bodyText" style={{ marginBottom: SPACING.md }}>
        {"Welcome back 👋\nLet’s pick up where you left off."}
      </AppText>
      {loginError ? (
        <AppText variant="errorText" style={{ marginBottom: SPACING.md }}>
          {loginError}
        </AppText>
      ) : null}

      <View style={{ width: "100%" }}>
        <Input label="Username" placeholder="Your username" value={loginUsername} onChangeText={setLoginUsername} />
        <Input label="Password" placeholder="Your password" value={loginPassword} onChangeText={setLoginPassword} type="password" />
      </View>

      <View style={{ display: "flex", flexDirection: "row", justifyContent: "center", alignItems: "center", gap: SPACING.md, paddingTop: SPACING.lg, width: "100%" }}>
        <AppButton title="Back" icon="left" iconPosition="left" mode="light" onPress={onBack} />
        <AppButton title="Log In" icon="right" iconPosition="right" onPress={onLogin} color="primary6" />
      </View> 
    </TextBouble>
  );
};

export default LoginStep;
