import React, { createContext, useState, useEffect, useContext } from "react";

/**
 * AuthContext
 *
 * Provides `user`, `token`, and helpers `signIn`/`signOut` and persists
 * token/user using secure storage on native or localStorage on web.
 */
import { Platform } from "react-native";
import { setAuthToken } from "../services/apiClient";
import { setUnauthorizedHandler } from "../services/httpClient";

// NOTE: You need to install expo-secure-store:
// npx expo install expo-secure-store
let SecureStore: any;
try {
  SecureStore = require("expo-secure-store");
} catch (e) {
  console.warn(
    "expo-secure-store not found, falling back to memory storage (or localStorage on web). Please install it for persistence."
  );
}

const isWeb = Platform.OS === "web";
const STORAGE_KEY = "mojo_auth_token";
const USER_KEY = "mojo_user_data";

const Storage = {
  getItem: async (key: string) => {
    if (isWeb) {
      if (typeof localStorage !== "undefined") return localStorage.getItem(key);
      return null;
    }
    if (SecureStore) return await SecureStore.getItemAsync(key);
    return null;
  },
  setItem: async (key: string, value: string) => {
    if (isWeb) {
      if (typeof localStorage !== "undefined") return localStorage.setItem(key, value);
      return;
    }
    if (SecureStore) return await SecureStore.setItemAsync(key, value);
  },
  deleteItem: async (key: string) => {
    if (isWeb) { 
      if (typeof localStorage !== "undefined") return localStorage.removeItem(key);
      return;
    }
    if (SecureStore) return await SecureStore.deleteItemAsync(key);
  },
};

export type User = {
  id: string;
  username: string;
  displayName?: string;
  email?: string;
  profileImage?: string | null;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  signIn: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStorage();
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(async () => {
      await signOut();
    });

    return () => {
      setUnauthorizedHandler(null);
    };
  }, []);

  const loadStorage = async () => {
    try {
      const storedToken = await Storage.getItem(STORAGE_KEY);
      const storedUser = await Storage.getItem(USER_KEY);

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        setAuthToken(storedToken);
      }
    } catch (e) {
      console.error("Failed to load auth storage", e);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (newToken: string, newUser: User) => {
    try {
      setToken(newToken);
      setUser(newUser);
      setAuthToken(newToken);
      await Storage.setItem(STORAGE_KEY, newToken);
      await Storage.setItem(USER_KEY, JSON.stringify(newUser));
    } catch (e) {
      console.error("Failed to save auth storage", e);
    }
  };

  const signOut = async () => {
    try {
      setToken(null);
      setUser(null);
      setAuthToken(null);
      await Storage.deleteItem(STORAGE_KEY);
      await Storage.deleteItem(USER_KEY);
    } catch (e) {
      console.error("Failed to clear auth storage", e);
    }
  };

  return <AuthContext.Provider value={{ user, token, isLoading, signIn, signOut }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
