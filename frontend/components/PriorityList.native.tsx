import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { COLORS, SPACING, SHADOWS, TYPOGRAPHY } from "../theme";

export type PriorityListItem = {
  id: string;
  label: string;
  icon?: React.ReactNode;
};

interface PriorityListProps {
  items: PriorityListItem[];
  onChange: (nextOrder: PriorityListItem[]) => void;
}

const styles = StyleSheet.create({
  list: {
    width: "100%",
    gap: SPACING.sm,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.colorWhite,
    borderWidth: 1,
    borderColor: COLORS.white3,
    gap: SPACING.sm,
  },
  text: {
    fontFamily: TYPOGRAPHY.bodyText.fontFamily,
    fontSize: TYPOGRAPHY.bodyText.fontSize,
    color: COLORS.black,
    flex: 1,
  },
  iconWrap: {
    marginRight: SPACING.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
  controls: {
    gap: 4,
  },
  controlButton: {
    padding: 6,
    borderRadius: 4,
    backgroundColor: COLORS.white2,
  },
  controlButtonDisabled: {
    opacity: 0.3,
  },
  arrow: {
    fontSize: 14,
    color: COLORS.darkGray,
  },
});

const PriorityListItem: React.FC<{
  item: PriorityListItem;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}> = ({ item, isFirst, isLast, onMoveUp, onMoveDown }) => {
  return (
    <View style={styles.card}>
      <View style={styles.contentRow}>
        {item.icon && <View style={styles.iconWrap}>{item.icon}</View>}
        <Text style={styles.text} numberOfLines={1} ellipsizeMode="tail">
          {item.label}
        </Text>
      </View>
      <View style={styles.controls}>
        <Pressable
          onPress={onMoveUp}
          disabled={isFirst}
          style={[styles.controlButton, isFirst && styles.controlButtonDisabled]}
          accessibilityLabel={`Move ${item.label} up`}
        >
          <Text style={styles.arrow}>▲</Text>
        </Pressable>
        <Pressable
          onPress={onMoveDown}
          disabled={isLast}
          style={[styles.controlButton, isLast && styles.controlButtonDisabled]}
          accessibilityLabel={`Move ${item.label} down`}
        >
          <Text style={styles.arrow}>▼</Text>
        </Pressable>
      </View>
    </View>
  );
};

const PriorityList: React.FC<PriorityListProps> = ({ items, onChange }) => {
  const moveItem = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= items.length) return;
    const newItems = [...items];
    const [movedItem] = newItems.splice(fromIndex, 1);
    newItems.splice(toIndex, 0, movedItem);
    onChange(newItems);
  };

  return (
    <View style={styles.list}>
      {items.map((item, index) => (
        <PriorityListItem
          key={item.id}
          item={item}
          index={index}
          isFirst={index === 0}
          isLast={index === items.length - 1}
          onMoveUp={() => moveItem(index, index - 1)}
          onMoveDown={() => moveItem(index, index + 1)}
        />
      ))}
    </View>
  );
};

export default PriorityList;
