import { useEffect, useRef } from "react";
import { useNavigation } from "../context/NavigationContext";

/**
 * useBackHandler
 *
 * Registers a back-navigation handler with the NavigationContext back stack.
 * Handlers are LIFO: the most recently registered one fires first, so inner
 * modals, popups, and sub-screens automatically take priority over outer screens.
 *
 * @param handler - Return `true` if the action was consumed, `false` to pass through.
 * @param active  - When `false` the handler is not registered (defaults to `true`).
 *
 * @example
 * // Close a modal on back
 * useBackHandler(() => { onClose(); return true; }, isVisible);
 *
 * // Sub-screen back navigation
 * useBackHandler(() => { onBack(); return true; });
 */
export function useBackHandler(handler: () => boolean, active = true) {
  const { registerBackHandler } = useNavigation();

  // Always call the latest handler without re-registering on every render
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!active) return;
    const stable = () => handlerRef.current();
    return registerBackHandler(stable);
  }, [active, registerBackHandler]);
}
