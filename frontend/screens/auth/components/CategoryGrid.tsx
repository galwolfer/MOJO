/**
 * CategoryGrid
 *
 * A modular 3x6 grid component displaying all categories as circular icons
 * with labels. Each category can be clicked to trigger an action.
 *
 * Displays categories in the order specified in CATEGORY_KEYS from categoryMeta.
 */
import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Dimensions, Animated, Pressable, Easing } from "react-native";
import AppText from "../../../components/common/AppText";
import { CATEGORY_KEYS, getCategoryMeta, CategoryKey } from "../../../config/categoryMeta";
import { ICONS } from "../../../components/icons/icons";
import { COLORS, SPACING, FONT_SIZES } from "../../../theme";
import Box from "../../../components/layout/Box";
import SliderComponent from "../../../components/inputs/Slider";

// Entrance animation defaults
const DEFAULT_ENTRANCE = {
  enabled: false,
  baseDelay: 120, // ms before first item
  stagger: 80, // ms per grid step (rowIndex + colIndex)
  duration: 300, // duration of each item's scale/opacity animation
};

const AnimatedAppText = Animated.createAnimatedComponent(AppText);

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
  const { width } = Dimensions.get("window");
  const iconSize = Math.min(width * 0.18, 60); // responsive icon size

  const baseDelay = typeof entranceBaseDelay === "number" ? entranceBaseDelay : DEFAULT_ENTRANCE.baseDelay;
  const stagger = typeof entranceStagger === "number" ? entranceStagger : DEFAULT_ENTRANCE.stagger;
  const duration = typeof entranceDuration === "number" ? entranceDuration : DEFAULT_ENTRANCE.duration;
  const enabled = entranceEnabled || DEFAULT_ENTRANCE.enabled;

  const CategoryItem: React.FC<{
    categoryKey: CategoryKey;
    meta: ReturnType<typeof getCategoryMeta>;
    IconComponent: React.FC<any> | null;
    isSelected: boolean;
    rowIndex: number;
    colIndex: number;
  }> = ({ categoryKey, meta, IconComponent, isSelected, rowIndex, colIndex }) => {
    const initialScale = enabled ? 0.8 : 1;
    const scale = useRef(new Animated.Value(initialScale)).current;
    const iconOpacity = useRef(new Animated.Value(enabled ? 0 : 1)).current;
    const textOpacity = useRef(new Animated.Value(enabled ? 0 : 1)).current;
    const outline = useRef(new Animated.Value(isSelected ? 3 : 0)).current;

    useEffect(() => {
      // Animate outline when selection changes
      Animated.timing(outline, {
        toValue: isSelected ? 3 : 0,
        duration: 180,
        useNativeDriver: false,
      }).start();
    }, [isSelected, outline]);

    useEffect(() => {
      if (!enabled) return;
      const delay = baseDelay + (rowIndex + colIndex) * stagger;
      // Sequence: appear -> small bump -> settle
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(iconOpacity, {
            toValue: 1,
            duration: Math.max(120, duration - 50),
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(textOpacity, {
            toValue: 1,
            duration: Math.max(120, duration - 50),
            delay: 40,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(scale, {
          toValue: 1.06,
          duration: 120,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scale, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start();
    }, [enabled, baseDelay, stagger, duration, rowIndex, colIndex, scale, textOpacity, iconOpacity]);

    const onPressIn = () => {
      Animated.parallel([
        Animated.timing(scale, { toValue: 0.95, duration: 120, useNativeDriver: true }),
        Animated.timing(outline, { toValue: 5, duration: 120, useNativeDriver: false }),
      ]).start();
    };

    const onPressOut = () => {
      Animated.parallel([
        Animated.timing(scale, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(outline, { toValue: isSelected ? 3 : 0, duration: 150, useNativeDriver: false }),
      ]).start();
    };

    return (
      <Pressable
        key={categoryKey}
        style={styles.categoryItem}
        onPress={() => onCategoryPress(categoryKey)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        android_ripple={{ color: COLORS.black }}
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
              opacity: iconOpacity,
            },
          ]}
        >
          <Animated.View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              borderColor: COLORS.white3,
              borderWidth: outline,
              borderRadius: iconSize / 2,
              width: "100%",
              height: "100%",
            }}
          >
            {IconComponent && <IconComponent size={iconSize * 0.5} color={COLORS.colorWhite} />}
          </Animated.View>
        </Animated.View>

        <AnimatedAppText variant="notes" style={{ textAlign: "center", opacity: textOpacity }} numberOfLines={2}>
          {meta.displayName}
        </AnimatedAppText>
      </Pressable>
    );
  }; // Build rows of 3 items so we can insert the priority Box right after
  const cols = 3;
  const rows: CategoryKey[][] = [];
  for (let i = 0; i < CATEGORY_KEYS.length; i += cols) rows.push(CATEGORY_KEYS.slice(i, i + cols) as CategoryKey[]);

  const RowBox: React.FC<{ rowIndex: number; children: React.ReactNode }> = ({ rowIndex, children }) => {
    const boxOpacity = useRef(new Animated.Value(enabled ? 0 : 1)).current;
    const translateY = useRef(new Animated.Value(enabled ? 6 : 0)).current;

    useEffect(() => {
      if (!enabled) return;
      const delay = baseDelay + (rowIndex + 1) * stagger + 40;
      Animated.parallel([
        Animated.timing(boxOpacity, {
          toValue: 1,
          duration: Math.max(180, duration),
          delay,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: Math.max(180, duration),
          delay,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }, [enabled, baseDelay, rowIndex, stagger, duration, boxOpacity, translateY]);

    return (
      <Animated.View style={[styles.rowBoxWrapper, { opacity: boxOpacity, transform: [{ translateY }] }]}>
        {children}
      </Animated.View>
    );
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
                  <CategoryItem
                    key={categoryKey}
                    categoryKey={categoryKey as CategoryKey}
                    meta={meta}
                    IconComponent={IconComponent}
                    isSelected={isSelected}
                    rowIndex={rowIndex}
                    colIndex={colIndex}
                  />
                );
              })}
            </View>

            {rowHasSelected && selectedCategory ? (
              <RowBox rowIndex={rowIndex}>
                {(() => {
                  const selMeta = getCategoryMeta(selectedCategory);
                  const SelIcon = (ICONS[selMeta.icon] as React.FC<any>) || null;
                  return (
                    <Box
                      title={selMeta.displayName?.toUpperCase()}
                      titleColor={selMeta.color}
                      titleIcon={SelIcon ? <SelIcon size={FONT_SIZES.md} color={COLORS.colorWhite} /> : undefined}
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
                })()}
              </RowBox>
            ) : null}
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
    justifyContent: "space-around",
    width: "100%",
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
    borderColor: COLORS.white3,
  },
});

export default CategoryGrid;
