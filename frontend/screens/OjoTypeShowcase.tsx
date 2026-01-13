/**
 * File: frontend/screens/OjoTypeShowcase.tsx
 * Purpose: Showcase and demo all OjoType components
 * This is a reference implementation showing all features
 */
import React, { useState } from "react";
import { View, ScrollView, Text, StyleSheet, Alert, SafeAreaView } from "react-native";
import { COLORS, FONTS, FONT_SIZES, SPACING } from "../theme";
import { OjoTypeSelector, OjoTypeBadge } from "../components";
import { getAllOjoTypes, getOjoType, OjoTypeName } from "../config/ojoTypeConfig";

/**
 * OjoTypeShowcase Screen
 * Demonstrates all OjoType components and their variations
 */
export default function OjoTypeShowcase() {
  const [selectedOjo, setSelectedOjo] = useState<OjoTypeName>("mentorjo");
  const [loading, setLoading] = useState(false);

  const handleSelectOjoType = async (ojoTypeName: OjoTypeName) => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));
      setSelectedOjo(ojoTypeName);
      Alert.alert("Success", `Switched to ${ojoTypeName}!`);
    } finally {
      setLoading(false);
    }
  };

  const selectedConfig = getOjoType(selectedOjo);
  const allOjoTypes = getAllOjoTypes();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>OjoType Showcase</Text>
          <Text style={styles.subtitle}>Explore all 4 Ojo personalities</Text>
        </View>

        {/* Section 1: Current Selection Display */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Selection</Text>
          <View
            style={[
              styles.currentSelectionCard,
              {
                backgroundColor: selectedConfig.backgroundColor,
                borderColor: selectedConfig.color,
              },
            ]}
          >
            <Text style={styles.emoji}>{selectedConfig.emoji}</Text>
            <Text style={[styles.displayName, { color: selectedConfig.color }]}>{selectedConfig.displayName}</Text>
            <Text style={styles.persona}>{selectedConfig.persona}</Text>
            <View style={styles.tonesContainer}>
              {selectedConfig.tones.map((tone, idx) => (
                <View key={`tone-${idx}`} style={[styles.toneBadge, { backgroundColor: selectedConfig.color }]}>
                  <Text style={styles.toneBadgeText}>{tone}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Section 2: OjoType Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Your OjoType</Text>
          <OjoTypeSelector currentOjoType={selectedOjo} onSelect={handleSelectOjoType} disabled={loading} />
        </View>

        {/* Section 3: Badge Variants - Small */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Small Badge Variants</Text>
          <View style={styles.badgeVariants}>
            {allOjoTypes.map((ojo) => (
              <View key={`badge-small-${ojo.name}`} style={styles.badgeItem}>
                <OjoTypeBadge ojoTypeName={ojo.name as OjoTypeName} size="small" />
              </View>
            ))}
          </View>
        </View>

        {/* Section 4: Badge Variants - Medium with Label */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Medium Badges with Label</Text>
          <View style={styles.badgeVariants}>
            {allOjoTypes.map((ojo) => (
              <View key={`badge-medium-${ojo.name}`} style={styles.badgeItem}>
                <OjoTypeBadge ojoTypeName={ojo.name as OjoTypeName} size="medium" showLabel />
              </View>
            ))}
          </View>
        </View>

        {/* Section 5: Badge Variants - Large with Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Large Badge with Description</Text>
          <OjoTypeBadge ojoTypeName={selectedOjo} size="large" showLabel showDescription style={{ width: "100%" }} />
        </View>

        {/* Section 6: All OjoTypes Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All OjoTypes Summary</Text>
          {allOjoTypes.map((ojo) => (
            <View
              key={`summary-${ojo.name}`}
              style={[
                styles.summaryCard,
                {
                  borderLeftColor: ojo.color,
                  backgroundColor: ojo.backgroundColor,
                },
              ]}
            >
              <View style={styles.summaryHeader}>
                <Text style={styles.emoji}>{ojo.emoji}</Text>
                <Text style={[styles.summaryName, { color: ojo.color }]}>{ojo.displayName}</Text>
                {ojo.isDefault && <Text style={[styles.defaultBadge, { color: ojo.color }]}>DEFAULT</Text>}
              </View>
              <Text style={styles.summaryPersona}>{ojo.persona}</Text>
              <View style={styles.summaryTones}>
                {ojo.tones.map((tone, idx) => (
                  <Text key={`summary-tone-${idx}`} style={[styles.summaryTone, { color: ojo.color }]}>
                    {tone}
                    {idx < ojo.tones.length - 1 ? " • " : ""}
                  </Text>
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* Section 7: Color Palette */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Color Palette</Text>
          {allOjoTypes.map((ojo) => (
            <View key={`colors-${ojo.name}`} style={styles.colorRow}>
              <View style={[styles.colorBox, { backgroundColor: ojo.color }]} />
              <View style={styles.colorInfo}>
                <Text style={styles.colorName}>{ojo.displayName}</Text>
                <Text style={styles.colorValue}>{ojo.color}</Text>
                <Text style={styles.colorValue}>{ojo.backgroundColor}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Section 8: Feature Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Features</Text>
          <View style={styles.featureList}>
            {[
              "✓ 4 distinct personalities with emojis",
              "✓ Color-coded by personality type",
              "✓ Icon integration for visual recognition",
              "✓ Multiple component sizes and variants",
              "✓ Loading states and error handling",
              "✓ API integration for updates",
              "✓ Full TypeScript support",
              "✓ Responsive design",
            ].map((feature, idx) => (
              <Text key={`feature-${idx}`} style={styles.featureItem}>
                {feature}
              </Text>
            ))}
          </View>
        </View>

        {/* Section 9: Component Props */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Component APIs</Text>

          {/* OjoTypeSelector Props */}
          <View style={styles.apiCard}>
            <Text style={styles.apiTitle}>OjoTypeSelector Props</Text>
            <View style={styles.apiContent}>
              <Text style={styles.apiProp}>• currentOjoType: OjoTypeName (optional)</Text>
              <Text style={styles.apiProp}>• onSelect: (name) =&gt; Promise&lt;void&gt;</Text>
              <Text style={styles.apiProp}>• disabled: boolean (optional)</Text>
            </View>
          </View>

          {/* OjoTypeBadge Props */}
          <View style={styles.apiCard}>
            <Text style={styles.apiTitle}>OjoTypeBadge Props</Text>
            <View style={styles.apiContent}>
              <Text style={styles.apiProp}>• ojoTypeName: OjoTypeName (required)</Text>
              <Text style={styles.apiProp}>• size: "small" | "medium" | "large" (optional)</Text>
              <Text style={styles.apiProp}>• showLabel: boolean (optional)</Text>
              <Text style={styles.apiProp}>• showDescription: boolean (optional)</Text>
            </View>
          </View>

          {/* useOjoType Hook */}
          <View style={styles.apiCard}>
            <Text style={styles.apiTitle}>useOjoType Hook</Text>
            <View style={styles.apiContent}>
              <Text style={styles.apiProp}>• currentOjoType: OjoTypeName | null</Text>
              <Text style={styles.apiProp}>• ojoTypeData: OjoTypeData | null</Text>
              <Text style={styles.apiProp}>• loading: boolean</Text>
              <Text style={styles.apiProp}>• error: string | null</Text>
              <Text style={styles.apiProp}>• updateOjoType: (name) =&gt; Promise&lt;void&gt;</Text>
              <Text style={styles.apiProp}>• refetch: () =&gt; Promise&lt;void&gt;</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>OjoType System - Complete Frontend Implementation</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  content: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.lg,
  },
  header: {
    marginBottom: SPACING.xlg,
  },
  title: {
    fontSize: FONT_SIZES.xlg,
    fontFamily: FONTS.fredokaBold,
    color: COLORS.black,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONT_SIZES.base,
    fontFamily: FONTS.fredokaRegular,
    color: COLORS.darkGray,
  },
  section: {
    marginBottom: SPACING.xlg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontFamily: FONTS.fredokaSemiBold,
    color: COLORS.black,
    marginBottom: SPACING.md,
  },
  currentSelectionCard: {
    borderRadius: 12,
    borderWidth: 2,
    padding: SPACING.lg,
    alignItems: "center",
  },
  emoji: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  displayName: {
    fontSize: FONT_SIZES.lg,
    fontFamily: FONTS.fredokaBold,
    marginBottom: SPACING.sm,
  },
  persona: {
    fontSize: FONT_SIZES.sm,
    fontFamily: FONTS.fredokaRegular,
    color: COLORS.darkGray,
    textAlign: "center",
    marginBottom: SPACING.md,
  },
  tonesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    justifyContent: "center",
  },
  toneBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
  },
  toneBadgeText: {
    color: COLORS.white,
    fontFamily: FONTS.fredokaSemiBold,
    fontSize: FONT_SIZES.sm,
  },
  badgeVariants: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    flexWrap: "wrap",
    gap: SPACING.md,
  },
  badgeItem: {
    marginBottom: SPACING.md,
  },
  summaryCard: {
    borderLeftWidth: 4,
    borderRadius: 8,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  summaryName: {
    fontSize: FONT_SIZES.base,
    fontFamily: FONTS.fredokaSemiBold,
    flex: 1,
  },
  defaultBadge: {
    fontSize: FONT_SIZES.sm,
    fontFamily: FONTS.fredokaBold,
  },
  summaryPersona: {
    fontSize: FONT_SIZES.sm,
    fontFamily: FONTS.fredokaRegular,
    color: COLORS.darkGray,
    marginBottom: SPACING.sm,
  },
  summaryTones: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  summaryTone: {
    fontSize: FONT_SIZES.sm,
    fontFamily: FONTS.fredokaMedium,
  },
  colorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.md,
    gap: SPACING.md,
  },
  colorBox: {
    width: 60,
    height: 60,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  colorInfo: {
    flex: 1,
  },
  colorName: {
    fontSize: FONT_SIZES.base,
    fontFamily: FONTS.fredokaSemiBold,
    color: COLORS.black,
  },
  colorValue: {
    fontSize: FONT_SIZES.sm,
    fontFamily: FONTS.fredokaRegular,
    color: COLORS.darkGray,
  },
  featureList: {
    gap: SPACING.md,
  },
  featureItem: {
    fontSize: FONT_SIZES.base,
    fontFamily: FONTS.fredokaRegular,
    color: COLORS.black,
  },
  apiCard: {
    backgroundColor: COLORS.white3,
    borderRadius: 8,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary1,
  },
  apiTitle: {
    fontSize: FONT_SIZES.base,
    fontFamily: FONTS.fredokaSemiBold,
    color: COLORS.black,
    marginBottom: SPACING.sm,
  },
  apiContent: {
    gap: SPACING.sm,
  },
  apiProp: {
    fontSize: FONT_SIZES.sm,
    fontFamily: FONTS.fredokaRegular,
    color: COLORS.darkGray,
  },
  footer: {
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.white3,
  },
  footerText: {
    fontSize: FONT_SIZES.sm,
    fontFamily: FONTS.fredokaRegular,
    color: COLORS.darkGray,
    textAlign: "center",
  },
});
