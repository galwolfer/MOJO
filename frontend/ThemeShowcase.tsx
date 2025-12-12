import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import BoxContainer from "./components/layout/BoxContainer";
import AppText from "./components/AppText";
import { COLORS, SPACING, FONTS, SYSTEM_FONTS, TYPOGRAPHY, SHADOWS, paletteIndexFromKey } from "./theme";
import { Checkbox } from "./components/icons/Checkbox";
import { ProgressIcon } from "./components/icons/ProgressIcon";
import { ICONS, ICON_NAMES } from "./components/icons/icons";
import Box from "./components/layout/Box";
import Input from "./components/inputs/Input";
import Tag from "./components/inputs/tag";
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
  const [textInput, setTextInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [fruitInput, setFruitInput] = useState("");
  const [selectedFruit, setSelectedFruit] = useState<string | null>(null);
  const [numberInput, setNumberInput] = useState("");
  const [singleOption, setSingleOption] = useState<string[]>([]);
  const [multiOptions, setMultiOptions] = useState<string[]>([]);
  const fruits = ["Apple", "Banana", "Cherry", "Date", "Elderberry"];

  return (
    <BoxContainer>
      <AppText variant="title">Theme Showcase</AppText>

      <Box title="Colors">
        <View style={styles.colorsGrid}>
          {Object.entries(COLORS).map(([name, hex]) => (
            <ColorSwatch key={name} name={name} hex={hex} />
          ))}
        </View>
      </Box>

      <Box title="Spacing">
        <View style={styles.spacingCol}>
          {Object.entries(SPACING).map(([k, v]) => (
            <View key={k}>
              <View style={[styles.spacingBox, { height: v * 3, width: v * 6 }]} />
              <AppText variant="notes">{`${k} — ${v}px`}</AppText>
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

          <View style={{ gap: 10 }}>
            <AppText variant="bodyText">Input:</AppText>
            <Input value={textInput} onChangeText={setTextInput} placeholder="Enter text..." />
            <Input
              type="email"
              label="Email"
              value={emailInput}
              onChangeText={setEmailInput}
              placeholder="your@email.com"
            />
            <Input
              type="password"
              label="Password"
              value={passwordInput}
              onChangeText={setPasswordInput}
              placeholder="Enter password"
              error={passwordInput && passwordInput.length < 6 ? "Password too short" : undefined}
            />
            <Input
              type="number"
              label="Number"
              value={numberInput}
              onChangeText={setNumberInput}
              placeholder="Enter a number"
            />
            <Input
              type="text"
              label="Fruit (Single Select)"
              placeholder="Select a fruit..."
              options={fruits}
              value={fruitInput}
              onChangeText={(t) => {
                setFruitInput(t);
                setSelectedFruit(null);
              }}
              onSelect={(values: string[]) => {
                const val = values[0] || "";
                setSelectedFruit(val);
                setFruitInput(val);
              }}
            />

            {singleOption.length > 0 && <AppText variant="notes">Selected: {singleOption.join(", ")}</AppText>}
            <Input
              label="Multi-Select Dropdown"
              placeholder="Select multiple fruits..."
              options={fruits}
              multiSelect
              onSelect={setMultiOptions}
            />
            {multiOptions.length > 0 && (
              <View style={{ marginTop: SPACING.sm, flexDirection: "row", gap: SPACING.sm, flexWrap: "wrap" }}>
                {multiOptions.map((m) => (
                  <Tag
                    key={m}
                    label={m}
                    colorIndex={paletteIndexFromKey(m)}
                    editable
                    onRemove={() => setMultiOptions((prev) => prev.filter((x) => x !== m))}
                  />
                ))}
              </View>
            )}
          </View>
        </View>
      </Box>

      <Box title="Icon Library (All Icons)">
        <View style={{ gap: 12, paddingBottom: 20 }}>
          <AppText variant="bodyText">All icons from icons-lib with CSS color control (primary1 color):</AppText>
          <View style={styles.iconsGrid}>
            {ICON_NAMES.map((iconName) => {
              const IconComponent = ICONS[iconName];
              return (
                <View key={iconName} style={styles.iconItem}>
                  <View style={styles.iconWrapper}>
                    <IconComponent size={32} color={COLORS.primary1} />
                  </View>
                  <AppText variant="notes" style={styles.iconLabel}>
                    {iconName}
                  </AppText>
                </View>
              );
            })}
          </View>
        </View>
      </Box>
    </BoxContainer>
  );
};

const styles = StyleSheet.create({
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
    color: COLORS.black,
  },
  hexLabel: {
    color: COLORS.grayLight,
  },
  spacingRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  spacingCol: {
    alignItems: "center",
  },
  spacingBox: {
    backgroundColor: COLORS.black,
    borderRadius: 6,
    marginBottom: 6,
    padding: SPACING.sm,
    ...SHADOWS.card.rn,
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

  iconsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  iconItem: {
    alignItems: "center",
    width: 80,
    color: COLORS.primary1,
    marginBottom: SPACING.md,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.card.rn,
    borderWidth: 1,
    borderColor: COLORS.grayLight,
  },
  iconLabel: {
    marginTop: 6,
    fontSize: 11,
    textAlign: "center",
    color: COLORS.black,
  },
});

export default ThemeShowcase;
