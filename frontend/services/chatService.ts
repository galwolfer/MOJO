// Chat API service for frontend
// Handles all chat-related API calls to the backend

import { get, post, setAuthToken } from "./httpClient";

export { DEFAULT_MACHINE_IP } from "./config";

/**
 * Set authentication token for chat requests
 * This is an alias for the shared setAuthToken function
 */
export function setChatAuthToken(token: string | null): void {
  setAuthToken(token);
}

// Types for chat API
export type SendMessageRequest = {
  message: string;
  sessionId?: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
};

export type SendMessageResponse = {
  success: boolean;
  response?: string;
  sessionId?: string;
  error?: string;
};

export type ChatHistoryResponse = {
  success: boolean;
  sessionId: string;
  messageCount: number;
  history: ChatMessage[];
};

export type ResetSessionResponse = {
  success: boolean;
  message?: string;
};

/**
 * Send a message to the chat agent
 * POST /api/chat/message
 */
export async function sendChatMessage(payload: SendMessageRequest): Promise<SendMessageResponse> {
  return post<SendMessageResponse>("/chat/message", payload);
}

/**
 * Get chat history for a session
 * GET /api/chat/history/:sessionId
 */
export async function getChatHistory(sessionId: string): Promise<ChatHistoryResponse> {
  return get<ChatHistoryResponse>(`/chat/history/${encodeURIComponent(sessionId)}`);
}

/**
 * Reset a chat session
 * POST /api/chat/reset
 */
export async function resetChatSession(sessionId: string): Promise<ResetSessionResponse> {
  return post<ResetSessionResponse>("/chat/reset", { sessionId });
}

/**
 * Check chat service health
 * GET /api/chat/health
 */
export async function checkChatHealth(): Promise<{ success: boolean; status: string; timestamp: string }> {
  return get("/chat/health");
}

export default {
  sendChatMessage,
  getChatHistory,
  resetChatSession,
  checkChatHealth,
  setChatAuthToken,
};
