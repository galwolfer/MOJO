import React from "react";
import { View } from "react-native";
import Tag from "./tag";
import { SPACING, paletteIndexFromKey } from "../../theme";

interface TagsBelowProps {
  selected: string[];
  onRemove: (label: string) => void;
}

/**
 * TagsBelow - A component that displays selected tags below with remove functionality.
 * @param selected - Array of selected tag labels.
 * @param onRemove - Callback to remove a tag by label.
 */
const TagsBelow: React.FC<TagsBelowProps> = ({ selected, onRemove }) => {
  return (
    <View
      style={{
        marginTop: SPACING.sm,
        flexDirection: "row",
        alignItems: "center",
        gap: SPACING.sm,
        flexWrap: "wrap",
        paddingHorizontal: SPACING.md,
      }}
    >
      {selected.map((s, i) => (
        <Tag
          key={s}
          label={s}
          colorIndex={paletteIndexFromKey(s)}
          editable
          onRemove={() => onRemove(s)}
          style={{ marginRight: i < selected.length - 1 ? SPACING.sm : 0 }}
        />
      ))}
    </View>
  );
};

export default TagsBelow;
