/**
 * CategoryPrioritiesScreen
 *
 * A modular component for the auth flow that allows users to set priorities
 * for each category using a slider. Can be integrated into any multi-step form.
 *
 * This component displays a 3x6 grid of categories and allows users to click
 * on each one to adjust its priority score from 1-5.
 */
import React, { useState } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import AppText from "../../../components/common/AppText";
import AppButton from "../../../components/common/AppButton";
import Box from "../../../components/layout/Box";
import CategoryGrid from "./CategoryGrid";
import SliderComponent from "../../../components/inputs/Slider";
import { CATEGORY_KEYS, getCategoryMeta, CategoryKey } from "../../../config/categoryMeta";
import { COLORS, SPACING } from "../../../theme";
import { useColors } from "../../../context/ThemeContext";

type CategoryPrioritiesScreenProps = {
  onComplete: (priorities: Record<string, number>) => void;
  onBack?: () => void;
  initialPriorities?: Record<string, number>;
};

/**
 * CategoryPrioritiesScreen
 *
 * Displays all categories in a grid. When a category is clicked, shows a slider
 * to adjust its priority (1-5). The user can navigate back or proceed to the next step.
 */
const CategoryPrioritiesScreen: React.FC<CategoryPrioritiesScreenProps> = ({
  onComplete,
  onBack,
  initialPriorities = {},
}) => {
  const colors = useColors();
  // Initialize priorities with default value of 3 for all categories
  const [priorities, setPriorities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    CATEGORY_KEYS.forEach((key) => {
      initial[key] = initialPriorities[key] || 3;
    });
    return initial;
  });

  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | null>(null);

  const handleCategoryPress = (categoryKey: CategoryKey) => {
    setSelectedCategory(categoryKey);
  };

  const handlePriorityChange = (value: number) => {
    if (selectedCategory) {
      setPriorities((prev) => ({ ...prev, [selectedCategory]: value }));
    }
  };

  const handleNext = () => {
    onComplete(priorities);
  };

  const selectedMeta = selectedCategory ? getCategoryMeta(selectedCategory) : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg1 }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header message */}
        <View style={[styles.messageBox, { backgroundColor: colors.bg2 }]}>
          <AppText variant="bodyText" style={[styles.messageText, { color: colors.text1 }]}>
            Great! now after we are over that, lets talk about why are you here.... Your Goals. lets talk about what you
            want to achieve.
          </AppText>
        </View>

        {/* Category Grid */}
        <CategoryGrid onCategoryPress={handleCategoryPress} selectedCategory={selectedCategory} />

        {/* Slider Box - shows when a category is selected */}
        {selectedCategory && selectedMeta && (
          <Box title={selectedMeta.displayName?.toUpperCase()} titleColor={selectedMeta.color} style={styles.sliderBox}>
            <AppText variant="bodyText" style={[styles.sliderDescription, { color: colors.gray2 }]}>
              {`If you are looking for developing a new skill or wanting to improve your own skill`}
            </AppText>
            <SliderComponent
              value={priorities[selectedCategory]}
              onValueChange={handlePriorityChange}
              min={1}
              max={5}
              step={1}
            />
          </Box>
        )}

        {/* Navigation Buttons */}
        <View style={styles.buttonContainer}>
          {onBack && <AppButton title="Back" mode="light" onPress={onBack} style={styles.button} />}
          <AppButton title="Next >" onPress={handleNext} style={styles.button} color="primary6" />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  scrollContent: {
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },
  messageBox: {
    backgroundColor: COLORS.white2,
    borderRadius: SPACING.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  messageText: {
    textAlign: "center",
  },
  sliderBox: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
  sliderDescription: {
    color: COLORS.darkGray,
    marginBottom: SPACING.md,
    textAlign: "center",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: SPACING.xlg,
    gap: SPACING.md,
  },
  button: {
    flex: 1,
  },
});

export default CategoryPrioritiesScreen;
