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

    const onShow = (event: KeyboardEvent) => {
      setState({ visible: true, height: event.endCoordinates?.height ?? 0 });
    };

    const onHide = () => {
      setState({ visible: false, height: 0 });
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return state;
}
