import React, { useMemo, useState, type CSSProperties } from "react";
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
import { COLORS, SPACING, SHADOWS, TYPOGRAPHY, COMPONENT_STYLES, DIVIDER, ICON_SIZES } from "../theme";
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

const SortableItem: React.FC<{ item: PriorityListItem }> = ({ item }) => {
  const [hovered, setHovered] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const dragStyle: CSSProperties = useMemo(
    () => ({
      transform: CSS.Transform.toString(transform),
      transition: transition ?? "transform 200ms cubic-bezier(0.2, 0, 0, 1)",
      zIndex: isDragging ? 1 : 0,
    }),
    [transform, transition, isDragging]
  );

  const cardStyle: CSSProperties = {
    padding: SPACING.sm,
    ...(COMPONENT_STYLES.listItem as any),
    backgroundColor: isDragging ? COLORS.white3 : hovered ? COLORS.white2 : "transparent",
    display: "flex",
    flexDirection: "row",
    height: SPACING.lg * 2,
    cursor: "grab",
    transition: "box-shadow 180ms ease, background-color 180ms ease",
    borderRadius: SPACING.lg,
  };

  const handleStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    borderRadius: 8,
    background: "transparent",
    border: "none",
    cursor: "grab",
    touchAction: "none",
  };

  const active = isDragging || hovered;

  return (
    <div
      ref={setNodeRef}
      style={{ ...cardStyle, ...dragStyle }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      {...attributes}
    >
      <div style={contentRowStyle}>
        {item.icon && <span style={iconWrapStyle}>{item.icon}</span>}
        <span style={textStyle}>{item.label}</span>
      </div>
      <button type="button" aria-label={`Reorder ${item.label}`} style={handleStyle} {...listeners}>
        <ICONS.move size={ICON_SIZES.sm} color={active ? COLORS.darkGray : COLORS.lightGray} />
      </button>
    </div>
  );
};

const PriorityList: React.FC<PriorityListProps> = ({ items, onChange }) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
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

  // compute fixed item total height (height + vertical padding)
  const ITEM_HEIGHT = SPACING.lg * 2 + SPACING.sm * 2;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div style={listStyle}>
          {items.map((item) => (
            <SortableItem key={item.id} item={item} />
          ))}

          {/* Separators rendered in an absolutely positioned overlay so they don't move with dragged nodes */}
          <div
            aria-hidden
            style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, pointerEvents: "none" }}
          >
            {items.slice(0, -1).map((_, idx) => (
              <div
                key={`sep-${idx}`}
                style={{
                  position: "absolute",
                  left: SPACING.sm,
                  right: SPACING.sm,
                  height: DIVIDER.width,
                  backgroundColor: DIVIDER.color,
                  top: `${ITEM_HEIGHT * (idx + 1)}px`,
                }}
              />
            ))}
          </div>
        </div>
      </SortableContext>
    </DndContext>
  );
};

export default PriorityList;

const listStyle: CSSProperties = {
  ...(COMPONENT_STYLES.listContainer as any),
  width: "100%",
  padding: 0,
};

const textStyle: CSSProperties = {
  ...TYPOGRAPHY.bodyText,
};

const contentRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  width: "100%",
  flex: 1,
  minWidth: 0,
};

const iconWrapStyle: CSSProperties = {
  marginRight: SPACING.sm,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
