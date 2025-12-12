import React, { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, ViewStyle, TextStyle } from "react-native";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
  text: {
    fontFamily: TYPOGRAPHY.bodyText.fontFamily,
    fontSize: TYPOGRAPHY.bodyText.fontSize,
    color: COLORS.black,
    overflow: "hidden",
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
  cardHovered: {
    backgroundColor: COLORS.white2,
  },
  cardDragging: {
    backgroundColor: COLORS.white3,
  },
  handle: {
    gap: 4,
    padding: 8,
    borderRadius: 8,
  },
  handleBar: {
    width: 18,
    height: 2,
    borderRadius: 2,
  },
  handleBarInactive: {
    backgroundColor: COLORS.lightGray,
  },
  handleBarActive: {
    backgroundColor: COLORS.darkGray,
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
});

const SortableItem: React.FC<{ item: PriorityListItem }> = ({ item }) => {
  const [hovered, setHovered] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const dragStyle: ViewStyle = useMemo(
    () => ({
      transform: transform ? [
        { translateX: transform.x },
        { translateY: transform.y },
        { scaleX: transform.scaleX },
        { scaleY: transform.scaleY },
      ] : [],
      zIndex: isDragging ? 1 : 0,
    }),
    [transform, isDragging]
  );

  const cardStyle: ViewStyle[] = [
    styles.card,
    hovered && !isDragging && styles.cardHovered,
    isDragging && styles.cardDragging,
    dragStyle,
  ];

  const active = isDragging || hovered;

  return (
    <View
      ref={setNodeRef as any}
      style={cardStyle}
      {...attributes}
    >
      <View style={styles.contentRow}>
        {item.icon && <View style={styles.iconWrap}>{item.icon}</View>}
        <Text style={styles.text} numberOfLines={1} ellipsizeMode="tail">
          {item.label}
        </Text>
      </View>
      <Pressable 
        accessibilityLabel={`Reorder ${item.label}`}
        style={styles.handle}
        {...listeners}
      >
        <View style={[styles.handleBar, active ? styles.handleBarActive : styles.handleBarInactive]} />
        <View style={[styles.handleBar, active ? styles.handleBarActive : styles.handleBarInactive]} />
      </Pressable>
    </View>
  );
};

const PriorityList: React.FC<PriorityListProps> = ({ items, onChange }) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    onChange(arrayMove(items, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <View style={styles.list}>
          {items.map((item) => (
            <SortableItem key={item.id} item={item} />
          ))}
        </View>
      </SortableContext>
    </DndContext>
  );
};

export default PriorityList;
