/**
 * PrioritiesStep
 *
 * Asks the user to set priorities for their top goals via `CategoryGrid` and
 * an inline priority slider. The selected values are passed back to the
 * parent `Auth` screen via `onFinish`.
 */ import React from "react";
import { View } from "react-native";
import AppText from "../../../components/common/AppText";
import AuthStep from "./AuthStep";
import AuthButtonsGroup from "./AuthButtonsGroup";
import CategoryGrid from "./CategoryGrid";
import { CATEGORY_KEYS } from "../../../config/categoryMeta";
import { SPACING } from "../../../theme";

import type { CategoryKey } from "../../../config/categoryMeta";

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
    <AuthStep playOnceKey="auth:priorities">
      {(typingDone: boolean) => (
        <>
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
              entranceEnabled={entranceEnabled || typingDone}
              entranceBaseDelay={entranceBaseDelay}
              entranceStagger={entranceStagger}
              entranceDuration={entranceDuration}
            />
          </View>

          <AuthButtonsGroup
            entranceEnabled={true}
            right={{
              title: "Next",
              onPress: () => {
                const payload = Object.keys(priorities).length
                  ? priorities
                  : (() => {
                      const initial: Record<string, number> = {} as any;
                      CATEGORY_KEYS.forEach((key) => (initial[key] = 3));
                      return initial;
                    })();
                setPriorities(payload);
                onFinish(payload);
              },
              icon: "right",
              iconPosition: "right",
              color: "primary6",
            }}
          />
        </>
      )}
    </AuthStep>
  );
};

export default PrioritiesStep;
