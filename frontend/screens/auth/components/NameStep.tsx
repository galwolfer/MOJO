/**
 * NameStep
 *
 * Simple single-field step used to ask the user's display name before signup.
 * Uses `AuthStep` to receive typing/entrance state and `Widget` to reveal the
 * input when the assistant text finishes typing.
 *
 * Props: `displayName`, `setDisplayName`, `onBack`, `onNext`
 */
import React from "react";
import { View } from "react-native";
import AppText from "../../../components/common/AppText";
import AuthStep from "./AuthStep";
import AuthButtonsGroup from "./AuthButtonsGroup";
import Widget from "../../../components/special/Widget";
import Input from "../../../components/inputs/Input";
import { SPACING } from "../../../theme";

interface Props {
  displayName: string;
  setDisplayName: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
}

const NameStep: React.FC<Props> = ({ displayName, setDisplayName, onBack, onNext }) => {
  return (
    <View style={{ width: "100%" }}>
      <AuthStep playOnceKey="auth:name">
        {(typingDone: boolean) => (
          <>
            <AppText variant="bodyText">{`Let's begin  \nFirst, what should I call you?`}</AppText>

            <Widget entranceEnabled={typingDone} entranceDelay={100} entranceDuration={200}>
              <Input label="Your name" placeholder="Your name" value={displayName} onChangeText={setDisplayName} />
            </Widget>

            <AuthButtonsGroup
              entranceEnabled={typingDone}
              left={{ title: "Back", onPress: onBack, icon: "left", iconPosition: "left", mode: "light" }}
              right={{ title: "Next", onPress: onNext, icon: "right", iconPosition: "right", color: "primary6" }}
            />
          </>
        )}
      </AuthStep>
    </View>
  );
};

export default NameStep;
