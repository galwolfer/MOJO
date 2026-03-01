import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import DraggableFlatList, { RenderItemParams } from "react-native-draggable-flatlist";
import { COLORS, SPACING, TYPOGRAPHY, COMPONENT_STYLES, DIVIDER, SHADOWS, ICON_SIZES } from "../../theme";
import { useColors } from "../../context/ThemeContext";
import { ICONS } from "../icons/icons";

export type PriorityListItem = {
  id: string;
  label: string;
  icon?: React.ReactNode;
};

interface PriorityListProps {
  items: PriorityListItem[];
  onChange: (nextOrder: PriorityListItem[]) => void;
}

const ROW_HEIGHT = SPACING.lg * 2.5;

const styles = StyleSheet.create({
  card: {
    ...(COMPONENT_STYLES.listItem as any),
    padding: SPACING.md,
    height: ROW_HEIGHT,
    borderRadius: SPACING.lg,
  },
  cardDragging: {
    backgroundColor: COLORS.white3,
    ...(SHADOWS.card as any),
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
    flex: 1,
  },
  dragHandle: {
    padding: SPACING.sm,
    marginLeft: SPACING.sm,
    alignItems: "center",
    justifyContent: "center",
  },
});

/**
 * Creates a stable string signature for the order of items.
 * @param arr - The array of priority list items.
 * @returns A string representing the order.
 */
function orderKey(arr: PriorityListItem[]): string {
  // Notes inside the code are in English
  // Create a stable signature for the current order.
  return arr.map((x) => x.id).join("|");
}

/**
 * RenderItem - Renders a single draggable item in the priority list.
 * @param item - The item to render.
 * @param drag - Drag handler.
 * @param isActive - Whether the item is being dragged.
 */
const RenderItem = ({ item, drag, isActive }: RenderItemParams<PriorityListItem>) => {
  const colors = useColors();
  return (
    <View
      style={[
        styles.card,
        isActive && [styles.cardDragging, { backgroundColor: colors.bg3 }],
        isActive && styles.cardActive,
      ]}
    >
      <View style={styles.contentRow}>
        {item.icon && <View style={styles.iconWrap}>{item.icon}</View>}
        <Text style={[styles.text, { color: colors.text1 }]} numberOfLines={1} ellipsizeMode="tail">
          {item.label}
        </Text>
      </View>

      <View style={styles.dragHandle} onTouchStart={drag}>
        <ICONS.move width={ICON_SIZES.sm} height={ICON_SIZES.sm} color={isActive ? colors.gray2 : colors.gray1} />
      </View>
    </View>
  );
};

/**
 * PriorityList - A native draggable list component for reordering items.
 * @param items - The list of items to display.
 * @param onChange - Callback when the order changes.
 */
const PriorityList: React.FC<PriorityListProps> = ({ items, onChange }) => {
  const [listData, setListData] = useState<PriorityListItem[]>(items);

  const isDraggingRef = useRef(false);
  const frozenDataRef = useRef<PriorityListItem[]>(items);

  // This stores the last order we emitted to the parent.
  // If the parent temporarily sends an older order, we ignore it (prevents the blink).
  const lastEmittedOrderRef = useRef<string | null>(null);

  const itemsOrder = useMemo(() => orderKey(items), [items]);
  const listOrder = useMemo(() => orderKey(listData), [listData]);

  useEffect(() => {
    if (isDraggingRef.current) return;

    const lastEmitted = lastEmittedOrderRef.current;

    // If we recently emitted an order and props don't match it yet,
    // treat it as a stale echo from the parent and ignore.
    if (lastEmitted && itemsOrder !== lastEmitted) {
      return;
    }

    // Now it's safe to accept the props (either:
    // - parent caught up and matches our emitted order, or
    // - it's a true external update like reset/server).
    if (itemsOrder !== listOrder) {
      setListData(items);
      frozenDataRef.current = items;
    }
  }, [items, itemsOrder, listOrder]);

  const keyExtractor = useCallback((item: PriorityListItem) => item.id, []);

  const renderItem = useCallback((params: RenderItemParams<PriorityListItem>) => <RenderItem {...params} />, []);

  const handleDragBegin = useCallback(() => {
    isDraggingRef.current = true;
    frozenDataRef.current = listData; // freeze the order while dragging
  }, [listData]);

  const handleDragEnd = useCallback(
    ({ data }: { data: PriorityListItem[] }) => {
      isDraggingRef.current = false;

      // Record the order we want the parent to reflect.
      lastEmittedOrderRef.current = orderKey(data);

      // Commit locally immediately (should match internal final order).
      setListData(data);
      frozenDataRef.current = data;

      // Notify parent.
      onChange(data);
    },
    [onChange],
  );

  const dataForRender = isDraggingRef.current ? frozenDataRef.current : listData;

  return (
    <View style={{ position: "relative" }}>
      <DraggableFlatList
        data={dataForRender}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        onDragBegin={handleDragBegin}
        onDragEnd={handleDragEnd}
        scrollEnabled={false}
        removeClippedSubviews={false}
        animationConfig={{ duration: 80 }}
        contentContainerStyle={{ ...(COMPONENT_STYLES.listContainer as any), padding: 0 }}
      />

      {/* Fixed separators overlay (uses the same dataForRender to avoid desync) */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { height: ROW_HEIGHT * dataForRender.length, opacity: isDraggingRef.current ? 0 : 1 },
        ]}
      >
        {dataForRender.slice(0, -1).map((_, idx) => (
          <View
            key={`sep-${idx}`}
            style={{
              position: "absolute",
              left: SPACING.sm,
              right: SPACING.sm,
              top: ROW_HEIGHT * (idx + 1),
              height: DIVIDER.width,
              backgroundColor: DIVIDER.color,
            }}
          />
        ))}
      </View>
    </View>
  );
};

export default PriorityList;
