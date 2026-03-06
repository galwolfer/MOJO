import React, { useState, useEffect } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { COLORS, SPACING, FONT_SIZES } from "../../../theme";
import { useColors } from "../../../context/ThemeContext";
import { useAuth } from "../../../context/AuthContext";
import AppText from "../../../components/common/AppText";
import AppButton from "../../../components/common/AppButton";
import Box from "../../../components/layout/Box";
import ErrorText from "../../../components/common/ErrorText";
import PopupBox from "../../../components/common/PopupBox";
import CategoryGrid from "../../auth/components/CategoryGrid";
import { CATEGORY_KEYS, type CategoryKey } from "../../../config/categoryMeta";
import { getUserPreferences, updateCategoryPriorities } from "../../../services/apiClient";
import { setAuthToken } from "../../../services/httpClient";
import SettingsSubScreen from "./components/SettingsSubScreen";

type GoalsPrioritiesSettingsScreenProps = { onBack: () => void };

export default function GoalsPrioritiesSettingsScreen({ onBack }: GoalsPrioritiesSettingsScreenProps) {
  const colors = useColors();
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  const [priorities, setPriorities] = useState<Record<string, number>>({});
  const [originalPriorities, setOriginalPriorities] = useState<Record<string, number>>({});
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const prefs = await getUserPreferences();
        if (prefs.priorities) {
          setPriorities(prefs.priorities);
          setOriginalPriorities(prefs.priorities);
        } else {
          const initial: Record<string, number> = {};
          CATEGORY_KEYS.forEach((k) => (initial[k] = 3));
          setPriorities(initial);
          setOriginalPriorities(initial);
        }
      } catch {
        setError("Failed to load preferences. Please try again.");
        const initial: Record<string, number> = {};
        CATEGORY_KEYS.forEach((k) => (initial[k] = 3));
        setPriorities(initial);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleCancel = () => {
    setPriorities(originalPriorities);
    onBack();
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      if (token) setAuthToken(token);
      const changed = JSON.stringify(priorities) !== JSON.stringify(originalPriorities);
      if (changed) await updateCategoryPriorities({ priorities });
      setOriginalPriorities({ ...priorities });
      setShowSaveSuccess(true);
    } catch (err: any) {
      setError(err?.message || "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsSubScreen
      title="Priorities"
      iconName="goals"
      scrollKey="priorities-settings"
      onBack={onBack}
      extraBottomPadding={SPACING.xlg * 6}
    >
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={COLORS.primary1} />
        </View>
      ) : (
        <>
          {error && <ErrorText>{error}</ErrorText>}

          <Box>
            <View style={styles.boxContent}>
              <AppText variant="bodyText" style={styles.description}>
                Update how important each area of your life is to you right now. This helps Mojo prioritize and suggest
                tasks that align with your current goals.
              </AppText>

              <AppText variant="boldText" style={styles.instruction}>
                Tap a category to adjust its priority.
              </AppText>

              <View style={{ width: "100%" }}>
                <CategoryGrid
                  onCategoryPress={(k) => {
                    setSelectedCategory(k);
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

              <View style={styles.buttonRow}>
                <AppButton
                  title={saving ? "Saving" : "Save"}
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
        </>
      )}

      <PopupBox
        visible={showSaveSuccess}
        onClose={() => {
          setShowSaveSuccess(false);
          onBack();
        }}
        title="Priorities Saved"
        titleColor={COLORS.primary1}
      >
        <AppText variant="bodyText" style={styles.popupText}>
          Your goals and priorities have been updated successfully.
        </AppText>
        <AppButton
          title="Done"
          onPress={() => {
            setShowSaveSuccess(false);
            onBack();
          }}
          mode="filled"
          color="primary1"
          style={styles.popupButton}
        />
      </PopupBox>
    </SettingsSubScreen>
  );
}

const styles = StyleSheet.create({
  loading: { padding: SPACING.xlg, alignItems: "center" },
  boxContent: { width: "100%", paddingVertical: SPACING.md, paddingHorizontal: SPACING.sm, gap: SPACING.md },
  description: { fontSize: FONT_SIZES.sm, lineHeight: FONT_SIZES.base * 1.3 },
  instruction: { fontSize: FONT_SIZES.sm, lineHeight: FONT_SIZES.base },
  buttonRow: { flexDirection: "row", width: "100%", gap: SPACING.md, marginTop: SPACING.sm },
  button: { width: "48%" },
  popupText: {
    color: COLORS.lightGray,
    fontSize: FONT_SIZES.sm,
    textAlign: "center",
    marginBottom: SPACING.lg,
    lineHeight: FONT_SIZES.base * 1.4,
  },
  popupButton: { width: "100%", marginTop: SPACING.sm },
});
