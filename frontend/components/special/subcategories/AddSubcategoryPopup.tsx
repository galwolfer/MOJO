import React, { useState } from "react";
import { View, Modal, Pressable, StyleSheet, Alert } from "react-native";
import AppText from "../../common/AppText";
import AppButton from "../../common/AppButton";
import Input from "../../inputs/Input";
import CategoryPicker from "../CategoryPicker";
import SubcategoryIconPicker from "./SubcategoryIconPicker";
import SubcategoryColorPicker from "./SubcategoryColorPicker";
import { COLORS, SPACING } from "../../../theme";
import PopupBox from "../../common/PopupBox";
import { type CategoryKey } from "../../../config/categoryMeta";

interface CategoryOption {
  value: CategoryKey;
  label: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreate: (payload: { name: string; category: CategoryKey; icon?: string | null; color?: string | null }) => void;
  categoryOptions: CategoryOption[]; // simple label/value list
}

export default function AddSubcategoryPopup({ visible, onClose, onCreate, categoryOptions }: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<CategoryKey>(
    categoryOptions?.[0]?.value || ("uncategorized" as CategoryKey),
  );
  const [icon, setIcon] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert("Validation Error", "Please enter a subcategory name.");
      return;
    }
    if (trimmed.toLowerCase() === "general") {
      Alert.alert("Validation Error", "'General' is reserved and cannot be created.");
      return;
    }

    onCreate({ name: trimmed, category, icon, color });
    // reset local state
    setName("");
    setIcon(null);
    setColor(null);
    onClose();
  };

  return (
    <PopupBox visible={visible} onClose={onClose} title="Add Subcategory" titleColor={COLORS.primary1}>
      <Input label="Subcategory name" placeholder="Subcategory name" value={name} onChangeText={setName} type="text" />

      <CategoryPicker value={category} onChange={(v: CategoryKey) => setCategory(v)} />

      <SubcategoryIconPicker label="Choose an icon" value={icon} onChange={setIcon} />
      <SubcategoryColorPicker label="Choose a color" value={color} onChange={setColor} />

      <View style={styles.buttonRow}>
        <AppButton title="Cancel" onPress={onClose} mode="light" color="lightGray" />
        <AppButton title="Create" onPress={handleCreate} mode="filled" color="primary6" />
      </View>
    </PopupBox>
  );
}

const styles = StyleSheet.create({
  buttonRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: SPACING.md,
  },
});
