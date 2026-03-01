/**
 * SubcategoryPicker
 *
 * A dropdown picker for subcategories that mirrors the visual style of
 * CategoryPicker. Each option shows a colored icon badge (the subcategory's
 * own icon/color, or the parent category's icon/color for system defaults).
 *
 * Includes an "Add subcategory" option at the bottom of the list that opens
 * an inline popup to create a new subcategory for the current category.
 *
 * Usage:
 *   <SubcategoryPicker
 *     subcategories={subcategories}
 *     value={subCategoryId}
 *     onSelect={(id) => ...}
 *     onSubcategoryCreated={(newSub) => ...}
 *     category="workout"
 *   />
 */

import React, { useMemo, useState } from "react";
import { Alert } from "react-native";
import Input from "../inputs/Input";
import AddSubcategoryPopup from "./AddSubcategoryPopup";
import { COLORS, ICON_SIZES } from "../../theme";
import { ICONS } from "../icons/icons";
import { getCategoryMeta, type CategoryKey } from "../../config/categoryMeta";
import { createSubcategory, type Subcategory } from "../../services/subcategoryService";

// ── Helpers ──────────────────────────────────────────────────────────────────

const PRIMARY_COLORS = [
  COLORS.primary1,
  COLORS.primary2,
  COLORS.primary3,
  COLORS.primary4,
  COLORS.primary5,
  COLORS.primary6,
  COLORS.primary7,
];

/** Deterministic color based on the subcategory name (same algorithm as SubcategoryManager). */
function getAutoColor(name: string): string {
  const normalized = (name || "").trim().toLowerCase();
  if (!normalized) return PRIMARY_COLORS[0];
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 31 + normalized.charCodeAt(i)) | 0;
  }
  return PRIMARY_COLORS[Math.abs(hash) % PRIMARY_COLORS.length];
}

// Sentinel value used to distinguish the "Add subcategory" row from real IDs
const ADD_SENTINEL = "__add_new_subcategory__";

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  subcategories: Subcategory[];
  /** Currently selected subcategory id, or null */
  value: string | null;
  onSelect: (id: string | null) => void;
  /** Called after a new subcategory is successfully created so parent can refresh the list */
  onSubcategoryCreated?: (newSub: Subcategory) => void;
  /** Parent category key – used to resolve the icon/color for system defaults */
  category?: string;
  label?: string;
  disabled?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SubcategoryPicker({
  subcategories,
  value,
  onSelect,
  onSubcategoryCreated,
  category,
  label = "Subcategory",
  disabled,
}: Props) {
  const categoryMeta = useMemo(() => (category ? getCategoryMeta(category) : null), [category]);

  // ── Popup state ────────────────────────────────────────────────────────────
  const [showPopup, setShowPopup] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // ── Options list ──────────────────────────────────────────────────────────
  const options = useMemo(() => {
    const PlusIcon = ICONS.plus;
    const subcatOptions = subcategories.map((sub) => {
      const isDefault = sub.source === "category-default";

      // Icon: system defaults use the category icon; user subcategories use their own
      const iconKey = isDefault ? categoryMeta?.icon : sub.icon && ICONS[sub.icon] ? sub.icon : null;
      const IconComponent = iconKey && ICONS[iconKey] ? ICONS[iconKey] : ICONS.default;

      // color for the icon itself: category color for defaults, subcategory color (or auto) for user ones
      const iconColor = isDefault
        ? (categoryMeta?.color ?? getAutoColor(sub.name))
        : (sub.color ?? getAutoColor(sub.name));

      return {
        label: sub.name,
        value: sub.id,
        icon: IconComponent,
        iconColor: iconColor,
        size: ICON_SIZES.xs,
      };
    });

    // "Add subcategory" entry at the bottom
    subcatOptions.push({
      label: "Add subcategory",
      value: ADD_SENTINEL,
      icon: PlusIcon,
      iconColor: COLORS.primary1,
      size: ICON_SIZES.xs,
    });

    return subcatOptions;
  }, [subcategories, categoryMeta]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSelect = (vals: string[]) => {
    const v = vals?.[0] ?? null;
    if (v === ADD_SENTINEL) {
      // Don't update the selected value; open the creation popup instead
      setShowPopup(true);
      return;
    }
    onSelect(v);
  };

  const handleCreate = async (payload: {
    name: string;
    category: CategoryKey;
    icon?: string | null;
    color?: string | null;
  }) => {
    if (!category) {
      Alert.alert("Error", "No category selected. Please select a category first.");
      return;
    }
    setIsCreating(true);
    try {
      const newSub = await createSubcategory({
        name: payload.name,
        category,
        icon: payload.icon ?? null,
        color: payload.color ?? getAutoColor(payload.name),
      });
      if (newSub) {
        onSubcategoryCreated?.(newSub);
        onSelect(newSub.id);
      }
      setShowPopup(false);
    } catch {
      Alert.alert("Error", "Failed to create subcategory. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const isEmpty = subcategories.length === 0;

  return (
    <>
      <Input
        label={label}
        placeholder={isEmpty ? "Select or add a subcategory" : "Select subcategory"}
        options={options}
        value={value ?? undefined}
        onSelect={handleSelect}
        disabled={disabled}
      />

      {/* Inline "Add subcategory" popup – category is fixed, no picker shown */}
      <AddSubcategoryPopup
        visible={showPopup}
        onClose={() => setShowPopup(false)}
        onCreate={handleCreate}
        fixedCategory={category as CategoryKey}
        isLoading={isCreating}
      />
    </>
  );
}
