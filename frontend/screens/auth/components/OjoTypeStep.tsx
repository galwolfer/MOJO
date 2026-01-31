/**
 * OjoTypeStep
 *
 * Onboarding step for selecting an OjoType personality.
 * Displays a 2x2 grid of OjoType options styled to match the design photo.
 * Updates the server with the selected OjoType on Next.
 */
import React, { useRef, useState } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import AppText from "../../../components/common/AppText";
import AuthStep from "./AuthStep";
import AuthButtonsGroup from "./AuthButtonsGroup";
import GridEntranceItem from "../../../components/common/animations/GridEntranceItem";
import { COLORS, SPACING, FONT_SIZES, SHADOWS } from "../../../theme";
import { moderateScale } from "react-native-size-matters";
import { ICONS } from "../../../components/icons/icons";
import { getAllOjoTypes, type OjoTypeName } from "../../../config/ojoTypeConfig";
import { setAuthToken, patch } from "../../../services/httpClient";
import { useOjo } from "../../../context/OjoContext";

interface Props {
  pendingToken?: string | null;
  onBack: () => void;
  onNext: () => void;
}

const OjoTypeStep: React.FC<Props> = ({ pendingToken, onNext }) => {
  const [selectedOjo, setSelectedOjo] = useState<OjoTypeName>("mentorjo");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refresh } = useOjo();
  const allOjoTypes = getAllOjoTypes().slice(0, 4);
  const iconSize = moderateScale(64);
  const animatedSetRef = useRef<Set<string>>(new Set());

  const handleNext = async () => {
    try {
      setLoading(true);
      setError(null);

      // Update the server with the selected OjoType
      if (pendingToken) {
        setAuthToken(pendingToken);
      }

      await patch("/auth/profile", { ojoTypeName: selectedOjo });

      // Refresh OjoContext so the UI updates immediately to the selected Ojo
      try {
        await refresh?.();
      } catch (e) {
        console.warn("Failed to refresh OjoContext:", e);
      }

      onNext();
    } catch (err: any) {
      console.error("Failed to update OjoType:", err);
      setError(String(err?.message || "Failed to update OjoType"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthStep playOnceKey="auth:ojotype">
      {(typingDone: boolean, skipAnimation: boolean) => (
        <>
          <AppText variant="bodyText" style={styles.description}>
            Now that I've gotten to know you, it's my turn to introduce myself. I'm here to help you achieve your goals.
            You can choose ojo, and I'll help you. You can choose how you want your ojo to guide you.
          </AppText>

          {(typingDone || skipAnimation) && (
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
                    enabled={typingDone}
                    skipAnimation={skipAnimation}
                    hideUntilEnabled
                    animateHeight
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
                          backgroundColor: COLORS.white,
                          borderColor: isSelected ? ojo.color : COLORS.white,
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
                      <AppText style={styles.ojoRole}>{ojo.persona.split(" ").slice(0, 3).join(" ")}</AppText>
                    </TouchableOpacity>
                  </GridEntranceItem>
                );
              })}
            </View>
          )}

          {error && <AppText style={styles.errorText}>{error}</AppText>}

          {/* No Back button per design; show only Next */}
          <AuthButtonsGroup
            entranceEnabled={typingDone}
            containerDelay={140 + 4 * 80}
            right={{
              title: loading ? "Saving..." : "Next",
              onPress: handleNext,
              icon: "right",
              iconPosition: "right",
              color: "primary6",
              disabled: loading,
            }}
          />
        </>
      )}
    </AuthStep>
  );
};

const styles = StyleSheet.create({
  description: {
    marginBottom: SPACING.lg,
    lineHeight: FONT_SIZES.base,
  },
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
    color: COLORS.darkGray,
    textAlign: "center",
  },
  errorText: {
    color: COLORS.primary7,
    fontSize: FONT_SIZES.sm,
    marginBottom: SPACING.md,
    textAlign: "center",
  },
});

export default OjoTypeStep;
