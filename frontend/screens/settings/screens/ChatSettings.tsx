/**
 * ChatSettingsScreen
 *
 * Allows users to change their OjoType (chat personality).
 * Accessed from Settings > Chat settings.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import AppText from "../../../components/common/AppText";
import AppButton from "../../../components/common/AppButton";
import Box from "../../../components/layout/Box";
import GridEntranceItem from "../../../components/common/animations/GridEntranceItem";
import { ICONS } from "../../../components/icons/icons";
import { COLORS, SPACING, FONT_SIZES, SHADOWS, ICON_SIZES } from "../../../theme";
import { useColors } from "../../../context/ThemeContext";
import { moderateScale } from "react-native-size-matters";
import { getAllOjoTypes, type OjoTypeName } from "../../../config/ojoTypeConfig";
import { useNavigation } from "../../../context/NavigationContext";
import { useLayout } from "../../../context/LayoutContext";
import { useKeyboard } from "../../../hooks";
import { getUserPreferences } from "../../../services/apiClient";
import { patch, setAuthToken } from "../../../services/httpClient";
import { useAuth } from "../../../context/AuthContext";
import { useOjo } from "../../../context/OjoContext";

type ChatSettingsScreenProps = {
  onBack: () => void;
  onSave?: () => void;
};

export default function ChatSettingsScreen({ onBack, onSave }: ChatSettingsScreenProps) {
  const colors = useColors();
  const { setHeaderConfig } = useNavigation();
  const { token } = useAuth();
  const { visible: keyboardVisible, height: keyboardHeight } = useKeyboard();
  const { dimensions } = useLayout();
  const { refresh: refreshOjo } = useOjo();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OjoType state
  const [selectedOjo, setSelectedOjo] = useState<OjoTypeName>("mentorjo");
  const [originalOjo, setOriginalOjo] = useState<OjoTypeName>("mentorjo");

  const allOjoTypes = getAllOjoTypes().slice(0, 4);
  const iconSize = moderateScale(64);
  const animatedSetRef = useRef<Set<string>>(new Set());

  // Store onBack in a ref to avoid recreating header config
  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  const LeftIcon = ICONS.left;
  const OjoIcon = ICONS.ojo;

  // Fetch current OjoType on mount
  useEffect(() => {
    async function fetchPreferences() {
      try {
        setLoading(true);
        setError(null);
        const prefs = await getUserPreferences();

        // Set OjoType
        if (prefs.ojoType?.name) {
          setSelectedOjo(prefs.ojoType.name as OjoTypeName);
          setOriginalOjo(prefs.ojoType.name as OjoTypeName);
        }
      } catch (err: any) {
        console.error("Failed to fetch preferences:", err);
        setError("Failed to load chat settings. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchPreferences();
  }, []);

  // Setup header - only set once on mount
  useEffect(() => {
    const handleBackPress = () => onBackRef.current();

    setHeaderConfig({
      title: "Chat Settings",
      show: true,
      icon: ICONS.ojo,
      leftElement: (
        <TouchableOpacity onPress={handleBackPress} >
          <LeftIcon size={ICON_SIZES.md} color={COLORS.primary1} />
        </TouchableOpacity>
      ),
      rightElement: (
        <View style={styles.headerLeft}>
          <OjoIcon size={ICON_SIZES.md} color={COLORS.primary1} />
        </View>
      ),
    });
  }, []);

  const handleCancel = () => {
    // Reset to original value
    setSelectedOjo(originalOjo);
    onBack();
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      if (token) {
        setAuthToken(token);
      }

      // Update OjoType if changed
      if (selectedOjo !== originalOjo) {
        await patch("/auth/profile", { ojoTypeName: selectedOjo });
        // Refresh the OjoContext to update gradient immediately
        if (refreshOjo) {
          await refreshOjo();
        }
      }

      // Update original value to reflect saved state
      setOriginalOjo(selectedOjo);

      onSave?.();
      onBack();
    } catch (err: any) {
      console.error("Failed to save OjoType:", err);
      setError(err?.message || "Failed to save chat settings");
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
          Loading chat settings...
        </AppText>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.bg3 }]}
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

      {error && (
        <AppText variant="notes" style={styles.errorText}>
          {error}
        </AppText>
      )}

      {/* OjoType Selection */}
      <Box title="Choose Your Ojo" titleColor={COLORS.primary1}>
        <View style={styles.stepContent}>
          <View style={styles.descriptionBlock}>
            <AppText variant="bodyText" style={styles.description}>
              Your Ojo guides you toward your goals with a unique personality.
            </AppText>
          </View>

          <AppText variant="boldText" style={styles.instruction}>
            Change how your Ojo communicates with you by selecting a different style below.
          </AppText>

          <View style={styles.gridContainer}>
            {allOjoTypes.map((ojo, index) => {
              const isSelected = selectedOjo === ojo.name;
              const IconComponent = ICONS[ojo.icon as keyof typeof ICONS];
              const rowIndex = Math.floor(index / 2);
              const colIndex = index % 2;

              return (
                <GridEntranceItem
                  key={ojo.name}
                  id={ojo.name}
                  rowIndex={rowIndex}
                  colIndex={colIndex}
                  enabled={true}
                  skipAnimation={true}
                  hideUntilEnabled={false}
                  animateHeight={false}
                  baseDelay={100}
                  stagger={50}
                  duration={200}
                  animatedSetRef={animatedSetRef}
                  style={styles.cardWrap}
                >
                  <TouchableOpacity
                    style={[
                      styles.card,
                      {
                        backgroundColor: colors.bg1,
                        borderColor: isSelected ? ojo.color : colors.bg1,
                        borderWidth: 3,
                        ...(SHADOWS.card as object),
                      },
                    ]}
                    onPress={() => setSelectedOjo(ojo.name as OjoTypeName)}
                    activeOpacity={0.9}
                  >
                    <View
                      style={[
                        styles.iconCircle,
                        {
                          backgroundColor: ojo.color,
                          width: iconSize,
                          height: iconSize,
                          borderRadius: iconSize / 2,
                        },
                      ]}
                    >
                      {typeof IconComponent === "function" && (
                        <IconComponent size={iconSize * 0.55} color={COLORS.white} />
                      )}
                    </View>

                    <AppText variant="title3" style={[styles.ojoName, { color: ojo.color }]}>
                      {ojo.displayName}
                    </AppText>
                    <AppText style={[styles.ojoRole, { color: colors.gray2 }]}>
                      {ojo.persona.split(" ").slice(0, 3).join(" ")}
                    </AppText>
                  </TouchableOpacity>
                </GridEntranceItem>
              );
            })}
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <AppButton title="Cancel" onPress={handleCancel} mode="light" color="lightGray" style={styles.button} />
            <AppButton
              title={saving ? "Saving..." : "Save"}
              onPress={handleSave}
              mode="filled"
              color="primary6"
              style={styles.button}
              disabled={saving}
            />
          </View>
        </View>
      </Box>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
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
    gap: SPACING.sm,
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

  errorText: {
    color: COLORS.primary5,
    textAlign: "center",
    marginBottom: SPACING.md,
  },
  // OjoType Grid
  gridContainer: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: SPACING.lg,
  },
  cardWrap: {
    flexBasis: "48%",
    maxWidth: "48%",
  },
  card: {
    borderRadius: moderateScale(16),
    padding: SPACING.sm,
    paddingTop: SPACING.xlg,
    alignItems: "center",
    justifyContent: "flex-start",
    gap: SPACING.sm,
    minHeight: moderateScale(180),
  },
  iconCircle: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.sm,
  },
  ojoName: {
    textAlign: "center",
  },
  ojoRole: {
    fontSize: FONT_SIZES.sm,
    textAlign: "center",
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
    borderWidth: 1,
    borderColor: COLORS.primary5,
  },
  cancelButtonText: {
    color: COLORS.primary5,
  },
  saveButton: {
    backgroundColor: COLORS.primary6,
  },
  saveButtonText: {},
  button: {
    width: "48%",
  },
  disabledButton: {
    opacity: 0.5,
  },
});
