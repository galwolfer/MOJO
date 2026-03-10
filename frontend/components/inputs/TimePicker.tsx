/**
 * TimePicker
 *
 * Cross-platform (Android · iOS · Web) time selector built entirely with
 * React Native primitives — no extra library required.
 *
 * - Internally stores / receives time as "HH:MM" in **24-hour** format.
 * - Display is controlled by `AccessibilityContext.preferences.timeFormat`
 *   ("12h" shows "9:30 AM"; "24h" shows "09:30").
 * - Opens a bottom-sheet-style modal with three snap-scroll drum columns
 *   (hour · minute · AM/PM when in 12h mode).
 * - The selection highlight, accent colour, and outer trigger can all be
 *   customised via props.
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { RectButton } from "react-native-gesture-handler";
import { moderateScale } from "react-native-size-matters";
import { COLORS, FONT_SIZES, FONTS, ICON_SIZES, SHADOWS, SPACING } from "../../theme";
import AppText from "../common/AppText";
import AppButton from "../common/AppButton";
import { ICONS } from "../icons/icons";
import { useColors } from "../../context/ThemeContext";
import { useAccessibilityPreferences } from "../../hooks/useAccessibilityPreferences";

// ── Constants ────────────────────────────────────────────────────────────────

const ITEM_H = moderateScale(50);
const VISIBLE = 5; // items shown in drum; centre one is selected
const DRUM_H = ITEM_H * VISIBLE;
const PAD_V = ITEM_H * Math.floor(VISIBLE / 2); // top / bottom padding so items can centre

const HOURS_24 = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const HOURS_12 = Array.from({ length: 12 }, (_, i) => String(i === 0 ? 12 : i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
const AMPM_ITEMS = ["AM", "PM"];
const LOOP_MULTIPLIER = 9; // odd number so there's a single middle copy
const MID_LOOP_COPY = Math.floor(LOOP_MULTIPLIER / 2);

// ── Helper ───────────────────────────────────────────────────────────────────

/** Parse a "HH:MM" string into { h24, min }; returns defaults on invalid input. */
function parseTime(value: string): { h24: number; min: number } {
  if (!value) return { h24: 9, min: 0 };
  const parts = value.split(":");
  const h24 = parseInt(parts[0], 10);
  const min = parseInt(parts[1], 10);
  return {
    h24: isNaN(h24) ? 9 : Math.max(0, Math.min(23, h24)),
    min: isNaN(min) ? 0 : Math.max(0, Math.min(59, min)),
  };
}

/** Format h24 + min into a display string according to the user's timeFormat pref. */
function formatDisplay(h24: number, min: number, is12h: boolean): string {
  const mm = String(min).padStart(2, "0");
  if (!is12h) return `${String(h24).padStart(2, "0")}:${mm}`;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const ampm = h24 >= 12 ? "PM" : "AM";
  return `${h12}:${mm} ${ampm}`;
}

function mod(value: number, base: number): number {
  return ((value % base) + base) % base;
}

// ── WheelColumn ──────────────────────────────────────────────────────────────

interface WheelCol {
  items: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  accentColor: string;
  textColor: string;
  mutedColor: string;
  width?: number;
}

const WheelColumn: React.FC<WheelCol> = ({
  items,
  selectedIndex,
  onSelect,
  accentColor,
  textColor,
  mutedColor,
  width = moderateScale(56),
}) => {
  const scrollRef = useRef<ScrollView>(null);
  const isMomentumRef = useRef(false);
  const isDraggingRef = useRef(false);
  const mountedRef = useRef(false);
  const userScrollRef = useRef(false);
  const itemCount = items.length;

  // Infinite loop: only repeat when the column has more than two values (hours/minutes).
  // AM/PM has just two entries and should not cycle endlessly – users expect a simple toggle.
  const loopedItems = useMemo(() => {
    if (itemCount <= 2) {
      // no repetition, just render the original array
      return items;
    }
    const repeated: string[] = [];
    for (let i = 0; i < LOOP_MULTIPLIER; i += 1) repeated.push(...items);
    return repeated;
  }, [items, itemCount]);

  const centerIndexFor = useCallback(
    (index: number) => {
      if (itemCount <= 2) return index;
      return MID_LOOP_COPY * itemCount + mod(index, itemCount);
    },
    [itemCount],
  );

  const recenterTo = useCallback(
    (index: number, animated = false) => {
      if (!itemCount) return;
      scrollRef.current?.scrollTo({ y: centerIndexFor(index) * ITEM_H, animated });
    },
    [centerIndexFor, itemCount],
  );

  // Initial position
  useLayoutEffect(() => {
    if (!itemCount || mountedRef.current) return;
    recenterTo(selectedIndex, false);
    mountedRef.current = true;
  }, [itemCount, recenterTo, selectedIndex]);

  // Sync only for *external* changes (e.g. AM/PM flip changes hour).
  useEffect(() => {
    if (!mountedRef.current || !itemCount || userScrollRef.current) return;
    recenterTo(selectedIndex, false);
  }, [itemCount, recenterTo, selectedIndex]);

  const commitIndex = useCallback(
    (offsetY: number) => {
      if (!itemCount) return;
      const snappedIndex = Math.round(offsetY / ITEM_H);
      const actualIdx = mod(snappedIndex, itemCount);
      if (actualIdx !== selectedIndex) onSelect(actualIdx);
      // Do NOT recenter here — let the scroll stay where it is.
      // The list has 9 copies so the user won't reach the edge.
      // Release the guard after a tick so the useEffect doesn't fight.
      setTimeout(() => { userScrollRef.current = false; }, 150);
    },
    [itemCount, onSelect, selectedIndex],
  );

  return (
    <View style={[styles.drumColumn, { width }]}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        scrollEventThrottle={16}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
        onScrollBeginDrag={() => {
          userScrollRef.current = true;
          isDraggingRef.current = true;
          isMomentumRef.current = false;
        }}
        onMomentumScrollBegin={() => {
          isMomentumRef.current = true;
        }}
        onScrollEndDrag={(e) => {
          if (!isMomentumRef.current) {
            isDraggingRef.current = false;
            commitIndex(e.nativeEvent.contentOffset.y);
          }
        }}
        onMomentumScrollEnd={(e) => {
          isDraggingRef.current = false;
          isMomentumRef.current = false;
          commitIndex(e.nativeEvent.contentOffset.y);
        }}
        contentContainerStyle={{ paddingVertical: PAD_V }}
        style={Platform.OS === "web" ? ({ scrollSnapType: "y mandatory", overflowY: "scroll" } as any) : undefined}
      >
        {loopedItems.map((label, i) => {
          // Wrap the index to find distance from selected item
          const realIdx = i % itemCount;
          const delta = Math.abs(realIdx - selectedIndex);
          // Prefer shortest distance (e.g. 0 and 59 are 1 apart in a 60-item list)
          const wrappedDelta = Math.min(delta, itemCount - delta);

          return (
            <Pressable
              key={i}
              onPress={() => commitIndex(i * ITEM_H)}
              style={[
                styles.drumItem,
                { height: ITEM_H },
                Platform.OS === "web" ? ({ scrollSnapAlign: "center" } as any) : undefined,
              ]}
            >
              <AppText
                style={{
                  fontFamily: wrappedDelta === 0 ? FONTS.fredokaSemiBold : FONTS.fredokaRegular,
                  fontSize: wrappedDelta === 0 ? FONT_SIZES.md : FONT_SIZES.base,
                  color: wrappedDelta === 0 ? accentColor : wrappedDelta === 1 ? textColor : mutedColor,
                  opacity: wrappedDelta === 0 ? 1 : wrappedDelta === 1 ? 0.72 : 0.35,
                  textAlign: "center",
                }}
              >
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

// ── TimePicker ───────────────────────────────────────────────────────────────

export interface TimePickerProps {
  /** Current time in "HH:MM" 24-hour format */
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  error?: string;
  /** Theme colour key for accent elements (defaults to "primary1") */
  color?: keyof typeof COLORS;
}

export function TimePicker({
  value,
  onChange,
  label,
  placeholder = "Select time",
  style,
  disabled = false,
  error,
  color = "primary1",
}: TimePickerProps) {
  const colors = useColors();
  const { preferences } = useAccessibilityPreferences();
  const is12h = preferences.timeFormat === "12h";
  const accentColor = (COLORS[color] as string) ?? COLORS.primary1;

  const [visible, setVisible] = useState(false);

  // Temp state while the modal is open
  const [selH24, setSelH24] = useState(0);
  const [selMin, setSelMin] = useState(0);
  const [selAmpm, setSelAmpm] = useState<0 | 1>(0); // 0 = AM, 1 = PM

  const { h24, min } = useMemo(() => parseTime(value), [value]);

  const displayText = useMemo(() => (value ? formatDisplay(h24, min, is12h) : ""), [value, h24, min, is12h]);

  // Derived indices for the drum columns
  // HOURS_12 = ["12","01","02",...,"11"]  →  index = h24 % 12
  // (h24%12 gives 0 for midnight/noon → index 0 = "12"; 1-11 map directly)
  const hourIndex12 = selH24 % 12;
  const hourIndex24 = selH24;
  const minuteIndex = selMin;
  const ampmIndex = selAmpm;

  const open = useCallback(() => {
    if (disabled) return;
    setSelH24(h24);
    setSelMin(min);
    setSelAmpm(h24 >= 12 ? 1 : 0);
    setVisible(true);
  }, [disabled, h24, min]);

  const confirm = useCallback(() => {
    // selH24 is always stored as 24h — emit directly
    onChange(`${String(selH24).padStart(2, "0")}:${String(selMin).padStart(2, "0")}`);
    setVisible(false);
  }, [selH24, selMin, onChange]);

  // HOURS_12[i] = ["12","01",...,"11"]  →  h12 = (i === 0 ? 12 : i)
  const handleHourSelect12 = useCallback((i: number) => {
    const h12 = i === 0 ? 12 : i;
    setSelH24((prev) => {
      const pm = prev >= 12;
      return pm ? (h12 === 12 ? 12 : h12 + 12) : h12 === 12 ? 0 : h12;
    });
  }, []);

  const handleAmpmSelect = useCallback((i: number) => {
    const a = i as 0 | 1;
    setSelAmpm(a);
    setSelH24((prev) => {
      const h12 = prev % 12;
      return a === 1 ? (h12 === 0 ? 12 : h12 + 12) : h12;
    });
  }, []);

  const ClockIcon = ICONS.clock;

  return (
    <View style={[styles.wrapper, style]}>
      {label ? (
        <AppText variant="boldText" style={[styles.fieldLabel, { color: colors.text1 }]}>
          {label}
        </AppText>
      ) : null}

      {/* Trigger button */}
      <Pressable
        onPress={open}
        style={[
          styles.trigger,
          {
            backgroundColor: colors.bg1,
            borderColor: error ? COLORS.primary7 : accentColor,
          },
          disabled && styles.triggerDisabled,
          ...(SHADOWS.card ? [SHADOWS.card as object] : []),
        ]}
        disabled={disabled}
      >
        <AppText style={[styles.triggerText, { color: displayText ? colors.text1 : colors.gray1 }]}>
          {displayText || placeholder}
        </AppText>
        <ClockIcon size={ICON_SIZES.sm} color={disabled ? colors.gray1 : accentColor} />
      </Pressable>

      {error ? (
        <AppText variant="notes" style={styles.errorText}>
          {error}
        </AppText>
      ) : null}

      {/* Modal */}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.overlay}>
          {/* Tap background to dismiss — only covers the area above the sheet */}
          <Pressable style={{ flex: 1 }} onPress={() => setVisible(false)} />
          <View style={[styles.sheet, { backgroundColor: colors.bg1 }]}>
            {/* Header */}
            <AppText variant="title3" style={[styles.sheetTitle, { color: colors.text1 }]}>
              {label || "Select Time"}
            </AppText>

            {/* Drum columns */}
            <View style={styles.columnsRow}>
              {/* Selection highlight bar */}
              <View pointerEvents="none" style={[styles.selHighlight, { borderColor: accentColor }]} />

              {/* Hours */}
              <WheelColumn
                items={is12h ? HOURS_12 : HOURS_24}
                selectedIndex={is12h ? hourIndex12 : hourIndex24}
                onSelect={is12h ? handleHourSelect12 : setSelH24}
                accentColor={accentColor}
                textColor={colors.text1}
                mutedColor={colors.gray1}
              />

              {/* Colon separator */}
              <AppText style={[styles.colonSep, { color: colors.text1 }]}>:</AppText>

              {/* Minutes */}
              <WheelColumn
                items={MINUTES}
                selectedIndex={minuteIndex}
                onSelect={setSelMin}
                accentColor={accentColor}
                textColor={colors.text1}
                mutedColor={colors.gray1}
              />

              {/* AM/PM column (12h only) */}
              {is12h && (
                <WheelColumn
                  items={AMPM_ITEMS}
                  selectedIndex={ampmIndex}
                  onSelect={handleAmpmSelect}
                  accentColor={accentColor}
                  textColor={colors.text1}
                  mutedColor={colors.gray1}
                  width={moderateScale(52)}
                />
              )}
            </View>

            {/* Action buttons */}
            <View style={[styles.btnRow, { zIndex: 10, elevation: 10 }]}>
              <RectButton
                onPress={() => setVisible(false)}
                style={{ backgroundColor: COLORS.lightGray, borderRadius: SPACING.xlg, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg, width: "46%", alignItems: "center", minHeight: 44, justifyContent: "center" }}
              >
                <AppText variant="boldText" style={{ color: COLORS.colorWhite }}>Cancel</AppText>
              </RectButton>
              <RectButton
                onPress={confirm}
                style={{ backgroundColor: accentColor, borderRadius: SPACING.xlg, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg, width: "46%", alignItems: "center", minHeight: 44, justifyContent: "center" }}
              >
                <AppText variant="boldText" style={{ color: COLORS.colorWhite }}>Done</AppText>
              </RectButton>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get("window");

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
  },
  fieldLabel: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 0.15,
    borderRadius: SPACING.lg,
    paddingHorizontal: SPACING.md,
    height: moderateScale(44),
    minHeight: 44,
    borderColor: COLORS.primary1,
  },
  triggerDisabled: {
    opacity: 0.5,
  },
  triggerText: {
    fontFamily: FONTS.fredokaRegular,
    fontSize: FONT_SIZES.base,
    flex: 1,
  },
  errorText: {
    color: COLORS.primary7,
    marginTop: moderateScale(3),
  },

  // Modal
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: SPACING.xlg,
    borderTopRightRadius: SPACING.xlg,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xlg,
    gap: SPACING.md,
    // subtle shadow upward
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
  },
  sheetTitle: {
    textAlign: "center",
    marginBottom: SPACING.sm,
  },

  // Drum
  columnsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: DRUM_H,
    overflow: "hidden",
  },
  selHighlight: {
    position: "absolute",
    top: "50%",
    left: SPACING.lg,
    right: SPACING.lg,
    height: ITEM_H,
    marginTop: -(ITEM_H / 2),
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderRadius: moderateScale(6),
    zIndex: 1,
  },
  drumColumn: {
    height: DRUM_H,
    overflow: "hidden",
  },
  drumItem: {
    justifyContent: "center",
    alignItems: "center",
  },
  colonSep: {
    fontFamily: FONTS.fredokaSemiBold,
    fontSize: FONT_SIZES.md,
    lineHeight: FONT_SIZES.md * 1.3,
    marginHorizontal: SPACING.xs,
    zIndex: 2,
  },

  // Buttons
  btnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: SPACING.sm,
  },
});
