import React from "react";
import { View, StyleSheet } from "react-native";
import AppText from "../../../components/common/AppText";
import Input from "../../../components/inputs/Input";
import AppButton from "../../../components/common/AppButton";
import { COLORS, SPACING, FONT_SIZES } from "../../../theme";

export interface BlockFormState {
  title: string;
  startTime: string;
  endTime: string;
}

interface BusyBlockFormProps {
  form: BlockFormState;
  onField: <K extends keyof BlockFormState>(key: K, value: BlockFormState[K]) => void;
  saving: boolean;
  isEditing: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  error?: string | null;
}

export function BusyBlockForm({ form, onField, saving, isEditing, onCancel, onSubmit, error }: BusyBlockFormProps) {
  return (
    <View>
      <AppText style={styles.fieldLabel}>Title (optional)</AppText>
      <Input
        placeholder="e.g. Morning workout"
        value={form.title}
        onChangeText={(v) => onField("title", v)}
        type="text"
      />

      <AppText style={[styles.fieldLabel, { marginTop: SPACING.sm }]}>Start time (HH:MM)</AppText>
      <Input placeholder="09:00" value={form.startTime} onChangeText={(v) => onField("startTime", v)} type="text" />

      <AppText style={[styles.fieldLabel, { marginTop: SPACING.sm }]}>End time (HH:MM)</AppText>
      <Input placeholder="10:00" value={form.endTime} onChangeText={(v) => onField("endTime", v)} type="text" />

      {error && <AppText style={styles.error}>{error}</AppText>}

      <View style={styles.buttonRow}>
        <AppButton title="Cancel" mode="light" color="lightGray" onPress={onCancel} width="48%" disabled={saving} />
        <AppButton
          title={saving ? "Saving…" : isEditing ? "Update" : "Add"}
          mode="filled"
          color="primary1"
          onPress={onSubmit}
          width="48%"
          disabled={saving}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { fontSize: FONT_SIZES.sm, color: COLORS.darkGray, marginBottom: 4, fontWeight: "400" },
  buttonRow: { flexDirection: "row", gap: SPACING.md, marginTop: SPACING.lg, width: "100%" },
  error: { color: COLORS.primary7, marginTop: SPACING.sm },
});
