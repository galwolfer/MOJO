import React, { useState, useEffect } from "react";
import { View, StyleSheet, Platform, Alert } from "react-native";
import AppText from "../components/common/AppText";
import AppButton from "../components/common/AppButton";
import Input from "../components/inputs/Input";
import TextBouble from "../components/common/TextBouble";
import { ICONS } from "../components/icons/icons";
import { COLORS, SPACING, TYPOGRAPHY } from "../theme";
import { Box } from "../components";

const API_BASE = "http://localhost:3000/api/auth";

export default function AuthScreen() {
  const isWeb = (Platform as any).OS === "web";

  const readStorage = (key: string, fallback = "") => {
    if (!isWeb) return fallback;
    try {
      const v = localStorage.getItem(key);
      return v ?? fallback;
    } catch (e) {
      return fallback;
    }
  };

  const writeStorage = (key: string, value: string) => {
    if (!isWeb) return;
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      // ignore
    }
  };

  const [screen, setScreen] = useState<"welcome" | "name" | "login" | "signup" | "done">(() =>
    (readStorage("auth.screen", "welcome") as any)
  );

  // Login state
  const [loginUsername, setLoginUsername] = useState(() => readStorage("auth.loginUsername", ""));
  const [loginPassword, setLoginPassword] = useState(() => readStorage("auth.loginPassword", ""));

  // Signup state
  const [signupUsername, setSignupUsername] = useState(() => readStorage("auth.signupUsername", ""));
  const [signupEmail, setSignupEmail] = useState(() => readStorage("auth.signupEmail", ""));
  const [signupPassword, setSignupPassword] = useState(() => readStorage("auth.signupPassword", ""));
  const [signupConfirm, setSignupConfirm] = useState(() => readStorage("auth.signupConfirm", ""));
  // Pre-signup display name (asked before the signup form)
  const [displayName, setDisplayName] = useState(() => readStorage("auth.displayName", ""));

  // Persist relevant pieces so accidental remounts (window resize / re-layout)
  // don't lose the current step or typed form data.
  useEffect(() => writeStorage("auth.screen", screen), [screen]);
  useEffect(() => writeStorage("auth.loginUsername", loginUsername), [loginUsername]);
  useEffect(() => writeStorage("auth.loginPassword", loginPassword), [loginPassword]);
  useEffect(() => writeStorage("auth.signupUsername", signupUsername), [signupUsername]);
  useEffect(() => writeStorage("auth.signupEmail", signupEmail), [signupEmail]);
  useEffect(() => writeStorage("auth.signupPassword", signupPassword), [signupPassword]);
  useEffect(() => writeStorage("auth.signupConfirm", signupConfirm), [signupConfirm]);
  useEffect(() => writeStorage("auth.displayName", displayName), [displayName]);

  const Mojo = ICONS.mojo as React.FC<any> | undefined;

  async function handleLogin() {
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Login failed");
      Alert.alert("Success", "Logged in");
      setScreen("done");
    } catch (err: any) {
      Alert.alert("Error", String(err.message || err));
    }
  }

  async function handleSignup() {
    if (signupPassword !== signupConfirm) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: signupUsername, email: signupEmail, password: signupPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Signup failed");
      Alert.alert("Success", "Account created");
      setScreen("done");
    } catch (err: any) {
      Alert.alert("Error", String(err.message || err));
    }
  }

  return (
    <View style={styles.container}>
      <View style={{ alignItems: "center", marginBottom: -5 * SPACING.sm }}>
        {Mojo ? <Mojo width={SPACING.xlg * 5} color={COLORS.primary1} /> : null}
      </View>
      {screen === "welcome" && (
        <View style={styles.centered}>
          <TextBouble mode="agent">
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
        <TextBouble mode="agent">
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
                setSignupUsername(displayName || signupUsername);
                setScreen("signup");
              }}
              style={{ marginLeft: SPACING.md }}
            />
          </View>
        </TextBouble>
      )}

      {screen === "login" && (
        <TextBouble mode="agent">
          <AppText variant="bodyText" style={{ marginBottom: SPACING.md }}>
            {"Welcome back 👋\nLet’s pick up where you left off."}
          </AppText>
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
        <TextBouble mode="agent">
          <AppText variant="bodyText" style={{ marginBottom: SPACING.md }}>
            {`Great to meet you${displayName ? ", " + displayName : ""}! \nLet's create your account.`}
          </AppText>
          <Box widget={true} style={styles.form}>
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
          <AppButton title="Go to start" onPress={() => setScreen("welcome")} style={{ marginTop: SPACING.md }} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: SPACING.xlg,
    backgroundColor: COLORS.white3,
    justifyContent: "center",
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
