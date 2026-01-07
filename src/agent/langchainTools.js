import { missionRegistry } from "./missions/registry.js";

/**
 * ========================================
 * LANGCHAIN TOOLS - LLM Action Functions
 * ========================================
 *
 * Tools are generated from mission definitions so schemas, behavior hints,
 * and widget usage stay centralized and modular.
 */
export function createLangChainTools(userId) {
  return missionRegistry.buildTools({ userId });
}
