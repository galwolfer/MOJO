import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import DraggableFlatList, { RenderItemParams } from "react-native-draggable-flatlist";
import { COLORS, SPACING, TYPOGRAPHY, COMPONENT_STYLES, DIVIDER, SHADOWS, ICON_SIZES } from "../theme";
import { ICONS } from "./icons/icons";

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
  card: {
    ...(COMPONENT_STYLES.listItem as any),
    // align with web/shared: compact padding and a consistent row height
    padding: SPACING.md,
    height: SPACING.lg * 2.5,
    borderRadius: SPACING.lg,
  },
  cardDragging: {
    borderRadius: SPACING.lg,
    backgroundColor: COLORS.white3,
    ...(SHADOWS.card.rn as any),
  },
  cardActive: {
    zIndex: 999,
    elevation: 20,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconWrap: {
    marginRight: SPACING.md,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontFamily: TYPOGRAPHY.bodyText.fontFamily,
    fontSize: TYPOGRAPHY.bodyText.fontSize,
    color: COLORS.black,
    flex: 1,
  },
  dragHandle: {
    padding: SPACING.sm,
    marginLeft: SPACING.sm,
    alignItems: "center",
    justifyContent: "center",
  },
});

const RenderItem = ({ item, drag, isActive }: RenderItemParams<PriorityListItem>) => {
  return (
    <View style={[styles.card, isActive && styles.cardDragging, isActive && styles.cardActive] as any}>
      <View style={styles.contentRow}>
        {item.icon && <View style={styles.iconWrap}>{item.icon}</View>}
        <Text style={styles.text} numberOfLines={1} ellipsizeMode="tail">
          {item.label}
        </Text>
      </View>
      <View style={styles.dragHandle} onTouchStart={drag}>
        <ICONS.move
          width={ICON_SIZES.sm}
          height={ICON_SIZES.sm}
          color={isActive ? COLORS.darkGray : COLORS.lightGray}
        />
      </View>
    </View>
  );
};

const PriorityList: React.FC<PriorityListProps> = ({ items, onChange }) => {
  const [listData, setListData] = useState(items);

  useEffect(() => {
    setListData(items);
  }, [items]);

  const renderItem = useCallback((params: RenderItemParams<PriorityListItem>) => {
    return <RenderItem {...params} />;
  }, []);

  const keyExtractor = useCallback((item: PriorityListItem) => item.id, []);

  const handleDragEnd = useCallback(
    ({ data }: { data: PriorityListItem[] }) => {
      setListData(data);
      onChange(data);
    },
    [onChange]
  );

  return (
    <View style={{ position: "relative" }}>
      <DraggableFlatList
        data={listData}
        onDragEnd={handleDragEnd}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        scrollEnabled={false}
        style={{ overflow: "visible", zIndex: 1 } as any}
        contentContainerStyle={{ ...(COMPONENT_STYLES.listContainer as any), padding: 0 }}
        // removed ItemSeparatorComponent in favor of an overlayed, fixed separator layer
        animationConfig={{ duration: 100 }}
        removeClippedSubviews={false}
      />

      {/* Separators rendered in an absolutely positioned overlay so they don't move with dragged nodes */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { height: SPACING.lg * 2.5 * items.length }] as any}>
        {items.slice(0, -1).map((_, idx) => (
          <View
            key={`sep-${idx}`}
            style={{
              position: "absolute",
              left: SPACING.sm,
              right: SPACING.sm,
              height: DIVIDER.width,
              backgroundColor: DIVIDER.color,
              top: SPACING.lg * 2.5 * (idx + 1),
              zIndex: 0,
            }}
          />
        ))}
      </View>
    </View>
  );
};

export default PriorityList;
