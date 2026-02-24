/**
 * AddSubcategoryPopup
 *
 * Shared popup for creating and editing subcategories.
 * Used by both SubcategoryPicker (inline, fixed category) and
 * SubcategoryManager (full picker, create + edit modes).
 *
 * Props:
 *   fixedCategory  – when provided the CategoryPicker is hidden and this value
 *                    is used as the category. Pass this from SubcategoryPicker so
 *                    the user does not have to re-pick the category he already chose.
 *   isLoading      – shows a loading state on the submit button (async callers).
 *   mode           – "create" (default) or "edit".
 *   initialData    – pre-fill fields for edit mode.
 */

import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Alert } from "react-native";
import AppButton from "../common/AppButton";
import Input from "../inputs/Input";
import PopupBox from "../common/PopupBox";
import CategoryPicker from "./CategoryPicker";
import SubcategoryColorPicker from "./ColorPicker";
import SubcategoryIconPicker from "./IconPicker";
import { COLORS, SPACING } from "../../theme";
import { CATEGORY_KEYS, type CategoryKey } from "../../config/categoryMeta";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SubcategoryPayload {
  name: string;
  category: CategoryKey;
  icon?: string | null;
  color?: string | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreate: (payload: SubcategoryPayload) => void;
  /** When set, the category selector is hidden and this value is used. */
  fixedCategory?: CategoryKey | string;
  mode?: "create" | "edit";
  initialData?: {
    name?: string;
    category?: CategoryKey;
    icon?: string | null;
    color?: string | null;
  };
  /** Display a loading spinner on the submit button while an async operation runs. */
  isLoading?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AddSubcategoryPopup({
  visible,
  onClose,
  onCreate,
  fixedCategory,
  mode = "create",
  initialData,
  isLoading = false,
}: Props) {
  const defaultCategory = (fixedCategory as CategoryKey) ?? initialData?.category ?? (CATEGORY_KEYS[0] as CategoryKey);

  const [name, setName] = useState(initialData?.name ?? "");
  const [category, setCategory] = useState<CategoryKey>(defaultCategory);
  const [icon, setIcon] = useState<string | null>(initialData?.icon ?? null);
  const [color, setColor] = useState<string | null>(initialData?.color ?? null);

  // Reset / seed fields each time the popup opens
  const prevVisibleRef = useRef(visible);
  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      setName(initialData?.name ?? "");
      setCategory((fixedCategory as CategoryKey) ?? initialData?.category ?? (CATEGORY_KEYS[0] as CategoryKey));
      setIcon(initialData?.icon ?? null);
      setColor(initialData?.color ?? null);
    }
    prevVisibleRef.current = visible;
  }, [visible, initialData, fixedCategory]);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert("Validation Error", "Please enter a subcategory name.");
      return;
    }
    if (trimmed.toLowerCase() === "general" || trimmed.toLowerCase().startsWith("general ")) {
      Alert.alert("Validation Error", "'General' is reserved and cannot be used as a name prefix.");
      return;
    }

    onCreate({ name: trimmed, category, icon, color });
  };

  const title = mode === "edit" ? "Edit Subcategory" : "Add Subcategory";
  const submitLabel = isLoading ? (mode === "edit" ? "Saving…" : "Creating…") : mode === "edit" ? "Save" : "Create";

  return (
    <PopupBox visible={visible} onClose={onClose} title={title} titleColor={COLORS.primary1}>
      <Input label="Subcategory name" placeholder="e.g. Morning Run" value={name} onChangeText={setName} type="text" />

      {/* Category picker – hidden when a category is already fixed by the parent */}
      {!fixedCategory && (
        <CategoryPicker value={category} onChange={(v: CategoryKey) => setCategory(v)} disabled={mode === "edit"} />
      )}

      <SubcategoryColorPicker label="Choose a color" value={color} onChange={setColor} />
      <SubcategoryIconPicker label="Choose an icon" value={icon} onChange={setIcon} selectedColor={color} />

      <View style={styles.buttonRow}>
        <AppButton title="Cancel" onPress={onClose} mode="light" color="lightGray" />
        <AppButton title={submitLabel} onPress={handleSubmit} mode="filled" color="primary6" disabled={isLoading} />
      </View>
    </PopupBox>
  );
}

const styles = StyleSheet.create({
  buttonRow: {
    marginTop: SPACING.md,
    marginBottom: SPACING.xlg,
    flexDirection: "row",
    justifyContent: "center",
    gap: SPACING.md,
  },
});
