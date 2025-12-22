import React, { useState } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import AppText from "../components/common/AppText";
import AppButton from "../components/common/AppButton";
import Input from "../components/inputs/Input";
import TextBouble from "../components/common/TextBouble";
import { ICONS } from "../components/icons/icons";
import { COLORS, SPACING } from "../theme";
import { Box } from "../components";
import { useAuth } from "../context/AuthContext";
import { useKeyboard } from "../hooks";

import { login as apiLogin, register as apiRegister, setApiBase } from "../services/apiClient";

// Optionally override the base URL (useful for dev / device testing)
// setApiBase("http://10.0.2.2:3000/api");

export default function AuthScreen() {
  const { signIn } = useAuth();
  const [screen, setScreen] = useState<"welcome" | "name" | "login" | "signup" | "done">("welcome");

  const [loginError, setLoginError] = useState<string | null>(null);
  const [signupError, setSignupError] = useState<string | null>(null);

  // Login state
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup state
  const [signupUsername, setSignupUsername] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");
  // Pre-signup display name (asked before the signup form)
  const [displayName, setDisplayName] = useState("");

  // Pending auth state to hold data until user clicks "Go to start"
  const [pendingAuth, setPendingAuth] = useState<{ token: string; user: any } | null>(null);

  const Mojo = ICONS.mojo as React.FC<any> | undefined;
  const { visible: keyboardVisible, height: keyboardHeight } = useKeyboard();
  const keyboardPadding = keyboardVisible ? keyboardHeight : 0;
  const contentContainerStyle = [
    styles.contentContainer,
    keyboardVisible ? styles.contentContainerKeyboard : undefined,
    { paddingBottom: SPACING.xlg + keyboardPadding },
  ];

  async function handleLogin() {
    try {
      setLoginError(null);
      // Basic client validation
      if (!loginUsername || !loginPassword) {
        setLoginError("Please enter username and password");
        return;
      }

      const data = await apiLogin({ username: loginUsername, password: loginPassword });
      if (data.token && data.user) {
        setPendingAuth({ token: data.token, user: data.user });
        setScreen("done");
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (err: any) {
      const msg = String(err?.message || err || "Login failed");
      setLoginError(msg);
    }
  }

  async function handleSignup() {
    if (signupPassword !== signupConfirm) {
      setSignupError("Passwords do not match");
      return;
    }

    try {
      setSignupError(null);

      // Client-side validation
      if (!signupUsername) {
        setSignupError("Please choose a username");
        return;
      }
      if (!signupEmail) {
        setSignupError("Please enter your email");
        return;
      }
      if (!signupPassword || signupPassword.length < 6) {
        setSignupError("Password must be at least 6 characters");
        return;
      }

      const data = await apiRegister({
        username: signupUsername,
        email: signupEmail,
        password: signupPassword,
        displayName,
      });

      if (data.token && data.user) {
        setPendingAuth({ token: data.token, user: data.user });
        setScreen("done");
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (err: any) {
      const msg = String(err?.message || err || "Signup failed");
      setSignupError(msg);
    }
  }

  const handleFinish = () => {
    if (pendingAuth) {
      signIn(pendingAuth.token, pendingAuth.user);
    } else {
      setScreen("welcome");
    }
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={contentContainerStyle}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={{ alignItems: "center", marginBottom: -5 * SPACING.sm }}>
        {Mojo ? <Mojo width={SPACING.xlg * 5} color={COLORS.primary1} /> : null}
      </View>
      {screen === "welcome" && (
        <View style={styles.centered}>
          <TextBouble mode="agent" playOnceKey="auth:welcome">
            <AppText variant="bodyText">
              {"Hi, I’m "}
              <AppText variant="boldText" style={{ color: COLORS.primary1 }}>
                ojo
              </AppText>
              {" 👋\nLet’s get to know each other so I can help you reach your goals."}
            </AppText>
            <View style={styles.buttonsCol}>
              <AppButton title="Ready to start?" onPress={() => setScreen("name")} color="primary6" width="100%" />
              <AppButton title="Have an account" mode="light" width="100%" onPress={() => setScreen("login")} />
            </View>
          </TextBouble>
        </View>
      )}

      {screen === "name" && (
        <TextBouble mode="agent" playOnceKey="auth:name">
          <AppText variant="bodyText">{"Let’s begin 😊 \nFirst, what should I call you?"}</AppText>
          <Box widget={true}>
            <Input label="Your name" placeholder="Your name" value={displayName} onChangeText={setDisplayName} />
          </Box>
          <View style={styles.buttonsRow}>
            <AppButton title="Back" icon="left" iconPosition="left" mode="light" onPress={() => setScreen("welcome")} />
            <AppButton
              icon="right"
              color="primary6"
              title="Next"
              onPress={() => {
                // Keep display name separate from username — do not copy it into username.
                setScreen("signup");
              }}
              style={{ marginLeft: SPACING.md }}
            />
          </View>
        </TextBouble>
      )}

      {screen === "login" && (
        <TextBouble mode="agent" playOnceKey="auth:login">
          <AppText variant="bodyText" style={{ marginBottom: SPACING.md }}>
            {"Welcome back 👋\nLet’s pick up where you left off."}
          </AppText>
          {loginError ? (
            <AppText variant="errorText" style={{ marginBottom: SPACING.md }}>
              {loginError}
            </AppText>
          ) : null}
          <Box widget={true} style={styles.form}>
            <Input label="Username" placeholder="Your username" value={loginUsername} onChangeText={setLoginUsername} />
            <Input
              label="Password"
              placeholder="Your password"
              value={loginPassword}
              onChangeText={setLoginPassword}
              type="password"
            />
          </Box>

          <View style={styles.buttonsRow}>
            <AppButton title="Back" mode="light" onPress={() => setScreen("welcome")} icon="left" iconPosition="left" />
            <AppButton title="Log In" onPress={handleLogin} style={{ marginLeft: SPACING.md }} color="primary6" />
          </View>
        </TextBouble>
      )}

      {screen === "signup" && (
        <TextBouble mode="agent" playOnceKey="auth:signup">
          <AppText variant="bodyText" style={{ marginBottom: SPACING.md }}>
            {`Great to meet you${displayName ? ", " + displayName : ""}! \nLet's create your account.`}
          </AppText>
          <Box widget={true} style={styles.form}>
            {signupError ? (
              <AppText variant="errorText" style={{ marginBottom: SPACING.md }}>
                {signupError}
              </AppText>
            ) : null}
            <Input
              label="Username"
              placeholder="Choose a username"
              value={signupUsername}
              onChangeText={(v) => {
                setSignupUsername(v);
                setSignupError(null);
              }}
            />
            <Input
              label="Email"
              placeholder="Your email"
              value={signupEmail}
              onChangeText={(v) => {
                setSignupEmail(v);
                setSignupError(null);
              }}
              type="email"
            />
            <Input
              label="Password"
              placeholder="Password"
              value={signupPassword}
              onChangeText={(v) => {
                setSignupPassword(v);
                setSignupError(null);
              }}
              type="password"
            />
            <Input
              label="Confirm"
              placeholder="Confirm password"
              value={signupConfirm}
              onChangeText={(v) => {
                setSignupConfirm(v);
                setSignupError(null);
              }}
              type="password"
            />
          </Box>
          <View style={styles.buttonsRow}>
            <AppButton title="Back" icon="left" iconPosition="left" mode="light" onPress={() => setScreen("welcome")} />
            <AppButton
              title="Next"
              onPress={handleSignup}
              icon="right"
              color="primary6"
              style={{ marginLeft: SPACING.md }}
            />
          </View>
        </TextBouble>
      )}

      {screen === "done" && (
        <View style={styles.centered}>
          <AppText variant="title2">
            {`You're all set${displayName || signupUsername ? ", " + (displayName || signupUsername) : ""}`}
          </AppText>
          <AppButton title="Go to start" onPress={handleFinish} style={{ marginTop: SPACING.md }} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: COLORS.white3,
  },
  contentContainer: {
    flexGrow: 1,
    padding: SPACING.xlg,
    justifyContent: "center",
    alignItems: "center",
  },
  contentContainerKeyboard: {
    justifyContent: "flex-start",
  },
  centered: {
    alignItems: "center",
    gap: SPACING.lg,
  },
  buttonsRow: {
    paddingTop: SPACING.lg,
    width: "100%",
    alignContent: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: SPACING.md,
  },
  buttonsCol: {
    width: "100%",
    gap: SPACING.md,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: SPACING.md,
  },
});
