import React from "react";
import { View, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import Box from "../../../components/layout/Box";
import AppText from "../../../components/common/AppText";
import AppButton from "../../../components/common/AppButton";
import { COLORS, SPACING, FONT_SIZES, SHADOWS } from "../../../theme";
import { ICONS } from "../../../components/icons/icons";
import { BusyBlock, blockSummary, BLOCK_TYPE_LABEL } from "../../../services/busyBlockService";
import { useAccessibilityPreferences } from "../../../hooks/useAccessibilityPreferences";

interface BlocksBoxProps {
  blocks: BusyBlock[];
  loading: boolean;
  onEdit: (block: BusyBlock) => void;
  onDelete: (block: BusyBlock) => void;
  onAdd: () => void;
}

function BlockRow({ block, onEdit, onDelete }: { block: BusyBlock; onEdit: () => void; onDelete: () => void }) {
  const { preferences } = useAccessibilityPreferences();
  const typeLabel = block.blockType ? BLOCK_TYPE_LABEL[block.blockType as keyof typeof BLOCK_TYPE_LABEL] : null;
  const summary = blockSummary(block, preferences.timeFormat === "12h");

  return (
    <View style={rowStyles.container}>
      <View style={rowStyles.info}>
        {block.title ? <AppText style={rowStyles.title}>{block.title}</AppText> : null}
        {typeLabel ? <AppText style={rowStyles.typeLabel}>{typeLabel}</AppText> : null}
        {summary ? (
          <AppText style={rowStyles.summary} numberOfLines={4}>
            {summary}
          </AppText>
        ) : null}
      </View>
      <View style={rowStyles.actions}>
        <Pressable style={[rowStyles.iconBtn, { backgroundColor: COLORS.white2 ?? "#F0F0F8" }]} onPress={onEdit}>
          {ICONS.edit ? React.createElement(ICONS.edit, { size: 15, color: COLORS.primary1 }) : null}
        </Pressable>
        <Pressable style={[rowStyles.iconBtn, { backgroundColor: "#FFEBEE" }]} onPress={onDelete}>
          {ICONS.trash ? React.createElement(ICONS.trash, { size: 15, color: "#C62828" }) : null}
        </Pressable>
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary1,
    ...SHADOWS.card,
  },
  info: { flex: 1, gap: 2, paddingRight: SPACING.sm },
  title: { fontSize: FONT_SIZES.sm, fontWeight: "600", color: COLORS.darkGray },
  typeLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.primary1,
    textTransform: "uppercase",
  },
  summary: { fontSize: FONT_SIZES.sm, color: COLORS.darkGray, lineHeight: FONT_SIZES.sm * 1.5 },
  actions: { flexDirection: "row", gap: 6, alignItems: "center" },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
});

export function BlocksBox({ blocks, loading, onEdit, onDelete, onAdd }: BlocksBoxProps) {
  return (
    <Box title="BUSY BLOCKS" titleColor={COLORS.primary1} style={{ width: "100%" }}>
      <AppText
        style={{
          fontSize: FONT_SIZES.sm,
          color: COLORS.darkGray,
          marginBottom: SPACING.md,
          lineHeight: FONT_SIZES.sm * 1.5,
        }}
      >
        Mark when you're unavailable. Mojo won't schedule tasks during these windows.
      </AppText>

      {loading ? (
        <ActivityIndicator color={COLORS.primary1} style={{ marginVertical: SPACING.lg }} />
      ) : (
        <>
          {blocks.length === 0 ? (
            <AppText
              style={{
                fontSize: FONT_SIZES.sm,
                color: COLORS.lightGray,
                textAlign: "center",
                marginVertical: SPACING.md,
              }}
            >
              No busy blocks yet.
            </AppText>
          ) : (
            blocks.map((block, index) => (
              <BlockRow
                key={block._id ?? `block-${index}`}
                block={block}
                onEdit={() => onEdit(block)}
                onDelete={() => onDelete(block)}
              />
            ))
          )}
          <AppButton
            title="+ Add Busy Block"
            mode="light"
            color="primary1"
            onPress={onAdd}
            width="100%"
            style={{ alignSelf: "stretch", marginTop: blocks.length > 0 ? SPACING.sm : 0 }}
          />
        </>
      )}
    </Box>
  );
}

