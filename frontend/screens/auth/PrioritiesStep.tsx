import React from "react";
import { View } from "react-native";
import AppText from "../../components/common/AppText";
import AppButton from "../../components/common/AppButton";
import TextBouble from "../../components/chat/TextBouble";
import CategoryGrid from "../../components/categories/CategoryGrid";
import { CATEGORY_KEYS } from "../../config/categoryMeta";
import { SPACING } from "../../theme";

import type { CategoryKey } from "../../config/categoryMeta";

interface Props {
  priorities: Record<string, number>;
  setPriorities: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  selectedCategory: CategoryKey | null;
  setSelectedCategory: (k: CategoryKey | null) => void;
  onBack: () => void;
  onFinish: (payload: Record<string, number>) => void;
  // Entrance animation overrides
  entranceEnabled?: boolean;
  entranceBaseDelay?: number;
  entranceStagger?: number;
  entranceDuration?: number;
}

const PrioritiesStep: React.FC<Props> = ({
  priorities,
  setPriorities,
  selectedCategory,
  setSelectedCategory,
  onBack,
  onFinish,
  entranceEnabled = false,
  entranceBaseDelay,
  entranceStagger,
  entranceDuration,
}) => {
  return (
    <TextBouble mode="agent" playOnceKey="auth:priorities">
      <AppText variant="bodyText" style={{ marginBottom: SPACING.md }}>
        {`Great! now after we are over that, lets talk about why are you here.... Your Goals. lets talk about what you want to achieve.`}
      </AppText>

      <View style={{ width: "100%" }}>
        <CategoryGrid
          onCategoryPress={(k) => {
            setSelectedCategory(k);
            // ensure default exists
            setPriorities((prev) => {
              if (prev && Object.keys(prev).length) return prev;
              const initial: Record<string, number> = {} as any;
              CATEGORY_KEYS.forEach((key) => (initial[key] = 3));
              return initial;
            });
          }}
          selectedCategory={selectedCategory as any}
          priorities={priorities}
          onPriorityChange={(k, v) => setPriorities((p) => ({ ...p, [k]: v }))}
          entranceEnabled={entranceEnabled}
          entranceBaseDelay={entranceBaseDelay}
          entranceStagger={entranceStagger}
          entranceDuration={entranceDuration}
        />
      </View>

      <View style={{ display: "flex", flexDirection: "row", justifyContent: "center", alignItems: "center", gap: SPACING.md, paddingTop: SPACING.xlg, width: "100%" }}>
        <AppButton
          title="Next"
          icon="right"
          iconPosition="right"
          onPress={() => {
            const payload = Object.keys(priorities).length
              ? priorities
              : (() => {
                  const initial: Record<string, number> = {} as any;
                  CATEGORY_KEYS.forEach((key) => (initial[key] = 3));
                  return initial;
                })();
            setPriorities(payload);
            onFinish(payload);
          }}
          color="primary6"
        />
      </View>
    </TextBouble>
  );
};

export default PrioritiesStep;
