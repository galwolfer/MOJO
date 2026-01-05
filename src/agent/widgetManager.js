/**
 * ========================================
 * WIDGET REGISTRY
 * ========================================
 *
 * Defines the available UI widgets that the agent can render.
 * Each widget has a schema and a prompt description.
 */

import { WIDGETS, getWidgetPromptInstructions } from "./agentConfig.js";

/**
 * Widget Manager - Thin compatibility layer that delegates to central config
 */
export class WidgetManager {
  /**
   * Get the prompt instructions for all registered widgets
   * @returns {string} Formatted instructions for the system prompt
   */
  static getPromptInstructions() {
    return getWidgetPromptInstructions();
  }
}

// Export WIDGETS for backwards compatibility
export { WIDGETS };
