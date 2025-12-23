import { useState, useCallback } from "react";
import { sendChatMessage, SendMessageResponse, ChatSessionSummary } from "../services/chatService";

const MAX_CACHED_MESSAGES_PER_SESSION = 50;

export function useChatMessages(updateSession: (session: ChatSessionSummary) => void) {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>(() => `session_${Date.now()}`);

  const handleSend = useCallback(
    async (currentSessionId: string, existingSessions: ChatSessionSummary[]) => {
      const trimmedText = message.trim();
      if (!trimmedText || isLoading) return;

      // Clear input immediately
      setMessage("");

      const now = new Date();
      const existing = existingSessions.find((s) => s.sessionId === currentSessionId);
      const priorCount =
        typeof existing?.messageCount === "number" ? existing.messageCount : existing?.messages?.length || 0;
      const messages = [
        ...(existing?.messages || []),
        { role: "user" as const, content: trimmedText, timestamp: now.toISOString() },
      ].slice(-MAX_CACHED_MESSAGES_PER_SESSION);
      const updated: ChatSessionSummary = {
        sessionId: currentSessionId,
        lastActiveAt: now.toISOString(),
        createdAt: existing?.createdAt,
        messageCount: priorCount + 1,
        messages,
      };
      updateSession(updated);

      // Show loading state
      setIsLoading(true);

      try {
        const response: SendMessageResponse = await sendChatMessage({
          message: trimmedText,
          sessionId: currentSessionId,
        });

        if (response.success && response.response) {
          // Update sessionId if returned
          if (response.sessionId) {
            setSessionId(response.sessionId);
          }

          const sid = response.sessionId || currentSessionId;
          const agentNow = new Date();
          const existingAgent = existingSessions.find((s) => s.sessionId === sid);
          const priorCountAgent =
            typeof existingAgent?.messageCount === "number"
              ? existingAgent.messageCount
              : existingAgent?.messages?.length || 0;
          const messagesAgent = [...(existingAgent?.messages || [])];
          messagesAgent.push({
            role: "assistant" as const,
            content: response.response!,
            timestamp: agentNow.toISOString(),
          });
          const trimmedAgent = messagesAgent.slice(-MAX_CACHED_MESSAGES_PER_SESSION);
          const updatedAgent: ChatSessionSummary = {
            sessionId: sid,
            lastActiveAt: agentNow.toISOString(),
            createdAt: existingAgent?.createdAt,
            messageCount: priorCountAgent + 1,
            messages: trimmedAgent,
          };
          updateSession(updatedAgent);
        } else {
          // Handle error response
          const errNow = new Date();
          const existingError = existingSessions.find((s) => s.sessionId === currentSessionId);
          const priorCountError =
            typeof existingError?.messageCount === "number"
              ? existingError.messageCount
              : existingError?.messages?.length || 0;
          const messagesError = [...(existingError?.messages || [])];
          messagesError.push({
            role: "assistant" as const,
            content: response.error || "Sorry, something went wrong. Please try again.",
            timestamp: errNow.toISOString(),
          });
          const trimmedError = messagesError.slice(-MAX_CACHED_MESSAGES_PER_SESSION);
          const updatedError: ChatSessionSummary = {
            sessionId: currentSessionId,
            lastActiveAt: errNow.toISOString(),
            createdAt: existingError?.createdAt,
            messageCount: priorCountError + 1,
            messages: trimmedError,
          };
          updateSession(updatedError);
        }
      } catch (error) {
        // Handle network/API error
        const errNow = new Date();
        const existingNetError = existingSessions.find((s) => s.sessionId === currentSessionId);
        const priorCountNetError =
          typeof existingNetError?.messageCount === "number"
            ? existingNetError.messageCount
            : existingNetError?.messages?.length || 0;
        const messagesNetError = [...(existingNetError?.messages || [])];
        messagesNetError.push({
          role: "assistant" as const,
          content: "Unable to connect. Please check your connection and try again.",
          timestamp: errNow.toISOString(),
        });
        const trimmedNetError = messagesNetError.slice(-MAX_CACHED_MESSAGES_PER_SESSION);
        const updatedNetError: ChatSessionSummary = {
          sessionId: currentSessionId,
          lastActiveAt: errNow.toISOString(),
          createdAt: existingNetError?.createdAt,
          messageCount: priorCountNetError + 1,
          messages: trimmedNetError,
        };
        updateSession(updatedNetError);
      } finally {
        setIsLoading(false);
      }
    },
    [message, isLoading, updateSession]
  );

  return {
    message,
    setMessage,
    isLoading,
    sessionId,
    setSessionId,
    handleSend,
  };
}
