import React from "react";
import { View } from "react-native";
import AppText from "../../components/common/AppText";
import AppButton from "../../components/common/AppButton";
import TextBouble from "../../components/chat/TextBouble";
import Input from "../../components/inputs/Input";
import { SPACING } from "../../theme";

interface Props {
  signupUsername: string;
  signupEmail: string;
  signupPassword: string;
  signupConfirm: string;
  setSignupUsername: (v: string) => void;
  setSignupEmail: (v: string) => void;
  setSignupPassword: (v: string) => void;
  setSignupConfirm: (v: string) => void;
  signupError?: string | null;
  onBack: () => void;
  onSignup: () => void;
  // Display name entered in previous step
  displayName?: string;
}

const SignupStep: React.FC<Props> = ({
  signupUsername,
  signupEmail,
  signupPassword,
  signupConfirm,
  setSignupUsername,
  setSignupEmail,
  setSignupPassword,
  setSignupConfirm,
  signupError,
  onBack,
  onSignup,
  displayName,
}) => {
  return (
    <TextBouble mode="agent" playOnceKey="auth:signup">
      <AppText variant="bodyText" style={{ marginBottom: SPACING.md }}>
        {`Great to meet you${displayName ? ", " + displayName : ""}! \nLet's create your account.`}
      </AppText>
      <View style={{ width: "100%" }}>
        {signupError ? (
          <AppText variant="errorText" style={{ marginBottom: SPACING.md }}>
            {signupError}
          </AppText>
        ) : null}
        <Input
          label="Username"
          placeholder="Choose a username"
          value={signupUsername}
          onChangeText={setSignupUsername}
        />
        <Input label="Email" placeholder="Your email" value={signupEmail} onChangeText={setSignupEmail} type="email" />
        <Input
          label="Password"
          placeholder="Password"
          value={signupPassword}
          onChangeText={setSignupPassword}
          type="password"
        />
        <Input
          label="Confirm"
          placeholder="Confirm password"
          value={signupConfirm}
          onChangeText={setSignupConfirm}
          type="password"
        />
      </View>
      <View
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          gap: SPACING.md,
          paddingTop: SPACING.lg,
          width: "100%",
        }}
      >
        <AppButton title="Back" icon="left" iconPosition="left" mode="light" onPress={onBack} />
        <AppButton title="Next" icon="right" iconPosition="right" onPress={onSignup} color="primary6" />
      </View>
    </TextBouble>
  );
};

export default SignupStep;
