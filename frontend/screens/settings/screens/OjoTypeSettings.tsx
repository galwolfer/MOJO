/**
 * OjoTypeSettingsScreen
 *
 * Allows users to select their OjoType (chat personality).
 * Accessed from Chat Settings.
 */
import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { COLORS, SPACING, FONT_SIZES, SHADOWS, ICON_SIZES } from "../../../theme";
import { ICONS } from "../../../components/icons/icons";
import { moderateScale } from "react-native-size-matters";
import SettingsSubScreen from "./components/SettingsSubScreen";
import AppText from "../../../components/common/AppText";
import AppButton from "../../../components/common/AppButton";
import Box from "../../../components/layout/Box";
import GridEntranceItem from "../../../components/common/animations/GridEntranceItem";
import ErrorText from "../../../components/common/ErrorText";
import { getAllOjoTypes, getOjoType, type OjoTypeName } from "../../../config/ojoTypeConfig";
import { useOjo } from "../../../context/OjoContext";
import { useAuth } from "../../../context/AuthContext";
import { getUserPreferences } from "../../../services/apiClient";
import { patch, setAuthToken } from "../../../services/httpClient";

type OjoTypeSettingsScreenProps = {
  onBack: () => void;
};

export default function OjoTypeSettingsScreen({ onBack }: OjoTypeSettingsScreenProps) {
  const { token } = useAuth();
  const { ojoName, refresh: refreshOjo } = useOjo();

  const [selectedOjo, setSelectedOjo] = useState<OjoTypeName>((ojoName as OjoTypeName) ?? "mentorjo");
  const [originalOjo, setOriginalOjo] = useState<OjoTypeName>((ojoName as OjoTypeName) ?? "mentorjo");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allOjoTypes = getAllOjoTypes().slice(0, 4);
  const iconSize = moderateScale(64);
  const animatedSetRef = useRef<Set<string>>(new Set());

  // Derive icon + color from currently selected ojo for the header
  const currentOjoCfg = getOjoType(selectedOjo);
  const CurrentOjoIcon = ICONS[currentOjoCfg.icon as keyof typeof ICONS] ?? ICONS.ojo;

  // Fetch current preference on mount
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const prefs = await getUserPreferences();
        if (prefs.ojoType?.name) {
          const name = prefs.ojoType.name as OjoTypeName;
          setSelectedOjo(name);
          setOriginalOjo(name);
        }
      } catch (err: any) {
        setError("Failed to load OjoType settings.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleCancel = () => {
    setSelectedOjo(originalOjo);
    onBack();
  };

  const handleSave = async () => {
    if (selectedOjo === originalOjo) {
      onBack();
      return;
    }
    try {
      setSaving(true);
      setError(null);
      if (token) setAuthToken(token);
      await patch("/auth/profile", { ojoTypeName: selectedOjo });
      if (refreshOjo) await refreshOjo();
      setOriginalOjo(selectedOjo);
      onBack();
    } catch (err: any) {
      setError(err?.message || "Failed to save OjoType.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsSubScreen
      title="OjoType"
      iconName={currentOjoCfg.icon as keyof typeof ICONS}
      iconDeps={[selectedOjo]}
      scrollKey="ojotype-settings"
      onBack={onBack}
    >
      {error && <ErrorText>{error}</ErrorText>}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary1} />
        </View>
      ) : (
        <Box>
          <View style={styles.boxContent}>
            <AppText variant="bodyText" style={styles.description}>
              Your Ojo guides you toward your goals with a unique personality. Select a style below.
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
                          borderColor: isSelected ? ojo.color : "transparent",
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
                      <AppText variant="notes" style={styles.ojoRole}>
                        {ojo.persona.split(" ").slice(0, 4).join(" ")}
                      </AppText>
                    </TouchableOpacity>
                  </GridEntranceItem>
                );
              })}
            </View>

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
      )}
    </SettingsSubScreen>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    padding: SPACING.xlg,
    alignItems: "center",
  },
  boxContent: {
    width: "100%",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    gap: SPACING.md,
  },
  description: {
    fontSize: FONT_SIZES.sm,
    lineHeight: FONT_SIZES.base * 1.3,
  },
  gridContainer: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: SPACING.lg,
    marginTop: SPACING.sm,
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
    textAlign: "center",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  button: {
    flex: 1,
  },
});
