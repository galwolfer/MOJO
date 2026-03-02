import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ChatSessionSummary } from "./chatService";

const isWeb = Platform.OS === "web";

function storageKey(userId: string): string {
  return `mojo_chat_sessions_v1:${userId}`;
}

const WebStorage = {
  async getItem(key: string): Promise<string | null> {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(key);
  },
};

export type CachedSessionsPayload = {
  version: 1;
  savedAt: string;
  sessions: ChatSessionSummary[];
};

export async function loadCachedSessions(userId: string): Promise<ChatSessionSummary[]> {
  const key = storageKey(userId);
  const raw = isWeb ? await WebStorage.getItem(key) : await AsyncStorage.getItem(key);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as CachedSessionsPayload;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.sessions)) return [];
    return parsed.sessions;
  } catch {
    return [];
  }
}

export async function saveCachedSessions(userId: string, sessions: ChatSessionSummary[]): Promise<void> {
  const key = storageKey(userId);

  // Keep only the most recent 30 sessions (covers ~5 days of typical activity)
  const dedup = new Map<string, ChatSessionSummary>();
  for (const s of sessions) {
    if (s && s.sessionId) dedup.set(s.sessionId, s);
  }

  const trimmed = Array.from(dedup.values())
    .sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime())
    .slice(0, 30);

  const payload: CachedSessionsPayload = {
    version: 1,
    savedAt: new Date().toISOString(),
    sessions: trimmed,
  };

  const serialized = JSON.stringify(payload);
  if (isWeb) {
    await WebStorage.setItem(key, serialized);
  } else {
    await AsyncStorage.setItem(key, serialized);
  }
}

export async function clearCachedSessions(userId: string): Promise<void> {
  const key = storageKey(userId);
  if (isWeb) {
    await WebStorage.removeItem(key);
  } else {
    await AsyncStorage.removeItem(key);
  }
}
