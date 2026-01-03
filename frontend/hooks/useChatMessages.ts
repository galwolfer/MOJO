import { useState, useCallback } from "react";
import { sendChatMessage, SendMessageResponse, ChatSessionSummary, ChatMessage } from "../services/chatService";

const MAX_CACHED_MESSAGES_PER_SESSION = 50;
const SEND_TIMEOUT_MS = 15000;

export function useChatMessages(updateSession: (session: ChatSessionSummary) => void) {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>(() => `session_${Date.now()}`);

  const createClientId = useCallback(() => `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, []);

  const buildSessionUpdate = (
    sessionId: string,
    now: Date,
    getSessions: () => ChatSessionSummary[],
    messages: ChatMessage[],
    messageCountDelta: number
  ): ChatSessionSummary => {
    const sessionsNow = getSessions();
    const existing = sessionsNow.find((s) => s.sessionId === sessionId);
    const baseCount =
      typeof existing?.messageCount === "number" ? existing.messageCount : existing?.messages?.length || 0;
    return {
      sessionId,
      lastActiveAt: now.toISOString(),
      createdAt: existing?.createdAt,
      messageCount: baseCount + messageCountDelta,
      messages,
    };
  };

  const sendMessage = useCallback(
    async (
      currentSessionId: string,
      text: string,
      getSessions: () => ChatSessionSummary[],
      options?: { clientId?: string; isRetry?: boolean }
    ) => {
      if (!text || isLoading) return;

      const clientId = options?.clientId || createClientId();
      const now = new Date();

      const sessionsNow = getSessions();
      const existing = sessionsNow.find((s) => s.sessionId === currentSessionId);
      const baseMessages = existing?.messages || [];

      let nextMessages = [...baseMessages];
      let messageCountDelta = 0;

      const pendingMessage: ChatMessage = {
        role: "user",
        content: text,
        timestamp: now.toISOString(),
        clientId,
        status: "pending",
      };

      if (options?.isRetry) {
        let found = false;
        nextMessages = nextMessages
          .map((m): ChatMessage => {
            if (m.clientId === clientId) {
              found = true;
              return { ...m, status: "pending" };
            }
            return m;
          })
          .filter((m) => !(m.isError && m.relatedClientId === clientId));

        if (!found) {
          nextMessages.push(pendingMessage);
          messageCountDelta = 1;
        }
      } else {
        nextMessages.push(pendingMessage);
        messageCountDelta = 1;
      }

      nextMessages = nextMessages.slice(-MAX_CACHED_MESSAGES_PER_SESSION);
      updateSession(buildSessionUpdate(currentSessionId, now, getSessions, nextMessages, messageCountDelta));
      const optimisticMessages = nextMessages;

      // Show loading state
      setIsLoading(true);

      try {
        const response: SendMessageResponse = await sendChatMessage(
          {
            message: text,
            sessionId: currentSessionId,
          },
          { timeoutMs: SEND_TIMEOUT_MS }
        );

        if (response.success && response.response) {
          // Update sessionId if returned
          if (response.sessionId) {
            setSessionId(response.sessionId);
          }

          const sid = response.sessionId || currentSessionId;
          const agentNow = new Date();
          const sessionsAfter = getSessions();
          const existingAfter = sessionsAfter.find((s) => s.sessionId === sid);
          const baseAfter = existingAfter?.messages || optimisticMessages;
          const updatedMessages = baseAfter.map(
            (m): ChatMessage => (m.clientId === clientId ? { ...m, status: "sent" } : m)
          );
          updatedMessages.push({
            role: "assistant",
            content: response.response,
            timestamp: agentNow.toISOString(),
            clientId: createClientId(),
          });
          const trimmed = updatedMessages.slice(-MAX_CACHED_MESSAGES_PER_SESSION);
          updateSession(buildSessionUpdate(sid, agentNow, getSessions, trimmed, 1));
        } else {
          const errNow = new Date();
          const sessionsAfter = getSessions();
          const existingAfter = sessionsAfter.find((s) => s.sessionId === currentSessionId);
          const baseAfter = existingAfter?.messages || optimisticMessages;
          const updatedMessages: ChatMessage[] = baseAfter
            .map((m): ChatMessage => (m.clientId === clientId ? { ...m, status: "failed" } : m))
            .filter((m) => !(m.isError && m.relatedClientId === clientId));
          updatedMessages.push({
            role: "assistant",
            content: response.error || "Sorry, something went wrong. Please try again.",
            timestamp: errNow.toISOString(),
            isError: true,
            clientId: createClientId(),
            relatedClientId: clientId,
          });
          const trimmed = updatedMessages.slice(-MAX_CACHED_MESSAGES_PER_SESSION);
          updateSession(buildSessionUpdate(currentSessionId, errNow, getSessions, trimmed, 1));
        }
      } catch (error) {
        const errNow = new Date();
        const sessionsAfter = getSessions();
        const existingAfter = sessionsAfter.find((s) => s.sessionId === currentSessionId);
        const baseAfter = existingAfter?.messages || optimisticMessages;
        const updatedMessages: ChatMessage[] = baseAfter
          .map((m): ChatMessage => (m.clientId === clientId ? { ...m, status: "failed" } : m))
          .filter((m) => !(m.isError && m.relatedClientId === clientId));
        updatedMessages.push({
          role: "assistant",
          content: "Unable to connect. Please check your connection and try again.",
          timestamp: errNow.toISOString(),
          isError: true,
          clientId: createClientId(),
          relatedClientId: clientId,
        });
        const trimmed = updatedMessages.slice(-MAX_CACHED_MESSAGES_PER_SESSION);
        updateSession(buildSessionUpdate(currentSessionId, errNow, getSessions, trimmed, 1));
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, updateSession, createClientId, setSessionId]
  );

  const handleSend = useCallback(
    async (currentSessionId: string, getSessions: () => ChatSessionSummary[]) => {
      const trimmedText = message.trim();
      if (!trimmedText || isLoading) return;

      // Clear input immediately
      setMessage("");

      await sendMessage(currentSessionId, trimmedText, getSessions);
    },
    [message, isLoading, sendMessage]
  );

  const handleRetry = useCallback(
    async (currentSessionId: string, clientId: string, getSessions: () => ChatSessionSummary[]) => {
      const sessionsNow = getSessions();
      const existing = sessionsNow.find((s) => s.sessionId === currentSessionId);
      const retryTarget = existing?.messages?.find((m) => m.clientId === clientId && m.role === "user");
      if (!retryTarget?.content) return;

      await sendMessage(currentSessionId, retryTarget.content, getSessions, { clientId, isRetry: true });
    },
    [sendMessage]
  );

  return {
    message,
    setMessage,
    isLoading,
    sessionId,
    setSessionId,
    handleSend,
    handleRetry,
  };
}
