/**
 * SignupStep
 *
 * Collects registration details (username, email, password) and optional
 * profile photo. Shows client-side `signupError` when validation fails.
 *
 * Note: image upload handling happens at the parent `Auth` screen — this
 * component only collects the selected image/URI and displays the widget.
 */
import React from "react";
import { View } from "react-native";
import AppText from "../../../components/common/AppText";
import ErrorText from "../../../components/common/ErrorText";
import AuthStep from "./AuthStep";
import AuthButtonsGroup from "./AuthButtonsGroup";
import Widget from "../../../components/special/Widget";
import Input from "../../../components/inputs/Input";
import ProfilePhotoWidget from "../../../components/special/ProfilePhotoWidget";
import { SPACING } from "../../../theme";

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
  return (
    <View style={{ width: "100%" }}>
      <AuthStep playOnceKey="auth:signup">
        {(typingDone: boolean) => (
          <>
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
                <ErrorText style={{ marginTop: SPACING.md, marginBottom: SPACING.md }}>{signupError}</ErrorText>
              ) : null}

              <ProfilePhotoWidget
                imageUri={profileImage}
                onImageSelected={setProfileImage}
                size={80}
                title="Profile Photo (Optional)"
                subtitle="Tap to select or change your avatar"
              />
            </Widget>

            <AuthButtonsGroup
              entranceEnabled={typingDone}
              left={{ title: "Back", onPress: onBack, icon: "left", iconPosition: "left", mode: "light" }}
              right={{ title: "Next", onPress: onSignup, icon: "right", iconPosition: "right", color: "primary6" }}
            />
          </>
        )}
      </AuthStep>
    </View>
  );
};

export default SignupStep;
