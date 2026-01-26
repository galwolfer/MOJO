/**
 * EditPreferencesScreen
 *
 * Allows users to edit their Category Priorities.
 * Reuses the CategoryGrid component from the auth flow but with different descriptions
 * and Cancel/Save buttons instead of Next.
 */
import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import AppText from "../../components/common/AppText";
import AppButton from "../../components/common/AppButton";
import Box from "../../components/layout/Box";
import CategoryGrid from "../auth/components/CategoryGrid";
import { ICONS } from "../../components/icons/icons";
import { COLORS, SPACING, FONT_SIZES, SHADOWS } from "../../theme";
import { moderateScale } from "react-native-size-matters";
import { CATEGORY_KEYS, type CategoryKey } from "../../config/categoryMeta";
import { useNavigation } from "../../context/NavigationContext";
import { useLayout } from "../../context/LayoutContext";
import { useKeyboard } from "../../hooks";
import { getUserPreferences, updateCategoryPriorities } from "../../services/apiClient";
import { setAuthToken } from "../../services/httpClient";
import { useAuth } from "../../context/AuthContext";

type EditPreferencesScreenProps = {
  onBack: () => void;
  onSave?: () => void;
};

export default function EditPreferencesScreen({ onBack, onSave }: EditPreferencesScreenProps) {
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

  const LeftIcon = ICONS.left;

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

  // Setup header
  useEffect(() => {
    setHeaderConfig({
      title: "Edit Preferences",
      show: true,
      icon: ICONS.prefrences,
      leftElement: (
        <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
          <LeftIcon size={24} color={COLORS.primary1} />
        </TouchableOpacity>
      ),
      rightElement: (
        <View style={styles.headerRight}>
          <AppButton icon="prefrences" mode="light" color="primary1" disabled />
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary1} />
        <AppText variant="bodyText" style={styles.loadingText}>
          Loading preferences...
        </AppText>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.contentContainer,
        { paddingTop: (dimensions.headerHeight || SPACING.xlg * 3) + SPACING.md, paddingBottom: SPACING.xlg * 6 + keyboardPadding },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Title moved to topbar */}

      {error && (
        <AppText variant="notes" style={styles.errorText}>
          {error}
        </AppText>
      )}

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
            <TouchableOpacity style={[styles.navButton, styles.cancelButton]} onPress={handleCancel}>
              <AppText variant="boldText" style={styles.cancelButtonText}>Cancel</AppText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.saveButton, saving && styles.disabledButton]}
              onPress={handleSave}
              disabled={saving}
            >
              <AppText variant="boldText" style={styles.saveButtonText}>
                {saving ? "Saving..." : "Save"}
              </AppText>
            </TouchableOpacity>
          </View>
        </View>
      </Box>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: COLORS.white3,
  },
  contentContainer: {
    flexGrow: 1,
    padding: SPACING.xlg,
    paddingTop: SPACING.xlg * 3,
    alignItems: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.white3,
    gap: SPACING.md,
  },
  loadingText: {
    color: COLORS.grayLight,
  },
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
  errorText: {
    color: COLORS.primary5,
    textAlign: "center",
    marginBottom: SPACING.md,
  },
  // Buttons
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SPACING.md,
    marginTop: SPACING.lg,
    width: "100%",
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
  cancelButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.primary5,
  },
  cancelButtonText: {
    color: COLORS.primary5,
  },
  saveButton: {
    backgroundColor: COLORS.primary6,
  },
  saveButtonText: {
    color: COLORS.colorWhite,
  },
  disabledButton: {
    opacity: 0.5,
  },
});
