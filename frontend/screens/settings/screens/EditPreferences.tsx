/**
 * EditPreferencesScreen
 *
 * Allows users to edit their Category Priorities.
 * Reuses the CategoryGrid component from the auth flow but with different descriptions
 * and Cancel/Save buttons instead of Next.
 */
import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import AppText from "../../../components/common/AppText";
import AppButton from "../../../components/common/AppButton";
import Box from "../../../components/layout/Box";
import CategoryGrid from "../../auth/components/CategoryGrid";
import { ICONS } from "../../../components/icons/icons";
import { COLORS, SPACING, FONT_SIZES, SHADOWS, ICON_SIZES } from "../../../theme";
import { useColors } from "../../../context/ThemeContext";
import { moderateScale } from "react-native-size-matters";
import { CATEGORY_KEYS, type CategoryKey } from "../../../config/categoryMeta";
import { useNavigation } from "../../../context/NavigationContext";
import { useLayout } from "../../../context/LayoutContext";
import { useKeyboard } from "../../../hooks";
import { getUserPreferences, updateCategoryPriorities } from "../../../services/apiClient";
import { setAuthToken } from "../../../services/httpClient";
import { useAuth } from "../../../context/AuthContext";
import { ScrollableContent } from "../../../components";
import ErrorText from "../../../components/common/ErrorText";

type EditPreferencesScreenProps = {
  onBack: () => void;
  onSave?: () => void;
};

export default function EditPreferencesScreen({ onBack, onSave }: EditPreferencesScreenProps) {
  const colors = useColors();
  const { setHeaderConfig } = useNavigation();
  const { token } = useAuth();
  const { visible: keyboardVisible, height: keyboardHeight } = useKeyboard();
  const { dimensions } = useLayout();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Priorities state
  const [priorities, setPriorities] = useState<Record<string, number>>({});
  const [originalPriorities, setOriginalPriorities] = useState<Record<string, number>>({});
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | null>(null);

  // Store onBack in a ref to avoid recreating header config
  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  const LeftIcon = ICONS.left;
  const PrefIcon = ICONS.prefrences;

  // Fetch current preferences on mount
  useEffect(() => {
    async function fetchPreferences() {
      try {
        setLoading(true);
        setError(null);
        const prefs = await getUserPreferences();

        // Set Priorities
        if (prefs.priorities) {
          setPriorities(prefs.priorities);
          setOriginalPriorities(prefs.priorities);
        } else {
          // Initialize with defaults
          const initial: Record<string, number> = {};
          CATEGORY_KEYS.forEach((key) => (initial[key] = 3));
          setPriorities(initial);
          setOriginalPriorities(initial);
        }
      } catch (err: any) {
        console.error("Failed to fetch preferences:", err);
        setError("Failed to load preferences. Please try again.");
        // Initialize with defaults on error
        const initial: Record<string, number> = {};
        CATEGORY_KEYS.forEach((key) => (initial[key] = 3));
        setPriorities(initial);
      } finally {
        setLoading(false);
      }
    }

    fetchPreferences();
  }, []);

  // Setup header (single-line): Pref icon at left, right-arrow at right - only set once on mount
  useEffect(() => {
    const handleBackPress = () => onBackRef.current();

    setHeaderConfig({
      title: "Edit Preferences",
      show: true,
      icon: ICONS.prefrences,
      leftElement: (
        <TouchableOpacity onPress={handleBackPress} style={styles.headerRightTouchable}>
          <LeftIcon size={ICON_SIZES.sm} color={COLORS.primary1} />
        </TouchableOpacity>
      ),
      rightElement: (
        <View style={styles.headerLeft}>
          <PrefIcon size={ICON_SIZES.sm} color={COLORS.primary1} />
        </View>
      ),
    });
  }, []);

  const handleCancel = () => {
    // Reset to original values
    setPriorities(originalPriorities);
    onBack();
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      if (token) {
        setAuthToken(token);
      }

      // Update priorities if changed
      const prioritiesChanged = JSON.stringify(priorities) !== JSON.stringify(originalPriorities);
      if (prioritiesChanged) {
        await updateCategoryPriorities({ priorities });
      }

      // Update original values to reflect saved state
      setOriginalPriorities({ ...priorities });

      onSave?.();
      onBack();
    } catch (err: any) {
      console.error("Failed to save preferences:", err);
      setError(err?.message || "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  const keyboardPadding = keyboardVisible ? keyboardHeight : 0;

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.bg3 }]}>
        <ActivityIndicator size="large" color={COLORS.primary1} />
        <AppText variant="bodyText" style={[styles.loadingText, { color: colors.gray1 }]}>
          Loading preferences...
        </AppText>
      </View>
    );
  }

  return (
    <ScrollableContent
      style={[styles.scroll, { backgroundColor: colors.bg3 }]}
      extraTopPadding={SPACING.lg}
      contentContainerStyle={[
        styles.contentContainer,
        {
          paddingTop: (dimensions.headerHeight || SPACING.xlg * 3) + SPACING.md,
          paddingBottom: SPACING.xlg * 6 + keyboardPadding,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Title moved to topbar */}

      {error && <ErrorText>{error}</ErrorText>}

      {/* Priorities */}
      <Box title="Your Goals & Priorities" titleColor={COLORS.primary1}>
        <View style={styles.stepContent}>
          <View style={styles.descriptionBlock}>
            <AppText variant="bodyText" style={styles.description}>
              Update how important each area of your life is to you right now.
            </AppText>
            <AppText variant="bodyText" style={[styles.description, styles.descriptionSecondary]}>
              This helps Mojo prioritize and suggest tasks that align with your current goals.
            </AppText>
          </View>

          <AppText variant="boldText" style={styles.instruction}>
            Tap a category to adjust its priority.
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
              entranceEnabled={true}
            />
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <AppButton
              title={saving ? "Saving..." : "Save"}
              onPress={handleSave}
              mode="filled"
              color="primary6"
              disabled={saving}
              style={styles.button}
            />
            <AppButton title="Cancel" onPress={handleCancel} mode="light" color="lightGray" style={styles.button} />
          </View>
        </View>
      </Box>
    </ScrollableContent>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    alignItems: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: SPACING.md,
  },
  loadingText: {},
  titleSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  title: {
    color: COLORS.primary1,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  stepContent: {
    width: "100%",
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  descriptionBlock: {
    width: "100%",
    alignItems: "center",
    gap: SPACING.sm, // Replaced xs with sm
    marginBottom: SPACING.md,
  },
  description: {
    marginBottom: 0,
    width: "100%",
    fontSize: FONT_SIZES.sm,
    lineHeight: FONT_SIZES.base * 1.1,
    textAlign: "left",
    alignSelf: "center",
    letterSpacing: 0.1,
  },
  descriptionSecondary: {
    marginBottom: 0,
  },
  instruction: {
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    width: "100%",
    fontSize: FONT_SIZES.sm,
    lineHeight: FONT_SIZES.base,
    textAlign: "left",
    alignSelf: "center",
    letterSpacing: 0.08,
  },
  headerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerRight: {
    width: moderateScale(44),
    height: moderateScale(44),
    alignItems: "center",
    justifyContent: "center",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerRightTouchable: {
    width: moderateScale(44),
    height: moderateScale(44),
    alignItems: "center",
    justifyContent: "center",
  },

  // Buttons
  buttonRow: {
    flexDirection: "row",
    width: "100%",
    gap: SPACING.md,
  },
  navButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: SPACING.xlg,
    gap: SPACING.sm,
  },
  button: {
    width: "48%",
  },
});
