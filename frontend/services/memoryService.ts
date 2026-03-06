/**
 * Memory service — manages the user's primary memories that the LLM uses for context.
 * Routes: GET|POST|PATCH|DELETE /api/auth/memories
 */
import { get, post, patch, del } from "./httpClient";

export type Memory = {
  id: string;
  text: string;
  type: string;
  importance: number;
  createdAt?: string;
};

type MemoriesResponse = {
  success: boolean;
  memories: Memory[];
};

type MemoryResponse = {
  success: boolean;
  memory: Memory;
};

/**
 * Fetch all of the logged-in user's primary memories.
 */
export async function getMemories(): Promise<Memory[]> {
  const data = await get<MemoriesResponse>("/auth/memories");
  return data.memories ?? [];
}

/**
 * Add a new primary memory.
 */
export async function addMemory(text: string, type = "user_fact"): Promise<Memory> {
  const data = await post<MemoryResponse>("/auth/memories", { text, type });
  return data.memory;
}

/**
 * Update the text of an existing memory.
 */
export async function updateMemory(memoryId: string, text: string): Promise<Memory> {
  const data = await patch<MemoryResponse>(`/auth/memories/${memoryId}`, { text });
  return data.memory;
}

/**
 * Delete a memory by id.
 */
export async function deleteMemory(memoryId: string): Promise<void> {
  await del<{ success: boolean }>(`/auth/memories/${memoryId}`);
}
