import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from "react-native";
import Input from "../../../components/inputs/Input";
import { ICONS } from "../../../components/icons/icons";
import { COLORS, FONT_SIZES, SHADOWS, SPACING } from "../../../theme";

type ChatComposerProps = {
  isLoading: boolean;
  onSend: (text: string) => void;
};

export default function ChatComposer({ isLoading, onSend }: ChatComposerProps) {
  const [draft, setDraft] = useState("");

  const canSend = useMemo(() => Boolean(draft.trim()) && !isLoading, [draft, isLoading]);

  const handleSend = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setDraft("");
  }, [draft, isLoading, onSend]);

  return (
    <View style={styles.inputContainer}>
      <View style={{ flex: 1 }}>
        <Input
          placeholder="Type a message..."
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          editable={!isLoading}
          enterToSubmit
          multiline
        />
      </View>
      <TouchableOpacity
        style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
        onPress={handleSend}
        disabled={!canSend}
        activeOpacity={0.7}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={COLORS.colorWhite} />
        ) : (
          <ICONS.send size={FONT_SIZES.base} color={COLORS.colorWhite} />
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
    minHeight: FONT_SIZES.base * 3.5,
  },
  sendButton: {
    width: FONT_SIZES.base * 2.5 + 1.5,
    height: FONT_SIZES.base * 2.5 + 1.5,
    borderRadius: FONT_SIZES.base,
    backgroundColor: COLORS.primary1,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.card,
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.lightGray,
  },
});
