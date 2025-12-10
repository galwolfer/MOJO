import React from "react";
import { ScrollView, View, StyleSheet, TouchableOpacity } from "react-native";
import AppText from "./components/AppText";
import { COLORS, SPACING, FONTS, SYSTEM_FONTS, TYPOGRAPHY, SHADOWS } from "./theme";
import { Checkbox } from "./components/Checkbox";
import { ProgressIcon } from "./components/ProgressIcon";
import Box from "./components/Box";
import { useState } from "react";

const ColorSwatch = ({ name, hex }: { name: string; hex: string }) => (
  <View style={styles.swatchWrap}>
    <View style={[styles.swatch, { backgroundColor: hex }]} />
    <AppText variant="notes" style={styles.swatchLabel}>
      {name}
    </AppText>
    <AppText variant="notes" style={styles.hexLabel}>
      {hex}
    </AppText>
  </View>
);

const ThemeShowcase: React.FC = () => {
  const [isChecked, setIsChecked] = useState(false);
  const [progress, setProgress] = useState(0);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <AppText variant="title">Theme Showcase</AppText>

      <Box title="Colors">
        <View style={styles.colorsGrid}>
          {Object.entries(COLORS).map(([name, hex]) => (
            <ColorSwatch key={name} name={name} hex={hex} />
          ))}
        </View>
      </Box>

      <Box title="Spacing">
        <View style={styles.spacingRow}>
          {Object.entries(SPACING).map(([k, v]) => (
            <View key={k} style={styles.spacingCol}>
              <View style={[styles.spacingBox, { height: v * 3, width: v * 6 }]} />
              <AppText variant="notes" style={styles.spacingLabel}>{`${k} — ${v}px`}</AppText>
            </View>
          ))}
        </View>
      </Box>

      <Box title="Typography Presets">
        <View style={styles.typoList}>
          {Object.entries(TYPOGRAPHY).map(([key, styleObj]) => (
            <View key={key} style={styles.typoRow}>
              <AppText variant={key as any} style={styles.typoSample}>
                {key} — The quick brown fox jumps
              </AppText>
              <AppText variant="notes">{JSON.stringify(styleObj).slice(0, 80)}...</AppText>
            </View>
          ))}
        </View>
      </Box>
      <Box title="Interactive Components">
        <View style={{ gap: 20, paddingBottom: 40 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <AppText variant="bodyText">Checkbox:</AppText>
            <Checkbox checked={isChecked} onChange={setIsChecked} size={40} />
          </View>

          <View style={{ gap: 10 }}>
            <AppText variant="bodyText">Progress Icon (Value: {progress.toFixed(1)}):</AppText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 20 }}>
              <ProgressIcon value={progress} size={40} />
              <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                {[0, 0.25, 0.5, 0.75, 1].map((val) => (
                  <TouchableOpacity
                    key={val}
                    onPress={() => setProgress(val)}
                    style={{ padding: 8, backgroundColor: "#eee", borderRadius: 4 }}
                  >
                    <AppText variant="notes" style={{ fontSize: 12 }}>
                      {val * 100}%
                    </AppText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>
      </Box>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: SPACING.md,
    alignItems: "stretch",
    gap: SPACING.lg,
  },

  colorsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.md,
  },
  swatchWrap: {
    width: "30%",
    marginBottom: SPACING.md,
    padding: SPACING.sm,
  },
  swatch: {
    height: 64,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#eee",
    ...SHADOWS.card.rn,
  },
  swatchLabel: {
    marginTop: 6,
    color: "#333",
  },
  hexLabel: {
    color: "#666",
  },
  spacingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  spacingCol: {
    alignItems: "center",
    width: "30%",
  },
  spacingBox: {
    backgroundColor: "#f2f4ff",
    borderRadius: 6,
    marginBottom: 6,
    padding: SPACING.sm,
    ...SHADOWS.card.rn,
  },
  spacingLabel: {
    color: "#333",
  },
  fontsList: {
    marginTop: 6,
  },
  fontRow: {
    marginBottom: 10,
  },
  fontSample: {
    fontSize: 20,
  },

  typoList: {
    marginTop: 6,
  },
  typoRow: {
    marginBottom: 12,
  },
  typoSample: {
    marginBottom: 6,
  },
  sectionCard: {
    backgroundColor: COLORS.colorWhite,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: 12,
    ...SHADOWS.card.rn,
  },
});

export default ThemeShowcase;
