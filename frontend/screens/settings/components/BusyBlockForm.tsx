import React from "react";
import { View, StyleSheet } from "react-native";
import AppText from "../../../components/common/AppText";
import Input from "../../../components/inputs/Input";
import AppButton from "../../../components/common/AppButton";
import { TimeRangePicker } from "../../../components/inputs/TimeRangePicker";
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
    <View style={styles.container}>
      <Input
        label="Title (optional)"
        placeholder="e.g. Morning workout"
        value={form.title}
        onChangeText={(v) => onField("title", v)}
        type="text"
        disabled={saving}
      />

      <View style={styles.timeSection}>
        <TimeRangePicker
          startTime={form.startTime}
          endTime={form.endTime}
          onStartChange={(v) => onField("startTime", v)}
          onEndChange={(v) => onField("endTime", v)}
          disabled={saving}
          color="primary1"
        />
      </View>

      {error ? <AppText style={styles.error}>{error}</AppText> : null}

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
  container: { gap: SPACING.sm },
  fieldLabel: { fontSize: FONT_SIZES.sm, color: COLORS.darkGray, marginBottom: 4, fontWeight: "400" },
  timeSection: { marginTop: SPACING.xs },
  buttonRow: { flexDirection: "row", gap: SPACING.md, marginTop: SPACING.sm, width: "100%" },
  error: { color: COLORS.primary7, marginTop: SPACING.sm },
});
