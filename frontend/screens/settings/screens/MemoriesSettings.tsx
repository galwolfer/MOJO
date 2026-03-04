/**
 * MemoriesSettingsScreen
 *
 * Lets users view, add, edit, and delete their personal memories
 * that the Ojo LLM uses for context.
 */
import React, { useState, useEffect } from "react";
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, Alert } from "react-native";
import { COLORS, SPACING, FONT_SIZES, ICON_SIZES } from "../../../theme";
import { useColors } from "../../../context/ThemeContext";
import { ICONS } from "../../../components/icons/icons";
import { moderateScale } from "react-native-size-matters";
import SettingsSubScreen from "./components/SettingsSubScreen";
import AppText from "../../../components/common/AppText";
import AppButton from "../../../components/common/AppButton";
import Box from "../../../components/layout/Box";
import List, { type ListCellProps } from "../../../components/layout/List";
import { makeListCell } from "../../../components/layout/ListItem";
import ErrorText from "../../../components/common/ErrorText";
import { getMemories, addMemory, updateMemory, deleteMemory, type Memory } from "../../../services/memoryService";

type MemoriesSettingsScreenProps = {
  onBack: () => void;
};

export default function MemoriesSettingsScreen({ onBack }: MemoriesSettingsScreenProps) {
  const colors = useColors();

  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [memoriesSaving, setMemoriesSaving] = useState<Record<string, boolean>>({});

  const [addingNew, setAddingNew] = useState(false);
  const [newMemoryText, setNewMemoryText] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await getMemories();
        setMemories(data);
      } catch (err: any) {
        setError("Failed to load memories.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleStartEdit = (memory: Memory) => {
    setEditingId(memory.id);
    setEditText(memory.text);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const handleSaveEdit = async (memoryId: string) => {
    const trimmed = editText.trim();
    if (!trimmed) return;
    try {
      setMemoriesSaving((s) => ({ ...s, [memoryId]: true }));
      const updated = await updateMemory(memoryId, trimmed);
      setMemories((prev) => prev.map((m) => (m.id === memoryId ? { ...m, text: updated.text } : m)));
      setEditingId(null);
      setEditText("");
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to update memory.");
    } finally {
      setMemoriesSaving((s) => ({ ...s, [memoryId]: false }));
    }
  };

  const handleDeleteMemory = (memoryId: string) => {
    Alert.alert("Delete Memory", "Are you sure you want to delete this memory?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setMemoriesSaving((s) => ({ ...s, [memoryId]: true }));
            await deleteMemory(memoryId);
            setMemories((prev) => prev.filter((m) => m.id !== memoryId));
          } catch (err: any) {
            Alert.alert("Error", err?.message || "Failed to delete memory.");
          } finally {
            setMemoriesSaving((s) => {
              const next = { ...s };
              delete next[memoryId];
              return next;
            });
          }
        },
      },
    ]);
  };

  const handleAddMemory = async () => {
    const trimmed = newMemoryText.trim();
    if (!trimmed) return;
    try {
      setMemoriesSaving((s) => ({ ...s, __new__: true }));
      const created = await addMemory(trimmed);
      setMemories((prev) => [created, ...prev]);
      setNewMemoryText("");
      setAddingNew(false);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to add memory.");
    } finally {
      setMemoriesSaving((s) => {
        const next = { ...s };
        delete next.__new__;
        return next;
      });
    }
  };

  // ── Build List data ────────────────────────────────────────────────────────

  const EditIcon = ICONS.edit;
  const DeleteIcon = ICONS.trash;
  const CheckIcon = ICONS.check;
  const CancelIcon = ICONS.cancel;
  const BulletIcon = ICONS.list;

  const listData: ListCellProps[] = memories.map((memory, idx) => {
    const isEditing = editingId === memory.id;
    const isSaving = !!memoriesSaving[memory.id];
    const isLast = idx === memories.length - 1 && !addingNew;

    if (isEditing) {
      return {
        id: memory.id,
        divider: !isLast,
        content: (
          <View style={styles.editRow}>
            <TextInput
              style={[
                styles.editInput,
                { color: colors.text1, borderColor: COLORS.primary1, backgroundColor: colors.bg2 },
              ]}
              value={editText}
              onChangeText={setEditText}
              multiline
              autoFocus
              placeholderTextColor={colors.gray2}
            />
            <View style={styles.editActions}>
              <TouchableOpacity onPress={() => handleSaveEdit(memory.id)} disabled={isSaving} style={styles.actionBtn}>
                {isSaving ? (
                  <ActivityIndicator size="small" color={COLORS.primary1} />
                ) : (
                  <CheckIcon size={ICON_SIZES.sm} color={COLORS.primary6} />
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCancelEdit} style={styles.actionBtn}>
                <CancelIcon size={ICON_SIZES.sm} color={colors.primary7} />
              </TouchableOpacity>
            </View>
          </View>
        ),
      };
    }

    return makeListCell(memory.id, {
      title: memory.text,
      divider: !isLast,
      rightElement: (
        <View style={styles.rowActions}>
          <TouchableOpacity onPress={() => handleStartEdit(memory)} disabled={isSaving} style={styles.actionBtn}>
            <EditIcon size={ICON_SIZES.xs} color={COLORS.primary1} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDeleteMemory(memory.id)} disabled={isSaving} style={styles.actionBtn}>
            {isSaving ? (
              <ActivityIndicator size="small" color={COLORS.primary5} />
            ) : (
              <DeleteIcon size={ICON_SIZES.xs} color={COLORS.primary7} />
            )}
          </TouchableOpacity>
        </View>
      ),
    });
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SettingsSubScreen title="Your Memories" iconName="reflection" scrollKey="memories-settings" onBack={onBack}>
      {error && <ErrorText>{error}</ErrorText>}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary1} />
        </View>
      ) : (
        <Box>
          <View style={styles.boxContent}>
            <AppText variant="bodyText">
              These are facts your Ojo remembers about you. Edit or delete any entry, or add new ones.
            </AppText>

            {memories.length === 0 && !addingNew ? (
              <AppText variant="notes" style={[styles.empty, { color: colors.gray2 }]}>
                No memories yet. Add one below!
              </AppText>
            ) : (
              <View style={styles.listWrap}>
                <List data={listData} />
              </View>
            )}

            {/* Add new memory form */}
            {addingNew && (
              <View style={[styles.addRow, { borderColor: COLORS.primary1 }]}>
                <TextInput
                  style={[
                    styles.editInput,
                    { color: colors.text1, borderColor: COLORS.primary1, backgroundColor: colors.bg2 },
                  ]}
                  value={newMemoryText}
                  onChangeText={setNewMemoryText}
                  multiline
                  autoFocus
                  placeholder="Enter a new memory..."
                  placeholderTextColor={colors.gray2}
                />
                <View style={styles.editActions}>
                  <TouchableOpacity
                    onPress={handleAddMemory}
                    disabled={!!memoriesSaving.__new__}
                    style={styles.actionBtn}
                  >
                    {memoriesSaving.__new__ ? (
                      <ActivityIndicator size="small" color={COLORS.primary1} />
                    ) : (
                      <CheckIcon size={ICON_SIZES.sm} color={COLORS.primary6} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setAddingNew(false);
                      setNewMemoryText("");
                    }}
                    style={styles.actionBtn}
                  >
                    <CancelIcon size={ICON_SIZES.sm} color={colors.primary7} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {!addingNew && <AppButton title="Add Memory" onPress={() => setAddingNew(true)} color="primary6" />}
          </View>
        </Box>
      )}
    </SettingsSubScreen>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    padding: SPACING.xlg,
    alignItems: "center",
  },
  boxContent: {
    width: "100%",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    gap: SPACING.sm,
  },

  empty: {
    textAlign: "center",
    marginVertical: SPACING.md,
  },
  listWrap: {
    width: "100%",
  },
  // Edit row
  editRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    width: "100%",
  },
  editInput: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    lineHeight: FONT_SIZES.base * 1.4,
    borderWidth: 1,
    borderRadius: moderateScale(8),
    padding: SPACING.sm,
    minHeight: moderateScale(60),
    textAlignVertical: "top",
  },
  editActions: {
    flexDirection: "column",
    alignItems: "center",
    gap: SPACING.xs,
    paddingTop: 2,
  },
  rowActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  actionBtn: {
    padding: SPACING.xs,
    borderRadius: moderateScale(8),
    minWidth: moderateScale(32),
    alignItems: "center",
    justifyContent: "center",
  },
  addRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: moderateScale(12),
    padding: SPACING.sm,
  },
});
