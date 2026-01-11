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

  // Refresh sessions from API (authoritative + pagination)
  useEffect(() => {
    if (!user?.id || !token) return;
    let cancelled = false;

    (async () => {
      setIsLoadingSessions(true);
      try {
        // First try to get the quick list from User.sessions
        const quickSessions = await getChatUserSessions({ includeMessages: 10 });
        if (cancelled) return;

        if (quickSessions.length > 0) {
          setSessions(quickSessions);
          // If we have sessions, we might have more.
          // We can check if we need to load more by checking the count or just assuming true if we got full page.
          // But User.sessions is capped at 5. So we likely have more if we have 5.
          setHasMoreSessions(quickSessions.length >= 5);
          // Set cursor to the last one's lastActiveAt
          setNextCursor(quickSessions[quickSessions.length - 1].lastActiveAt);

          // Cache these sessions
          await saveCachedSessions(user.id, quickSessions);
        } else {
          // Fallback to standard list if empty (maybe migration didn't run or new user)
          const res = await listChatSessions({ limit: 10, includeMessages: 10 });
          if (cancelled) return;
          setSessions(res.sessions);
          setHasMoreSessions(res.hasMore);
          setNextCursor(res.nextCursor);

          // Cache only the latest 10 sessions on device
          await saveCachedSessions(user.id, res.sessions);
        }
      } catch (_) {
        // If network fails, cached sessions still render
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
        Array.isArray(next.messages) ? next.messages : prev?.messages
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
      (a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
    );
  }, []);

  const loadMoreSessions = useCallback(async () => {
    if (!hasMoreSessions || isLoadingMoreSessions || !nextCursor) return;
    setIsLoadingMoreSessions(true);
    try {
      const res = await listChatSessions({ limit: 10, cursor: nextCursor, includeMessages: 10 });
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
    [mergeSessions]
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
