/**
 * useKeyboard
 *
 * Cross-platform helper hook that tracks keyboard visibility and height. Handles
 * platform differences (iOS will animate frame changes; Android uses didShow/didHide events).
 *
 * Usage:
 * const { visible, height } = useKeyboard();
 */
import { useEffect, useState } from "react";
import { Keyboard, KeyboardEvent, Platform } from "react-native";

type KeyboardState = {
  visible: boolean;
  height: number;
};
export default function useKeyboard(): KeyboardState {
  const [state, setState] = useState<KeyboardState>({ visible: false, height: 0 });

  useEffect(() => {
    if (Platform.OS === "web") return;

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const changeEvent = Platform.OS === "ios" ? "keyboardWillChangeFrame" : null;

    const onShow = (event: KeyboardEvent) => {
      const height = event.endCoordinates?.height ?? 0;
      setState({ visible: true, height });
    };

    const onHide = () => {
      setState({ visible: false, height: 0 });
    };

    const onChangeFrame = (event: KeyboardEvent) => {
      const height = event.endCoordinates?.height ?? 0;
      setState({ visible: height > 0, height });
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    const changeSub = changeEvent ? Keyboard.addListener(changeEvent, onChangeFrame) : null;

    return () => {
      showSub.remove();
      hideSub.remove();
      changeSub?.remove();
    };
  }, []);

  return state;
}
