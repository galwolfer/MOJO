/**
 * AuthScreen
 *
 * Entry-point screen for onboarding and authentication. Implements a
 * compact multi-step flow (welcome → name → login/signup → priorities)
 * while keeping each step modular and testable. Shared auth helpers like
 * `AuthStep` and `AuthButtonsGroup` are used to ensure consistent UI.
 *
 * Notes:
 * - For signup flow, profile image upload is handled at the parent screen.
 * - Pending auth tokens are persisted in AsyncStorage until priorities are set.
 */
import React, { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { View, StyleSheet, ScrollView, Platform } from "react-native";
import AppText from "../../components/common/AppText";
import { CATEGORY_KEYS, getCategoryMeta, type CategoryKey } from "../../config/categoryMeta";
import AppButton from "../../components/common/AppButton";
import Input from "../../components/inputs/Input";
import TextBouble from "../chat/components/TextBouble";
import { ICONS } from "../../components/icons/icons";
import { COLORS, SPACING } from "../../theme";
import { Box } from "../../components";
import { useAuth } from "../../context/AuthContext";
import { useKeyboard } from "../../hooks";

import WelcomeStep from "./components/WelcomeStep";
import NameStep from "./components/NameStep";
import LoginStep from "./components/LoginStep";
import SignupStep from "./components/SignupStep";
import OjoTypeStep from "./components/OjoTypeStep";
import PrioritiesStep from "./components/PrioritiesStep";

import {
  login as apiLogin,
  register as apiRegister,
  updateCategoryPriorities,
  setAuthToken,
} from "../../services/apiClient";

export default function AuthScreen() {
  const { signIn } = useAuth();
  const [screen, setScreen] = useState<"welcome" | "name" | "login" | "signup" | "ojotype" | "priorities">("welcome");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  // Signup state
  const [signupUsername, setSignupUsername] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");
  const [profileImage, setProfileImage] = useState<string | File | null>(null);
  const [signupGender, setSignupGender] = useState<string | undefined>(undefined);
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
          setScreen("ojotype");
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

      console.log("Signing up with profileImage:", profileImage ? "image provided" : "no image");

      // If we have a profile image (File on web or URI on native), check size and upload to obtain hosted URL
      let profileImageUrl: string | null = null;
      if (profileImage) {
        try {
          // Web: profileImage is a File
          if (typeof profileImage !== "string") {
            if ((profileImage as File).size && (profileImage as File).size > 400 * 1024) {
              setSignupError("Profile image too large. Please choose a smaller image.");
              return;
            }

            const uploadResp = await (
              await import("../../services/apiClient")
            ).uploadProfileImage(profileImage as File);
            if (uploadResp && uploadResp.url) {
              profileImageUrl = uploadResp.url;
            } else {
              setSignupError("Failed to upload profile image. Please try again.");
              return;
            }
          } else {
            // Native: profileImage is a file URI string
            // Use legacy expo-file-system API to get actual file size (avoids deprecation warning)
            const { getInfoAsync } = await import("expo-file-system/legacy");
            const info = await getInfoAsync(profileImage as string, { size: true } as any);
            console.log("Selected image file info:", info);

            if (!info.exists) {
              setSignupError("Selected profile image could not be found. Please re-select the image.");
              return;
            }

            if (info.size && info.size > 400 * 1024) {
              setSignupError("Profile image too large. Please choose a smaller image.");
              return;
            }

            const uploadResp = await (
              await import("../../services/apiClient")
            ).uploadProfileImage(profileImage as string);
            if (uploadResp && uploadResp.url) {
              profileImageUrl = uploadResp.url;
            } else {
              setSignupError("Failed to upload profile image. Please try again.");
              return;
            }
          }
        } catch (err: any) {
          console.error("Image upload error:", err);
          setSignupError(String(err?.message || "Failed to upload image"));
          return;
        }
      }

      const data = await apiRegister({
        username: signupUsername,
        email: signupEmail,
        password: signupPassword,
        displayName,
        profileImage: profileImageUrl,
        gender: signupGender,
      });

      if (data.token && data.user) {
        const pa = { token: data.token, user: data.user };
        setPendingAuth(pa);
        await savePendingAuthToStorage(pa);
        setScreen("ojotype");
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (err: any) {
      const msg = String(err?.message || err || "Signup failed");
      console.error("Signup error:", msg);
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
            profileImage={profileImage}
            signupGender={signupGender}
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
            setProfileImage={setProfileImage}
            setSignupGender={setSignupGender}
            signupError={signupError}
            // Back should return to the name step where displayName is edited
            onBack={() => setScreen("name")}
            onSignup={handleSignup}
            displayName={displayName}
          />
        </View>
      )}

      {screen === "ojotype" && (
        <View style={{ width: "100%" }}>
          <OjoTypeStep
            pendingToken={pendingAuth?.token}
            onBack={() => setScreen(isLoginFlow ? "login" : "signup")}
            onNext={() => setScreen("priorities")}
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
            onBack={() => setScreen("ojotype")}
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
