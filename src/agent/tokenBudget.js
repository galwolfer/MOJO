/**
 * ========================================
 * TOKEN BUDGET & CONSTANTS
 * ========================================
 *
 * Defines constraints for token usage to ensure measurable performance.
 */

export const TOKEN_BUDGET = {
  MAX_SYSTEM_TOKENS_FIRST_TURN: 1000,
  MAX_SYSTEM_TOKENS_NORMAL_TURN: 200,
  MAX_MEMORY_TOKENS: 500,
  MAX_HISTORY_TOKENS: 2000,
  SUMMARY_UPDATE_EVERY_K_TURNS: 5,
};

export const LOGGING_FIELDS = [
  "tokens_in_system",
  "tokens_in_memory",
  "tokens_in_history",
  "tokens_in_tools",
  "tokens_in_user",
  "tokens_out_assistant",
  "total_tokens_per_request",
];
