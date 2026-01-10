import React, { useState } from "react";
import { View, Animated, Easing } from "react-native";
import AppText from "../../components/common/AppText";
import AppButton from "../../components/common/AppButton";
import TextBouble from "../../components/chat/TextBouble";
import Widget from "../../components/special/Widget";
import Input from "../../components/inputs/Input";
import AnimatedButtonsContainer from "../../components/common/AnimatedButtonsContainer";
import { SPACING } from "../../theme";

interface Props {
  displayName: string;
  setDisplayName: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
}



const NameStep: React.FC<Props> = ({ displayName, setDisplayName, onBack, onNext }) => {
  const [typingDone, setTypingDone] = useState(false);

  return (
    <View style={{ width: "100%" }}>
      <TextBouble mode="agent" playOnceKey="auth:name" onTypingDone={() => setTypingDone(true)}>
        <AppText variant="bodyText">{`Let's begin  \nFirst, what should I call you?`}</AppText>

        <Widget entranceEnabled={typingDone} entranceDelay={100} entranceDuration={200}>
          <Input label="Your name" placeholder="Your name" value={displayName} onChangeText={setDisplayName} />
        </Widget>

        <AnimatedButtonsContainer entranceEnabled={typingDone}>
          <AppButton title="Back" icon="left" iconPosition="left" mode="light" onPress={onBack} />
          <AppButton title="Next" icon="right" iconPosition="right" color="primary6" onPress={onNext} />
        </AnimatedButtonsContainer>
      </TextBouble>
    </View>
  );
};

export default NameStep;
