/**
 * useChatMessages
 *
 * Hook that encapsulates the client-side message lifecycle for a chat session:
 * - Optimistic UI updates for sending messages
 * - Retry handling and failure states
 * - Message caching trimming and clientId correlation
 *
 * Usage:
 * const { message, setMessage, isLoading, sessionId, setSessionId, handleSend, handleRetry } =
 *   useChatMessages(updateSession, { onTaskChange: () => notifyTaskUpdate() });
 *
 * Notes:
 * - `updateSession` is a callback provided by callers to merge session changes into app state.
 * - `onTaskChange` (optional) is called when assistant response suggests task was created/updated
 */
import { useState, useCallback } from "react";
import { sendChatMessage, SendMessageResponse, ChatSessionSummary, ChatMessage } from "../services/chatService";
import { useOjoType } from "./useOjoType";

const MAX_CACHED_MESSAGES_PER_SESSION = 50;
const SEND_TIMEOUT_MS = 15000;

// Keywords that indicate a task-related action in the response
const TASK_ACTION_KEYWORDS = [
  "task_list",
  "task_confirmation",
  "task_detail",
  "created a task",
  "added a task",
  "task has been",
  "completed the task",
  "marked as done",
  "marked as complete",
  "updated the task",
  "deleted the task",
];

// Keywords that indicate stats/gamification changed (task completion, points, streak)
const STATS_CHANGE_KEYWORDS = [
  "completed the task",
  "marked as done",
  "marked as complete",
  "marked as incomplete",
  "marked as uncomplete",
  "uncompleted",
  "reverted",
  "points",
  "streak",
  "earned",
  "awarded",
  "subtracted",
];

interface UseChatMessagesOptions {
  onTaskChange?: () => void;
  onStatsChange?: () => void;
}

type SendMessageOptions = UseChatMessagesOptions & { clientId?: string; isRetry?: boolean };

export function useChatMessages(
  updateSession: (session: ChatSessionSummary) => void,
  options?: UseChatMessagesOptions,
) {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>(() => `session_${Date.now()}`);

  const createClientId = useCallback(() => `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, []);
  const { currentOjoType } = useOjoType();

  const hookOnTaskChange = options?.onTaskChange;
  const hookOnStatsChange = options?.onStatsChange;

  const buildSessionUpdate = (
    sessionId: string,
    now: Date,
    getSessions: () => ChatSessionSummary[],
    messages: ChatMessage[],
    messageCountDelta: number,
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
      options?: SendMessageOptions,
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
          .filter((m) => !m.isError);

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
          { timeoutMs: SEND_TIMEOUT_MS },
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

          // Mark the original user message as sent
          let updatedMessages = baseAfter.map(
            (m): ChatMessage => (m.clientId === clientId ? { ...m, status: "sent" } : m),
          );

          const assistantMessage: ChatMessage = {
            role: "assistant",
            content: response.response,
            timestamp: agentNow.toISOString(),
            clientId: createClientId(),
            // Attach the current user's OjoType so the UI can render persona-specific gradient immediately
            ojoTypeName: (response as any).ojoTypeName || currentOjoType,
          };

          // If the last message is an error related to this clientId, replace it with the assistant message
          // instead of appending so that the error disappears and the reply appears in its place.
          let messageCountDeltaSuccess = 1;
          const last = updatedMessages[updatedMessages.length - 1];
          if (last?.isError && last.relatedClientId === clientId) {
            updatedMessages[updatedMessages.length - 1] = assistantMessage;
            messageCountDeltaSuccess = 0;
          } else {
            updatedMessages.push(assistantMessage);
          }

          const trimmed = updatedMessages.slice(-MAX_CACHED_MESSAGES_PER_SESSION);
          updateSession(buildSessionUpdate(sid, agentNow, getSessions, trimmed, messageCountDeltaSuccess));

          // Check if response indicates task-related action and notify.
          // Per-call onTaskChange overrides hook-level; fall back to hookOnTaskChange.
          const effectiveOnTaskChange = options?.onTaskChange || hookOnTaskChange;
          if (effectiveOnTaskChange && response.response) {
            const responseText = response.response.toLowerCase();
            const hasTaskAction = TASK_ACTION_KEYWORDS.some((keyword) => responseText.includes(keyword.toLowerCase()));
            if (hasTaskAction) {
              effectiveOnTaskChange();
            }
          }

          // Check if response indicates stats/gamification change and notify.
          // This triggers stats refresh when tasks are completed/uncompleted via chat.
          const effectiveOnStatsChange = options?.onStatsChange || hookOnStatsChange;
          if (effectiveOnStatsChange && response.response) {
            const responseText = response.response.toLowerCase();
            const hasStatsChange = STATS_CHANGE_KEYWORDS.some((keyword) => responseText.includes(keyword.toLowerCase()));
            if (hasStatsChange) {
              console.log("[useChatMessages] Stats change detected, calling onStatsChange");
              effectiveOnStatsChange();
            }
          }
        } else {
          const errNow = new Date();
          const sessionsAfter = getSessions();
          const existingAfter = sessionsAfter.find((s) => s.sessionId === currentSessionId);
          const baseAfter = existingAfter?.messages || optimisticMessages;
          let updatedMessages: ChatMessage[] = baseAfter.map(
            (m): ChatMessage => (m.clientId === clientId ? { ...m, status: "failed" } : m),
          );

          const last = updatedMessages[updatedMessages.length - 1];
          if (last?.isError) {
            // Update the last error in-place (keep its clientId) so we don't stack errors
            updatedMessages[updatedMessages.length - 1] = {
              ...last,
              content: response.error || "Server error",
              timestamp: errNow.toISOString(),
              isError: true,
              relatedClientId: clientId,
            };
          } else {
            updatedMessages.push({
              role: "assistant",
              content: response.error || "Server error",
              timestamp: errNow.toISOString(),
              isError: true,
              clientId: createClientId(),
              relatedClientId: clientId,
            });
          }

          const trimmed = updatedMessages.slice(-MAX_CACHED_MESSAGES_PER_SESSION);
          updateSession(buildSessionUpdate(currentSessionId, errNow, getSessions, trimmed, 1));
        }
      } catch (error) {
        const errNow = new Date();
        const sessionsAfter = getSessions();
        const existingAfter = sessionsAfter.find((s) => s.sessionId === currentSessionId);
        const baseAfter = existingAfter?.messages || optimisticMessages;
        let updatedMessages: ChatMessage[] = baseAfter.map(
          (m): ChatMessage => (m.clientId === clientId ? { ...m, status: "failed" } : m),
        );

        const last = updatedMessages[updatedMessages.length - 1];
        const errContent = (error as Error).name === "NetworkError" ? "Couldn't connect" : "Server error";
        if (last?.isError) {
          updatedMessages[updatedMessages.length - 1] = {
            ...last,
            content: errContent,
            timestamp: errNow.toISOString(),
            isError: true,
            relatedClientId: clientId,
          };
        } else {
          updatedMessages.push({
            role: "assistant",
            content: errContent,
            timestamp: errNow.toISOString(),
            isError: true,
            clientId: createClientId(),
            relatedClientId: clientId,
          });
        }
        const trimmed = updatedMessages.slice(-MAX_CACHED_MESSAGES_PER_SESSION);
        updateSession(buildSessionUpdate(currentSessionId, errNow, getSessions, trimmed, 1));
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, updateSession, createClientId, setSessionId],
  );

  const handleSend = useCallback(
    async (currentSessionId: string, getSessions: () => ChatSessionSummary[]) => {
      const trimmedText = message.trim();
      if (!trimmedText || isLoading) return;

      // Clear input immediately
      setMessage("");

      await sendMessage(currentSessionId, trimmedText, getSessions);
    },
    [message, isLoading, sendMessage],
  );

  const sendText = useCallback(
    async (currentSessionId: string, text: string, getSessions: () => ChatSessionSummary[]) => {
      const trimmedText = text.trim();
      if (!trimmedText || isLoading) return;
      await sendMessage(currentSessionId, trimmedText, getSessions);
    },
    [isLoading, sendMessage],
  );

  const handleRetry = useCallback(
    async (currentSessionId: string, clientId: string, getSessions: () => ChatSessionSummary[]) => {
      const sessionsNow = getSessions();
      const existing = sessionsNow.find((s) => s.sessionId === currentSessionId);
      const retryTarget = existing?.messages?.find((m) => m.clientId === clientId && m.role === "user");
      if (!retryTarget?.content) return;

      await sendMessage(currentSessionId, retryTarget.content, getSessions, { clientId, isRetry: true });
    },
    [sendMessage],
  );

  return {
    message,
    setMessage,
    isLoading,
    sessionId,
    setSessionId,
    handleSend,
    sendText,
    handleRetry,
  };
}
