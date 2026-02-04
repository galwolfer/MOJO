import React, { useMemo } from "react";
import Input from "../inputs/Input";
import { CATEGORY_KEYS, getCategoryMeta, type CategoryKey } from "../../config/categoryMeta";
import { ICONS } from "../icons/icons";
import { ICON_SIZES } from "../../theme";

interface Props {
  value?: CategoryKey;
  onChange?: (value: CategoryKey) => void;
  label?: string;
}

export default function CategoryPicker({ value, onChange, label = "Parent category" }: Props) {
  const options = useMemo(() => {
    return CATEGORY_KEYS.map((key: CategoryKey) => {
      const m = getCategoryMeta(key);
      return {
        label: m.displayName || key,
        value: key,
        icon: ICONS[m.icon] || undefined,
        // Use the category color to tint the icon itself (no background box)
        iconColor: m.color || undefined,
        size: ICON_SIZES.xs,
      };
    });
  }, []);

  return (
    <Input
      label={label}
      options={options}
      value={value}
      onSelect={(vals: string[]) => {
        const v = vals && vals[0];
        if (v) onChange?.(v as CategoryKey);
      }}
    />
  );
}
