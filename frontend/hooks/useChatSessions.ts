/**
 * useChatSessions
 *
 * Hook responsible for loading and maintaining a user's chat sessions.
 * Features:
 * - Fast startup via cached sessions
 * - API pagination and merge logic to preserve local optimistic messages
 * - Helpers to load more sessions and update a session from other hooks
 *
 * Usage:
 * const { sessions, isLoadingSessions, loadMoreSessions, updateSession } = useChatSessions();
 */
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { listChatSessions, getChatUserSessions, ChatSessionSummary, ChatMessage } from "../services/chatService";
import { loadCachedSessions, saveCachedSessions } from "../services/chatSessionCache";

export function useChatSessions() {
  const { token, user } = useAuth();
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isLoadingMoreSessions, setIsLoadingMoreSessions] = useState(false);
  const [hasMoreSessions, setHasMoreSessions] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);

  // Load cached sessions for this user (fast startup)
  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;
    (async () => {
      const cached = await loadCachedSessions(user.id);
      if (cancelled) return;
      if (cached.length > 0) {
        setSessions(cached);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Refresh sessions from API in two stages so the UI fills in immediately.
  // Stage 1 (fast): getChatUserSessions uses User.sessions (embedded doc, very fast).
  //   → MERGE into state so cached/optimistic messages are never overwritten.
  // Stage 2 (full): listChatSessions queries the Session collection for the last 30
  //   sessions with 50 messages each, picking up older history the fast path misses.
  //   → MERGE again for the same reason.
  // Never call setSessions([]) – always merge so stale cache stays visible on error.
  useEffect(() => {
    if (!user?.id || !token) return;
    let cancelled = false;

    (async () => {
      setIsLoadingSessions(true);
      try {
        // --- Stage 1: fast path ---
        const quickSessions = await getChatUserSessions({ includeMessages: 50 });
        if (cancelled) return;

        if (quickSessions.length > 0) {
          setSessions((prev) => mergeSessions(prev, quickSessions));
          await saveCachedSessions(user.id, quickSessions);
        }

        // --- Stage 2: full history (covers last ~5 days / 30 sessions) ---
        const res = await listChatSessions({ limit: 30, includeMessages: 50 });
        if (cancelled) return;

        if (res.sessions.length > 0) {
          setSessions((prev) => mergeSessions(prev, res.sessions));
          setHasMoreSessions(res.hasMore);
          setNextCursor(res.nextCursor);
          await saveCachedSessions(user.id, res.sessions);
        } else if (quickSessions.length === 0) {
          // Only clear if BOTH paths returned nothing (genuine new user)
          setSessions([]);
          setHasMoreSessions(false);
          setNextCursor(undefined);
        }
      } catch (_) {
        // If network fails, cached sessions loaded above are still visible.
      } finally {
        if (!cancelled) setIsLoadingSessions(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, user?.id]);

  // Persist updated top-10 sessions (debounced-ish)
  useEffect(() => {
    if (!user?.id) return;
    const t = setTimeout(() => {
      saveCachedSessions(user.id, sessions).catch(() => undefined);
    }, 300);
    return () => clearTimeout(t);
  }, [sessions, user?.id]);

  const mergeSessions = useCallback((existing: ChatSessionSummary[], incoming: ChatSessionSummary[]) => {
    const isLocalMessage = (message: ChatMessage) =>
      message.status === "pending" || message.status === "failed" || message.isError === true;

    const messageKey = (message: ChatMessage) =>
      message.clientId ||
      `${message.role}|${message.content}|${message.timestamp || ""}|${message.isError ? "error" : "ok"}`;

    const mergeMessages = (prevMessages?: ChatMessage[], nextMessages?: ChatMessage[]) => {
      if (!nextMessages) return prevMessages;
      if (!prevMessages || prevMessages.length === 0) return nextMessages;

      const merged = [...nextMessages];
      const seen = new Set(merged.map(messageKey));

      for (const msg of prevMessages) {
        if (!isLocalMessage(msg)) continue;
        const key = messageKey(msg);
        if (!seen.has(key)) {
          merged.push(msg);
          seen.add(key);
        }
      }

      merged.sort((a, b) => {
        const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return aTime - bTime;
      });

      // Remove any local error messages if the incoming (server) messages include
      const localErrors = (prevMessages || []).filter((m) => m.isError && !!m.relatedClientId);
      for (const err of localErrors) {
        const relatedClientId = err.relatedClientId!;
        const userMsg = (prevMessages || []).find((m) => m.clientId === relatedClientId && m.role === "user");
        if (!userMsg || !userMsg.timestamp) continue;

        const userTime = new Date(userMsg.timestamp).getTime();
        const assistantAppeared = (nextMessages || []).some((n) => {
          if (n.role !== "assistant" || !n.timestamp) return false;
          return new Date(n.timestamp).getTime() > userTime;
        });

        if (assistantAppeared) {
          // drop this error from merged
          const idx = merged.findIndex((m) => m === err || (m.isError && m.relatedClientId === relatedClientId));
          if (idx !== -1) merged.splice(idx, 1);
        }
      }

      return merged;
    };

    const map = new Map<string, ChatSessionSummary>();

    for (const s of existing) {
      if (s && s.sessionId) map.set(s.sessionId, s);
    }

    for (const next of incoming) {
      if (!next || !next.sessionId) continue;
      const prev = map.get(next.sessionId);

      // Preserve messages if the incoming session doesn't include them.
      const mergedMessages = mergeMessages(
        prev?.messages,
        Array.isArray(next.messages) ? next.messages : prev?.messages,
      );
      const merged: ChatSessionSummary = {
        ...(prev || {}),
        ...next,
        createdAt: next.createdAt ?? prev?.createdAt,
        lastActiveAt: next.lastActiveAt ?? prev?.lastActiveAt,
        messageCount: next.messageCount ?? prev?.messageCount,
        messages: mergedMessages,
      };

      map.set(next.sessionId, merged);
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime(),
    );
  }, []);

  const loadMoreSessions = useCallback(async () => {
    if (!hasMoreSessions || isLoadingMoreSessions || !nextCursor) return;
    setIsLoadingMoreSessions(true);
    try {
      const res = await listChatSessions({ limit: 20, cursor: nextCursor, includeMessages: 50 });
      setSessions((prev) => mergeSessions(prev, res.sessions));
      setHasMoreSessions(res.hasMore);
      setNextCursor(res.nextCursor);
    } catch (_) {
      // ignore
    } finally {
      setIsLoadingMoreSessions(false);
    }
  }, [hasMoreSessions, isLoadingMoreSessions, mergeSessions, nextCursor]);

  const updateSession = useCallback(
    (updatedSession: ChatSessionSummary) => {
      setSessions((prev) => mergeSessions(prev, [updatedSession]));
    },
    [mergeSessions],
  );

  return {
    sessions,
    isLoadingSessions,
    isLoadingMoreSessions,
    hasMoreSessions,
    loadMoreSessions,
    updateSession,
  };
}
