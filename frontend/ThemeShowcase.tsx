import React from "react";
import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { COLORS, SPACING, FONTS, SYSTEM_FONTS, TYPOGRAPHY } from "./theme";
import { Checkbox } from "./components/Checkbox";
import { ProgressIcon } from "./components/ProgressIcon";
import { useState } from "react";

const ColorSwatch = ({ name, hex }: { name: string; hex: string }) => (
  <View style={styles.swatchWrap}>
    <View style={[styles.swatch, { backgroundColor: hex }]} />
    <Text style={styles.swatchLabel}>{name}</Text>
    <Text style={styles.hexLabel}>{hex}</Text>
  </View>
);

const ThemeShowcase: React.FC = () => {
  const [isChecked, setIsChecked] = useState(false);
  const [progress, setProgress] = useState(0);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Theme Showcase</Text>

      <Text style={styles.sectionTitle}>Colors</Text>
      <View style={styles.colorsGrid}>
        {Object.entries(COLORS).map(([name, hex]) => (
          <ColorSwatch key={name} name={name} hex={hex} />
        ))}
      </View>

      <Text style={styles.sectionTitle}>Spacing</Text>
      <View style={styles.spacingRow}>
        {Object.entries(SPACING).map(([k, v]) => (
          <View key={k} style={styles.spacingCol}>
            <View style={[styles.spacingBox, { height: v * 3, width: v * 6 }]} />
            <Text style={styles.spacingLabel}>{`${k} — ${v}px`}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Fonts (custom + system fallbacks)</Text>
      <View style={styles.fontsList}>
        {Object.entries(FONTS).map(([key, family]) => (
          <View key={key} style={styles.fontRow}>
            <Text style={[styles.fontSample, { fontFamily: family }]}>{family}</Text>
            <Text style={styles.fontMeta}>{key}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Typography Presets</Text>
      <View style={styles.typoList}>
        {Object.entries(TYPOGRAPHY).map(([key, styleObj]) => (
          <View key={key} style={styles.typoRow}>
            <Text style={[styles.typoSample, { ...(styleObj as any) }]}>{key} — The quick brown fox jumps</Text>
            <Text style={styles.fontMeta}>{JSON.stringify(styleObj).slice(0, 80)}...</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Interactive Components</Text>
      <View style={{ gap: 20, paddingBottom: 40 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={{ fontFamily: FONTS.fredokaMedium }}>Checkbox:</Text>
          <Checkbox checked={isChecked} onChange={setIsChecked} size={40} />
        </View>

        <View style={{ gap: 10 }}>
          <Text style={{ fontFamily: FONTS.fredokaMedium }}>Progress Icon (Value: {progress.toFixed(1)}):</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 20 }}>
            <ProgressIcon value={progress} size={40} />
            <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
              {[0, 0.25, 0.5, 0.75, 1].map((val) => (
                <TouchableOpacity
                  key={val}
                  onPress={() => setProgress(val)}
                  style={{ padding: 8, backgroundColor: "#eee", borderRadius: 4 }}
                >
                  <Text style={{ fontSize: 12 }}>{val * 100}%</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </View>

      <View style={{ height: 36 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 18,
    backgroundColor: "#fff",
    alignItems: "stretch",
  },
  header: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 18,
    marginBottom: 8,
  },
  colorsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  swatchWrap: {
    width: "30%",
    marginBottom: 12,
  },
  swatch: {
    height: 64,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#eee",
  },
  swatchLabel: {
    marginTop: 6,
    fontSize: 12,
    color: "#333",
  },
  hexLabel: {
    fontSize: 11,
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
  },
  spacingLabel: {
    fontSize: 12,
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
  fontMeta: {
    fontSize: 12,
    color: "#666",
  },
  typoList: {
    marginTop: 6,
  },
  typoRow: {
    marginBottom: 12,
  },
  typoSample: {
    fontSize: 16,
    marginBottom: 6,
  },
});

export default ThemeShowcase;
