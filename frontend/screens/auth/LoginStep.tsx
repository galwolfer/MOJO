import React, { useState } from "react";
import { View, Animated, Easing } from "react-native";
import AppText from "../../components/common/AppText";
import AppButton from "../../components/common/AppButton";
import TextBouble from "../../components/chat/TextBouble";
import Widget from "../../components/special/Widget";
import Input from "../../components/inputs/Input";
import AnimatedButtonsContainer from "../../components/common/AnimatedButtonsContainer";
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
  const [typingDone, setTypingDone] = useState(false);

  return (
    <View style={{ width: "100%" }}>
      <TextBouble mode="agent" playOnceKey="auth:login" onTypingDone={() => setTypingDone(true)}>
        <AppText variant="bodyText" style={{ marginBottom: SPACING.sm }}>
          {"Welcome back \nLet's pick up where you left off."}
        </AppText>
        {loginError ? (
          <AppText variant="errorText" style={{ marginBottom: SPACING.md }}>
            {loginError}
          </AppText>
        ) : null}

        <Widget entranceEnabled={typingDone} entranceDelay={100} entranceDuration={200}>
          <Input label="Username" placeholder="Your username" value={loginUsername} onChangeText={setLoginUsername} />
          <Input
            label="Password"
            placeholder="Your password"
            value={loginPassword}
            onChangeText={setLoginPassword}
            type="password"
          />
        </Widget>

        <AnimatedButtonsContainer entranceEnabled={typingDone}>
          <AppButton title="Back" icon="left" iconPosition="left" mode="light" onPress={onBack} />
          <AppButton title="Log In" icon="right" iconPosition="right" onPress={onLogin} color="primary6" />
        </AnimatedButtonsContainer>
      </TextBouble>
    </View>
  );
};

export default LoginStep;
