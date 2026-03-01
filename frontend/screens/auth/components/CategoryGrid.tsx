/**
 * CategoryGrid
 *
 * A modular 3x6 grid component displaying all categories as circular icons
 * with labels. Each category can be clicked to trigger an action.
 *
 * Displays categories in the order specified in CATEGORY_KEYS from categoryMeta.
 */
import React, { useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  Animated,
  Pressable,
  Easing,
  LayoutAnimation,
  UIManager,
  Platform,
} from "react-native";
import AppText from "../../../components/common/AppText";
import GridEntranceItem from "../../../components/common/animations/GridEntranceItem";
import { CATEGORY_KEYS, getCategoryMeta, CategoryKey } from "../../../config/categoryMeta";
import { ICONS } from "../../../components/icons/icons";
import { COLORS, SPACING, FONT_SIZES } from "../../../theme";
import { useColors } from "../../../context/ThemeContext";
import Box from "../../../components/layout/Box";
import SliderComponent from "../../../components/inputs/Slider";

// Entrance animation defaults
const DEFAULT_ENTRANCE = {
  enabled: false,
  baseDelay: 120, // ms before first item
  stagger: 80, // ms per grid step (rowIndex + colIndex)
  duration: 300, // duration of each item's scale/opacity animation
};

type CategoryGridProps = {
  onCategoryPress: (categoryKey: CategoryKey) => void;
  selectedCategory?: CategoryKey | null;
  priorities?: Record<string, number>;
  onPriorityChange?: (categoryKey: CategoryKey, value: number) => void;
  // Entrance animation controls
  entranceEnabled?: boolean; // enable the grid entrance animation
  entranceBaseDelay?: number; // ms base delay override
  entranceStagger?: number; // ms stagger override per grid step
  entranceDuration?: number; // ms duration override for each item's animation
};

const CategoryGrid: React.FC<CategoryGridProps> = ({
  onCategoryPress,
  selectedCategory,
  priorities,
  onPriorityChange,
  entranceEnabled = false,
  entranceBaseDelay,
  entranceStagger,
  entranceDuration,
}) => {
  const colors = useColors();
  const { width } = Dimensions.get("window");
  const iconSize = Math.min(width * 0.18, 60); // responsive icon size

  const baseDelay = typeof entranceBaseDelay === "number" ? entranceBaseDelay : DEFAULT_ENTRANCE.baseDelay;
  const stagger = typeof entranceStagger === "number" ? entranceStagger : DEFAULT_ENTRANCE.stagger;
  const duration = typeof entranceDuration === "number" ? entranceDuration : DEFAULT_ENTRANCE.duration;
  const enabled = entranceEnabled || DEFAULT_ENTRANCE.enabled;

  // Track which items have already run their entrance animation during this session
  const animatedSetRef = useRef<Set<string>>(new Set());

  // On Android enable LayoutAnimation support if available
  useEffect(() => {
    // LayoutAnimation is enabled by default in newer React Native versions
  }, []);

  const CategoryItem: React.FC<{
    categoryKey: CategoryKey;
    meta: ReturnType<typeof getCategoryMeta>;
    IconComponent: React.FC<any> | null;
    isSelected: boolean;
  }> = ({ categoryKey, meta, IconComponent, isSelected }) => {
    const scale = useRef(new Animated.Value(isSelected ? 1.1 : 1)).current;

    useEffect(() => {
      // Animate scale when selection changes
      Animated.timing(scale, {
        toValue: isSelected ? 1.1 : 1,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }, [isSelected, scale]);

    return (
      <Pressable
        key={categoryKey}
        onPress={() => onCategoryPress(categoryKey)}
        android_ripple={{ color: colors.text1 }}
        style={{ alignItems: "center", justifyContent: "center", width: "100%" }}
      >
        <Animated.View
          style={[
            styles.iconCircle,
            {
              width: iconSize,
              height: iconSize,
              borderRadius: iconSize / 2,
              backgroundColor: meta.color,
              transform: [{ scale }],
            },
          ]}
        >
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              width: "100%",
              height: "100%",
            }}
          >
            {IconComponent && <IconComponent size={iconSize * 0.5} color={colors.text2} />}
          </View>
        </Animated.View>

        <AppText variant="notes" style={{ textAlign: "center" }} numberOfLines={2}>
          {meta.displayName}
        </AppText>
      </Pressable>
    );
  }; // Build rows of 3 items so we can insert the priority Box right after
  const cols = 3;
  const rows: CategoryKey[][] = [];
  for (let i = 0; i < CATEGORY_KEYS.length; i += cols) rows.push(CATEGORY_KEYS.slice(i, i + cols) as CategoryKey[]);

  const RowBox: React.FC<{ rowIndex: number; visible?: boolean; children: React.ReactNode }> = ({
    rowIndex,
    visible = false,
    children,
  }) => {
    return <View style={styles.rowBoxWrapper}>{children}</View>;
  };

  return (
    <View style={styles.grid}>
      {rows.map((rowKeys, rowIndex) => {
        const rowHasSelected = rowKeys.some((k) => k === selectedCategory);
        return (
          <React.Fragment key={rowIndex}>
            <View style={styles.row}>
              {rowKeys.map((categoryKey, colIndex) => {
                const meta = getCategoryMeta(categoryKey);
                const IconComponent = ICONS[meta.icon] as React.FC<any> | null;
                const isSelected = selectedCategory === categoryKey;

                return (
                  <GridEntranceItem
                    key={categoryKey}
                    id={categoryKey}
                    rowIndex={rowIndex}
                    colIndex={colIndex}
                    enabled={enabled}
                    baseDelay={baseDelay}
                    stagger={stagger}
                    duration={duration}
                    animatedSetRef={animatedSetRef}
                    style={styles.categoryItem}
                  >
                    <CategoryItem
                      categoryKey={categoryKey as CategoryKey}
                      meta={meta}
                      IconComponent={IconComponent}
                      isSelected={isSelected}
                    />
                  </GridEntranceItem>
                );
              })}
            </View>

            <RowBox rowIndex={rowIndex} visible={rowHasSelected}>
              {rowHasSelected && selectedCategory
                ? (() => {
                    const selMeta = getCategoryMeta(selectedCategory);
                    const SelIcon = (ICONS[selMeta.icon] as React.FC<any>) || null;
                    return (
                      <Box
                        title={selMeta.displayName?.toUpperCase()}
                        titleColor={selMeta.color}
                        titleIcon={SelIcon ? <SelIcon size={FONT_SIZES.md} color={colors.text2} /> : undefined}
                      >
                        <AppText variant="bodyText" style={{ textAlign: "center", marginBottom: SPACING.md }}>
                          {`Set how much it important to you. (1 = Low, 5 = High)`}
                        </AppText>
                        <SliderComponent
                          style={{ paddingHorizontal: SPACING.md }}
                          value={
                            priorities && typeof priorities[selectedCategory] === "number"
                              ? priorities[selectedCategory]
                              : 3
                          }
                          onValueChange={(val: number) =>
                            onPriorityChange && onPriorityChange(selectedCategory as CategoryKey, val)
                          }
                          min={1}
                          max={5}
                          step={1}
                          TrackThumbColor={selMeta.color}
                        />
                      </Box>
                    );
                  })()
                : null}
            </RowBox>
          </React.Fragment>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    flexDirection: "column",
    justifyContent: "flex-start",
    width: "100%",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: SPACING.sm,
  },
  rowBoxWrapper: {
    width: "100%",
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
    alignItems: "center",
  },
  categoryItem: {
    width: "33.33%",
    alignItems: "center",
    marginBottom: SPACING.sm,
    padding: SPACING.md,
  },
  iconCircle: {
    width: "100%",
    maxWidth: 200,
    aspectRatio: 1,
    borderRadius: 9999, // large value to guarantee a circle regardless of size
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.sm,
    overflow: "hidden",
    borderWidth: 0,
  },
});

export default CategoryGrid;
