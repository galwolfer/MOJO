import React, { useState } from "react";
import { View, StyleSheet, Platform, Alert } from "react-native";
import AppText from "../components/common/AppText";
import AppButton from "../components/common/AppButton";
import Input from "../components/inputs/Input";
import TextBouble from "../components/common/TextBouble";
import { ICONS } from "../components/icons/icons";
import { COLORS, SPACING, TYPOGRAPHY } from "../theme";

const API_BASE = "http://localhost:3000/api/auth";

export default function AuthScreen() {
  const [screen, setScreen] = useState<"welcome" | "login" | "signup" | "done">("welcome");

  // Login state
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup state
  const [signupUsername, setSignupUsername] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");

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
              {"I’m ojo, your new mentor. Let’s get to know each other so I can help you reach your goals."}
            </AppText>
            <View style={styles.buttonsCol}>
              <AppButton title="Have an account" mode="light" width="100%" onPress={() => setScreen("login")} />
              <AppButton title="Sign up" onPress={() => setScreen("signup")} color="primary6" width="100%" />
            </View>
          </TextBouble>
        </View>
      )}

      {screen === "login" && (
        <View style={styles.form}>
          <AppText variant="title2" style={{ marginBottom: SPACING.md }}>
            Welcome Back
          </AppText>

          <Input label="Username" placeholder="Your username" value={loginUsername} onChangeText={setLoginUsername} />
          <Input
            label="Password"
            placeholder="Your password"
            value={loginPassword}
            onChangeText={setLoginPassword}
            type="password"
          />

          <View style={styles.buttonsRow}>
            <AppButton title="Back" mode="light" onPress={() => setScreen("welcome")} />
            <AppButton title="Log In" onPress={handleLogin} style={{ marginLeft: SPACING.md }} />
          </View>
        </View>
      )}

      {screen === "signup" && (
        <View style={styles.form}>
          <AppText variant="title2" style={{ marginBottom: SPACING.md }}>
            Create an account
          </AppText>

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

          <View style={styles.buttonsRow}>
            <AppButton title="Back" mode="light" onPress={() => setScreen("welcome")} />
            <AppButton title="Sign up" onPress={handleSignup} style={{ marginLeft: SPACING.md }} />
          </View>
        </View>
      )}

      {screen === "done" && (
        <View style={styles.centered}>
          <AppText variant="title2">You're all set</AppText>
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
    marginTop: SPACING.lg,
    gap: SPACING.md,
  },
  buttonsCol: {
    width: "100%",
    gap: SPACING.md,
  },
  form: {
    gap: SPACING.md,
  },
});
