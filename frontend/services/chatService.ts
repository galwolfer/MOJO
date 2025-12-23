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
  role: "user" | "assistant" | "system" | "function";
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

export type ChatHistoryPageResponse = ChatHistoryResponse & {
  offset: number;
  limit: number;
  hasMore: boolean;
  nextOffset?: number | null;
  lastActiveAt?: string;
  createdAt?: string;
};

export type ChatSessionSummary = {
  sessionId: string;
  lastActiveAt: string;
  createdAt?: string;
  messageCount?: number;
  messages?: ChatMessage[];
};

export type ListChatSessionsResponse = {
  success: boolean;
  sessions: ChatSessionSummary[];
  hasMore: boolean;
  nextCursor?: string;
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
 * Get paged chat history from the END of the session
 * GET /api/chat/history/:sessionId?limit=10&offset=0
 */
export async function getChatHistoryPage(
  sessionId: string,
  params: { limit?: number; offset?: number } = {}
): Promise<ChatHistoryPageResponse> {
  const limit = typeof params.limit === "number" ? params.limit : 10;
  const offset = typeof params.offset === "number" ? params.offset : 0;
  return get<ChatHistoryPageResponse>(
    `/chat/history/${encodeURIComponent(sessionId)}?limit=${encodeURIComponent(
      String(limit)
    )}&offset=${encodeURIComponent(String(offset))}`
  );
}

/**
 * List sessions for the current user (cursor pagination)
 * GET /api/chat/sessions?limit=10&cursor=ISO_DATE&includeMessages=10
 */
export async function listChatSessions(
  params: {
    limit?: number;
    cursor?: string;
    includeMessages?: number;
  } = {}
): Promise<ListChatSessionsResponse> {
  const limit = typeof params.limit === "number" ? params.limit : 10;
  const includeMessages = typeof params.includeMessages === "number" ? params.includeMessages : 10;
  const cursor = params.cursor ? `&cursor=${encodeURIComponent(params.cursor)}` : "";
  return get<ListChatSessionsResponse>(
    `/chat/sessions?limit=${encodeURIComponent(String(limit))}&includeMessages=${encodeURIComponent(
      String(includeMessages)
    )}${cursor}`
  );
}

/**
 * Quick get sessions from User.sessions (lightweight summary)
 * GET /api/chat/user-sessions
 */
export async function getChatUserSessions(params: { includeMessages?: number } = {}): Promise<ChatSessionSummary[]> {
  const includeMessages = typeof params.includeMessages === "number" ? params.includeMessages : 10;
  const query = `?includeMessages=${encodeURIComponent(String(includeMessages))}`;
  const response = await get<{ success: boolean; sessions: ChatSessionSummary[] }>(`/chat/user-sessions${query}`);
  return response.sessions || [];
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
  getChatHistoryPage,
  listChatSessions,
  getChatUserSessions,
  resetChatSession,
  checkChatHealth,
  setChatAuthToken,
};
