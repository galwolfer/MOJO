import React, { useState, useEffect } from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * AuthScreen
 *
 * Small onboarding and authentication screen that supports a lightweight
 * multi-step flow: welcome -> name -> login/signup -> priorities. Uses `useAuth`
 * to persist the authenticated user via `AuthProvider`.
 */
import { View, StyleSheet, ScrollView } from "react-native";
import AppText from "../components/common/AppText";
import CategoryGrid from "../components/categories/CategoryGrid";
import { CATEGORY_KEYS, getCategoryMeta, type CategoryKey } from "../config/categoryMeta";
import AppButton from "../components/common/AppButton";
import Input from "../components/inputs/Input";
import TextBouble from "../components/chat/TextBouble";
import { ICONS } from "../components/icons/icons";
import { COLORS, SPACING } from "../theme";
import { Box } from "../components";
import { useAuth } from "../context/AuthContext";
import { useKeyboard } from "../hooks";

import WelcomeStep from "./auth/WelcomeStep";
import NameStep from "./auth/NameStep";
import LoginStep from "./auth/LoginStep";
import SignupStep from "./auth/SignupStep";
import PrioritiesStep from "./auth/PrioritiesStep";

import {
  login as apiLogin,
  register as apiRegister,
  updateCategoryPriorities,
  setAuthToken,
} from "../services/apiClient";

export default function AuthScreen() {
  const { signIn } = useAuth();
  const [screen, setScreen] = useState<"welcome" | "name" | "login" | "signup" | "priorities">("welcome");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  // Signup state
  const [signupUsername, setSignupUsername] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");
  // Pre-signup display name (asked before the signup form)
  const [displayName, setDisplayName] = useState("");

  // Category priorities (for new signups)
  const [priorities, setPriorities] = useState<Record<string, number>>({});
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | null>(null);

  // Pending auth state to hold data until user completes priorities and is signed in
  const [pendingAuth, setPendingAuth] = useState<{ token: string; user: any } | null>(null); // TODO: replace `any` with `User` type from AuthContext if desired

  const [isLoginFlow, setIsLoginFlow] = useState(false);

  const PENDING_AUTH_KEY = "pendingAuth";

  async function savePendingAuthToStorage(data: { token: string; user: any } | null) {
    try {
      if (data) {
        await AsyncStorage.setItem(PENDING_AUTH_KEY, JSON.stringify(data));
      } else {
        await AsyncStorage.removeItem(PENDING_AUTH_KEY);
      }
    } catch (err) {
      console.warn("Failed to save pending auth:", err);
    }
  }

  async function loadPendingAuthFromStorage() {
    try {
      const raw = await AsyncStorage.getItem(PENDING_AUTH_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.token) {
          setPendingAuth(parsed);
          setScreen("priorities");
        }
      }
    } catch (err) {
      console.warn("Failed to load pending auth:", err);
    }
  }

  async function removePendingAuthFromStorage() {
    try {
      await AsyncStorage.removeItem(PENDING_AUTH_KEY);
    } catch (err) {
      console.warn("Failed to remove pending auth:", err);
    }
  }

  useEffect(() => {
    loadPendingAuthFromStorage();
  }, []);

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
        const pa = { token: data.token, user: data.user };
        setPendingAuth(pa);
        await savePendingAuthToStorage(pa);
        setScreen("priorities");
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
        const pa = { token: data.token, user: data.user };
        setPendingAuth(pa);
        await savePendingAuthToStorage(pa);
        setScreen("priorities");
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (err: any) {
      const msg = String(err?.message || err || "Signup failed");
      setSignupError(msg);
    }
  }

  const handleFinish = async () => {
    try {
      if (pendingAuth) {
        // signIn may be sync or async depending on implementation
        await Promise.resolve(signIn(pendingAuth.token, pendingAuth.user));
        setPendingAuth(null);
        await removePendingAuthFromStorage();
      } else {
        setScreen("welcome");
        await removePendingAuthFromStorage();
      }
    } catch (err) {
      console.error("Failed to finish auth flow:", err);
    }
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={contentContainerStyle}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={{ alignItems: "center", marginBottom: -3 * SPACING.sm }}>
        {Mojo ? <Mojo width={SPACING.xlg * 5} color={COLORS.primary1} /> : null}
      </View>
      {screen === "welcome" && (
        <View style={styles.centered}>
          <WelcomeStep
            onStartNew={() => {
              setIsLoginFlow(false);
              setScreen("name");
            }}
            onHaveAccount={() => {
              setIsLoginFlow(true);
              setScreen("login");
            }}
          />
        </View>
      )}

      {screen === "name" && (
        <View style={{ width: "100%" }}>
          <NameStep
            displayName={displayName}
            setDisplayName={setDisplayName}
            onBack={() => setScreen("welcome")}
            onNext={() => setScreen("signup")}
          />
        </View>
      )}

      {screen === "login" && (
        <View style={{ width: "100%" }}>
          <LoginStep
            loginUsername={loginUsername}
            loginPassword={loginPassword}
            setLoginUsername={setLoginUsername}
            setLoginPassword={setLoginPassword}
            loginError={loginError}
            onBack={() => setScreen("welcome")}
            onLogin={handleLogin}
          />
        </View>
      )}

      {screen === "signup" && (
        <View style={{ width: "100%" }}>
          <SignupStep
            signupUsername={signupUsername}
            signupEmail={signupEmail}
            signupPassword={signupPassword}
            signupConfirm={signupConfirm}
            setSignupUsername={(v) => {
              setSignupUsername(v);
              setSignupError(null);
            }}
            setSignupEmail={(v) => {
              setSignupEmail(v);
              setSignupError(null);
            }}
            setSignupPassword={(v) => {
              setSignupPassword(v);
              setSignupError(null);
            }}
            setSignupConfirm={(v) => {
              setSignupConfirm(v);
              setSignupError(null);
            }}
            signupError={signupError}
            // Back should return to the name step where displayName is edited
            onBack={() => setScreen("name")}
            onSignup={handleSignup}
            displayName={displayName}
          />
        </View>
      )}

      {screen === "priorities" && (
        <View style={{ width: "100%" }}>
          <PrioritiesStep
            priorities={priorities}
            setPriorities={setPriorities}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            onBack={() => setScreen(isLoginFlow ? "login" : "signup")}
            entranceEnabled={true}
            entranceBaseDelay={300}
            onFinish={async (payload) => {
              try {
                if (pendingAuth?.token) setAuthToken(pendingAuth.token);
                if (pendingAuth?.token) await updateCategoryPriorities({ priorities: payload });
                setPriorities(payload);
              } catch (err: any) {
                console.error("Failed to update priorities:", err);
              }

              handleFinish();
            }}
          />
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
    justifyContent: "space-between",
    flexDirection: "row",
    gap: SPACING.md,
  },
  widgetWrap: {
    width: "100%",
    alignSelf: "center",
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
