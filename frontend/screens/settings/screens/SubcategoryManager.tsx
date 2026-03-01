import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import AppText from "../../../components/common/AppText";
import AppButton from "../../../components/common/AppButton";
import Input from "../../../components/inputs/Input";
import Box from "../../../components/layout/Box";
import ScrollableContent from "../../../components/layout/ScrollableContent";
import ErrorText from "../../../components/common/ErrorText";
import PopupBox from "../../../components/common/PopupBox";
import SubcategoryIconPicker from "../../../components/special/IconPicker";
import SubcategoryColorPicker from "../../../components/special/ColorPicker";
import { ICONS } from "../../../components/icons/icons";
import { COLORS, SPACING, SHADOWS, ICON_SIZES, FONT_SIZES } from "../../../theme";
import { useColors } from "../../../context/ThemeContext";
import AddSubcategoryPopup from "../../../components/special/AddSubcategoryPopup";
import FloatingButton from "../../../components/common/FloatingButton";
import { CATEGORY_KEYS, getCategoryMeta, type CategoryKey } from "../../../config/categoryMeta";
import { useNavigation } from "../../../context/NavigationContext";
import { useAuth } from "../../../context/AuthContext";
import {
  fetchAllSubcategories,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
  type Subcategory,
  type SubcategoriesByCategory,
} from "../../../services/subcategoryService";
import { setAuthToken } from "../../../services/httpClient";
import { moderateScale } from "react-native-size-matters";

const PRIMARY_COLORS = [
  COLORS.primary1,
  COLORS.primary2,
  COLORS.primary3,
  COLORS.primary4,
  COLORS.primary5,
  COLORS.primary6,
  COLORS.primary7,
];

type SubcategoryManagerProps = {
  onBack: () => void;
};

function normalizeName(value: string) {
  return value.trim();
}

function getAutoColor(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return PRIMARY_COLORS[Math.floor(Math.random() * PRIMARY_COLORS.length)];
  }
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 31 + normalized.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % PRIMARY_COLORS.length;
  return PRIMARY_COLORS[idx];
}

function sortSubcategories(subs: Subcategory[]) {
  return [...subs].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

function updateCategoryMap(
  prev: SubcategoriesByCategory,
  categoryKey: string,
  nextList: Subcategory[],
): SubcategoriesByCategory {
  return {
    ...prev,
    [categoryKey]: sortSubcategories(nextList),
  };
}

export default function SubcategoryManager({ onBack }: SubcategoryManagerProps) {
  const colors = useColors();
  const { setHeaderConfig } = useNavigation();
  const { token, isLoading: authLoading } = useAuth();
  const onBackRef = useRef(onBack);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [subcategoriesByCategory, setSubcategoriesByCategory] = useState<SubcategoriesByCategory>({});
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, Partial<Subcategory>>>(new Map());
  const [pendingCreates, setPendingCreates] = useState<
    Array<{ name: string; category: CategoryKey; icon?: string | null; color?: string | null }>
  >([]);

  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [showEditPopup, setShowEditPopup] = useState(false);

  const ListIcon = ICONS.list;
  const LeftIcon = ICONS.left;
  const EditIcon = ICONS.edit;
  const TrashIcon = ICONS.trash;
  const DefaultIcon = ICONS.default;

  const categoryOptions = useMemo(
    () =>
      CATEGORY_KEYS.map((key) => {
        const meta = getCategoryMeta(key);
        return {
          value: key,
          label: meta.displayName || key,
          icon: ICONS[meta.icon],
          iconBackground: meta.color,
          iconColor: COLORS.white,
        };
      }),
    [],
  );

  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    setHeaderConfig({
      title: "Subcategories",
      show: true,
      icon: ICONS.list,
      leftElement: (
        <TouchableOpacity onPress={() => onBackRef.current()} style={styles.headerRightTouchable}>
          <LeftIcon size={ICON_SIZES.sm} color={COLORS.primary1} />
        </TouchableOpacity>
      ),
      rightElement: (
        <View style={styles.headerLeft}>
          <ListIcon size={ICON_SIZES.sm} color={COLORS.primary1} />
        </View>
      ),
    });
  }, [setHeaderConfig, ListIcon, LeftIcon]);

  // Add Subcategory popup state
  const [showAddPopup, setShowAddPopup] = useState(false);

  const openAddPopup = () => setShowAddPopup(true);
  const closeAddPopup = () => setShowAddPopup(false);

  // Handler to create a staged subcategory from the popup
  const createFromPopup = (payload: {
    name: string;
    category: CategoryKey;
    icon?: string | null;
    color?: string | null;
  }) => {
    const trimmed = payload.name.trim();
    if (!trimmed) return;
    const resolvedColor = payload.color || getAutoColor(trimmed);

    setPendingCreates((prev) => [
      ...prev,
      { name: trimmed, category: payload.category, icon: payload.icon, color: resolvedColor },
    ]);

    const tempId = `temp_${Date.now()}_${Math.random()}`;
    const tempSubcategory: Subcategory = {
      id: tempId,
      name: trimmed,
      parent: payload.category,
      icon: payload.icon || undefined,
      color: resolvedColor,
    };

    setSubcategoriesByCategory((prev) => {
      const existing = prev[payload.category] || [];
      return updateCategoryMap(prev, payload.category, [...existing, tempSubcategory]);
    });
  };

  const loadSubcategories = async () => {
    try {
      setLoading(true);
      setError(null);
      if (token) {
        setAuthToken(token);
      }
      const data = await fetchAllSubcategories();
      setSubcategoriesByCategory(data);
    } catch (err: any) {
      console.error("Failed to load subcategories:", err);
      setError("Failed to load subcategories. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (token) {
      setAuthToken(token);
    }
    loadSubcategories();
  }, [authLoading, token]);

  const handleEdit = (subcategory: Subcategory) => {
    setEditingSubcategory(subcategory);
    setShowEditPopup(true);
  };

  const handleCloseEditPopup = () => {
    setEditingSubcategory(null);
    setShowEditPopup(false);
  };

  const handleStageEdit = (payload: {
    name: string;
    category: CategoryKey;
    icon?: string | null;
    color?: string | null;
  }) => {
    if (!editingSubcategory) return;

    const trimmed = payload.name.trim();
    const resolvedColor = payload.color || getAutoColor(trimmed);

    setPendingUpdates((prev) => {
      const next = new Map(prev);
      next.set(editingSubcategory.id, {
        name: trimmed,
        icon: payload.icon,
        color: resolvedColor,
      });
      return next;
    });

    // Update UI optimistically
    setSubcategoriesByCategory((prev) => {
      const parent = editingSubcategory.parent;
      const list = prev[parent] || [];
      const next = list.map((item) =>
        item.id === editingSubcategory.id ? { ...item, name: trimmed, icon: payload.icon, color: resolvedColor } : item,
      );
      return updateCategoryMap(prev, parent, next);
    });

    handleCloseEditPopup();
  };

  const handleStageDelete = (subcategory: Subcategory) => {
    setPendingDeletes((prev) => new Set(prev).add(subcategory.id));

    // Remove from UI immediately
    setSubcategoriesByCategory((prev) => {
      const parent = subcategory.parent;
      const list = prev[parent] || [];
      const next = list.filter((item) => item.id !== subcategory.id);
      const updated = { ...prev };
      if (next.length > 0) {
        updated[parent] = next;
      } else {
        delete updated[parent];
      }
      return updated;
    });
  };

  const [saveResult, setSaveResult] = useState<{ title: string; message: string } | null>(null);

  const handleSaveAll = async () => {
    try {
      setSaving(true);
      if (token) {
        setAuthToken(token);
      }

      // Process deletes first
      for (const id of pendingDeletes) {
        if (!id.startsWith("temp_")) {
          await deleteSubcategory(id);
        }
      }

      // Process updates
      for (const [id, updates] of pendingUpdates) {
        if (!id.startsWith("temp_")) {
          await updateSubcategory(id, updates);
        }
      }

      // Process creates
      for (const newSub of pendingCreates) {
        await createSubcategory(newSub);
      }

      // Clear all pending changes
      setPendingDeletes(new Set());
      setPendingUpdates(new Map());
      setPendingCreates([]);

      // Reload from server to get fresh data
      await loadSubcategories();

      setSaveResult({ title: "Success", message: "All changes saved successfully!" });
    } catch (err: any) {
      console.error("Failed to save changes:", err);
      setSaveResult({ title: "Error", message: err?.message || "Failed to save changes" });
    } finally {
      setSaving(false);
    }
  };

  const handleDiscardAll = () => {
    Alert.alert("Discard Changes", "Are you sure you want to discard all unsaved changes?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => {
          setPendingDeletes(new Set());
          setPendingUpdates(new Map());
          setPendingCreates([]);
          loadSubcategories();
        },
      },
    ]);
  };

  const hasPendingChanges = pendingDeletes.size > 0 || pendingUpdates.size > 0 || pendingCreates.length > 0;

  // Filter out system-wide "General" subcategories from the manager UI
  const filteredSubcategoriesByCategory: SubcategoriesByCategory = React.useMemo(() => {
    const result: SubcategoriesByCategory = {};
    for (const key of CATEGORY_KEYS) {
      const list = (subcategoriesByCategory[key] || []).filter(
        (s) => !(s.source === "category-default" || (s.name && s.name === "General")),
      );
      if (list.length > 0) result[key] = list;
    }
    return result;
  }, [subcategoriesByCategory]);

  const categoriesWithSubs = CATEGORY_KEYS.filter((key) => (filteredSubcategoriesByCategory[key] || []).length > 0);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary1} />
        <AppText variant="bodyText" style={styles.loadingText}>
          Loading subcategories...
        </AppText>
      </View>
    );
  }

  return (
    <>
      <ScrollableContent
        respectHeader={true}
        respectNavBar={true}
        extraTopPadding={SPACING.lg}
        scrollKey="subcategory-manager"
        extraBottomPadding={SPACING.xlg * 3}
        contentContainerStyle={styles.contentContainer}
      >
        {error && (
          <View style={styles.errorBlock}>
            <ErrorText>{error}</ErrorText>
            <AppButton title="Retry" onPress={loadSubcategories} mode="light" color="lightGray" />
          </View>
        )}

        {hasPendingChanges && (
          <Box title="Pending Changes">
            <AppText style={styles.pendingText}>You have unsaved changes. Click "Save All" to apply them.</AppText>
            <View style={styles.buttonRow}>
              <AppButton title="Discard All" onPress={handleDiscardAll} mode="light" color="lightGray" icon="cancel" />
              <AppButton
                title="Save All"
                onPress={handleSaveAll}
                mode="filled"
                color="primary6"
                icon="check"
                disabled={saving}
              />
            </View>
          </Box>
        )}

        {/* Global add popup (opens from FloatingButton) */}
        <AddSubcategoryPopup visible={showAddPopup} onClose={closeAddPopup} onCreate={createFromPopup} />

        {/* Edit popup */}
        <AddSubcategoryPopup
          visible={showEditPopup}
          onClose={handleCloseEditPopup}
          onCreate={handleStageEdit}
          mode="edit"
          initialData={
            editingSubcategory
              ? {
                  name: editingSubcategory.name || "",
                  category: editingSubcategory.parent,
                  icon: editingSubcategory.icon || null,
                  color: editingSubcategory.color || null,
                }
              : undefined
          }
        />

        {categoriesWithSubs.length === 0 ? (
          <Box title="Your Subcategories" titleColor={COLORS.primary1}>
            <AppText style={[styles.emptyText, { color: colors.gray1 }]}>No subcategories yet.</AppText>
          </Box>
        ) : (
          categoriesWithSubs.map((categoryKey) => {
            const meta = getCategoryMeta(categoryKey);
            const subs = filteredSubcategoriesByCategory[categoryKey] || [];
            return (
              <Box key={categoryKey} title={meta.displayName || categoryKey} titleColor={COLORS.primary1}>
                {subs.map((subcategory) => {
                  const isDefault =
                    subcategory.isDefault ||
                    subcategory.source === "category-default" ||
                    subcategory.name === "General";
                  const Icon = isDefault
                    ? ICONS[meta.icon] || DefaultIcon
                    : subcategory.icon && ICONS[subcategory.icon]
                      ? ICONS[subcategory.icon]
                      : DefaultIcon;
                  const displayColor = subcategory.color || getAutoColor(subcategory.name || "");
                  return (
                    <View key={subcategory.id} style={[styles.subcategoryRow, { borderBottomColor: colors.bg2 }]}>
                      <View style={styles.subcategoryInfo}>
                        <Icon size={ICON_SIZES.xs} color={displayColor} />
                        <View style={styles.subcategoryNameContainer}>
                          <AppText style={[styles.subcategoryName, { color: colors.text1 }]}>
                            {subcategory.name}
                          </AppText>
                          {isDefault && (
                            <AppText style={[styles.defaultBadge, { color: colors.text2 }]}>Default</AppText>
                          )}
                        </View>
                      </View>
                      <View style={styles.subcategoryActions}>
                        {!isDefault && (
                          <>
                            <TouchableOpacity onPress={() => handleEdit(subcategory)} style={[styles.actionButton]}>
                              <EditIcon size={ICON_SIZES.xs} color={colors.gray1} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleStageDelete(subcategory)}
                              style={[styles.actionButton]}
                            >
                              <TrashIcon size={ICON_SIZES.xs} color={colors.gray1} />
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    </View>
                  );
                })}
              </Box>
            );
          })
        )}
        <PopupBox
          visible={!!saveResult}
          onClose={() => setSaveResult(null)}
          title={saveResult?.title}
          titleColor={saveResult?.title === "Success" ? COLORS.primary1 : COLORS.primary6}
        >
          <AppText>{saveResult?.message}</AppText>
          <View style={{ marginTop: SPACING.md }}>
            <AppButton title="OK" onPress={() => setSaveResult(null)} />
          </View>
        </PopupBox>
      </ScrollableContent>

      {/* Floating Add Subcategory button (replaces header + icon) */}
      <FloatingButton onPress={openAddPopup} text="Add Subcategory" Icon={ICONS.plus} />
    </>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    alignItems: "center",
    gap: SPACING.lg,
  },
  formField: {
    marginBottom: SPACING.md,
  },
  label: {
    fontWeight: "400",
    marginBottom: 4,
  },
  buttonRow: {
    flexDirection: "row",
    gap: SPACING.md,
    justifyContent: "center",
  },
  subcategoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  subcategoryInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
  },
  subcategoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  subcategoryNameContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    flex: 1,
  },
  subcategoryName: {
    fontSize: FONT_SIZES.md,
  },
  defaultBadge: {
    fontSize: FONT_SIZES.sm,
    backgroundColor: COLORS.primary3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  subcategoryActions: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    textAlign: "center",
    paddingVertical: SPACING.md,
  },
  pendingText: {
    textAlign: "center",
    paddingVertical: SPACING.md,
    fontWeight: "500",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: SPACING.sm,
    color: COLORS.primary1,
  },
  errorBlock: {
    width: "100%",
    gap: SPACING.sm,
    alignItems: "center",
  },
  headerRightTouchable: {
    width: moderateScale(44),
    height: moderateScale(44),
    alignItems: "center",
    justifyContent: "center",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
});
