import React, { useState } from "react";
import { View, Animated, Easing } from "react-native";
import AppText from "../../components/common/AppText";
import AppButton from "../../components/common/AppButton";
import TextBouble from "../../components/chat/TextBouble";
import Widget from "../../components/special/Widget";
import Input from "../../components/inputs/Input";
import ProfilePhotoWidget from "../../components/special/ProfilePhotoWidget";
import AnimatedButtonsContainer from "../../components/common/AnimatedButtonsContainer";
import { SPACING } from "../../theme";

interface Props {
  signupUsername: string;
  signupEmail: string;
  signupPassword: string;
  signupConfirm: string;
  profileImage: string | File | null;
  setSignupUsername: (v: string) => void;
  setSignupEmail: (v: string) => void;
  setSignupPassword: (v: string) => void;
  setSignupConfirm: (v: string) => void;
  setProfileImage: (v: string | File | null) => void;
  signupError?: string | null;
  onBack: () => void;
  onSignup: () => void;
  displayName?: string;
}

const SignupStep: React.FC<Props> = ({
  signupUsername,
  signupEmail,
  signupPassword,
  signupConfirm,
  profileImage,
  setSignupUsername,
  setSignupEmail,
  setSignupPassword,
  setSignupConfirm,
  setProfileImage,
  signupError,
  onBack,
  onSignup,
  displayName,
}) => {
  const [typingDone, setTypingDone] = useState(false);

  return (
    <View style={{ width: "100%" }}>
      <TextBouble mode="agent" playOnceKey="auth:signup" onTypingDone={() => setTypingDone(true)}>
        <AppText variant="bodyText" style={{ marginBottom: SPACING.sm }}>
          {`Great to meet you${displayName ? ", " + displayName : ""}! \nLet's create your account.`}
        </AppText>
        <Widget entranceEnabled={typingDone} entranceDelay={0} entranceDuration={150}>
          <Input
            label="Username"
            placeholder="Choose a username"
            value={signupUsername}
            onChangeText={setSignupUsername}
          />
          <Input
            label="Email"
            placeholder="Your email"
            value={signupEmail}
            onChangeText={setSignupEmail}
            type="email"
          />
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

          {signupError ? (
            <AppText variant="errorText" style={{ marginTop: SPACING.md, marginBottom: SPACING.md }}>
              {signupError}
            </AppText>
          ) : null}

          <ProfilePhotoWidget
            imageUri={profileImage}
            onImageSelected={setProfileImage}
            size={80}
            title="Profile Photo (Optional)"
            subtitle="Tap to select or change your avatar"
          />
        </Widget>

        <AnimatedButtonsContainer entranceEnabled={typingDone}>
          <AppButton title="Back" icon="left" iconPosition="left" mode="light" onPress={onBack} />
          <AppButton title="Next" icon="right" iconPosition="right" onPress={onSignup} color="primary6" />
        </AnimatedButtonsContainer>
      </TextBouble>
    </View>
  );
};

export default SignupStep;
