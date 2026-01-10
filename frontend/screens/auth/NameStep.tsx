import React from "react";
import { View } from "react-native";
import AppText from "../../components/common/AppText";
import AppButton from "../../components/common/AppButton";
import TextBouble from "../../components/chat/TextBouble";
import Input from "../../components/inputs/Input";
import { SPACING } from "../../theme";

interface Props {
  displayName: string;
  setDisplayName: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
}

const NameStep: React.FC<Props> = ({ displayName, setDisplayName, onBack, onNext }) => {
  return (
    <TextBouble mode="agent" playOnceKey="auth:name">
      <AppText variant="bodyText">{"Let’s begin 😊 \nFirst, what should I call you?"}</AppText>
      <View style={{ width: "100%" }}>
        <Input label="Your name" placeholder="Your name" value={displayName} onChangeText={setDisplayName} />
      </View>
      <View style={{ display: "flex", flexDirection: "row", justifyContent: "center", alignItems: "center", gap: SPACING.md, paddingTop: SPACING.lg, width: "100%" }}>
        <AppButton title="Back" icon="left" iconPosition="left" mode="light" onPress={onBack} />
        <AppButton title="Next" icon="right" iconPosition="right" color="primary6" onPress={onNext} />
      </View>
    </TextBouble>
  );
};

export default NameStep;
