/**
 * Checkbox (web)
 *
 * Animated checkbox control for web builds. Uses `motion/react` to animate
 * the border and checkmark. Exposes a simple API:
 *   <Checkbox checked={value} onChange={setValue} size={24} />
 *
 * Keep the visual behavior consistent with the native implementation
 * (see `Checkbox.native.tsx`).
 */
import { motion, useMotionValue, animate, useTransform } from "motion/react";
import { useEffect } from "react";
import svgPaths from "../../imports/svg-kilf0jp2lv";
import { COLORS } from "../../theme";

interface CheckboxProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  size?: number;
}

export function Checkbox({ checked, onChange, size = 18 }: CheckboxProps) {
  // Animation progress for check state
  const checkProgress = useMotionValue(0);

  useEffect(() => {
    // Animate check state over 0.3 seconds
    animate(checkProgress, checked ? 1 : 0, {
      duration: 0.3,
      ease: "easeOut",
    });
  }, [checked, checkProgress]);

  // Border/stroke color animation
  const strokeColor = useTransform(
    checkProgress,
    [0, 1],
    [COLORS.lightGray, COLORS.primary6] // theme gray to theme green
  );

  // Stroke width animation (gets thicker when checked)
  const strokeWidth = useTransform(
    checkProgress,
    [0, 1],
    [2.5, 2.5] // Keep consistent
  );

  // Checkmark drawing animation
  const checkPathLength = 10;
  const checkDashoffset = useTransform(checkProgress, [0, 1], [checkPathLength, 0]);

  // Checkmark opacity
  const checkOpacity = useTransform(checkProgress, [0, 1], [0, 1]);

  // Checkmark bounce scale - playful pop-in effect
  const checkScale = useTransform(
    checkProgress,
    [0, 0.5, 0.75, 1],
    [0.5, 1.15, 0.95, 1] // Starts small, overshoots, pulls back, settles
  );

  const handleClick = () => {
    if (onChange) {
      onChange(!checked);
    }
  };

  return (
    <div
      onClick={handleClick}
      className="relative cursor-pointer"
      style={{ width: size, height: size, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
      aria-checked={checked}
      role="checkbox"
    >
      <svg
        className="block"
        fill="none"
        preserveAspectRatio="xMidYMid meet"
        viewBox="0 0 18 18"
        style={{ overflow: "visible", width: "100%", height: "100%" }}
      >
        {/* Checkbox border - hollow rounded square */}
        <motion.rect
          x="3.25"
          y="3.25"
          width="11.5"
          height="11.5"
          rx="3.75"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          fill="none"
          initial={false}
        />

        {/* Checkmark (drawn animation) */}
        <motion.path
          d={svgPaths.p24bd7b90}
          stroke={strokeColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={checkPathLength}
          style={{
            opacity: checkOpacity,
            strokeDashoffset: checkDashoffset,
            scale: checkScale,
          }}
          initial={false}
        />
      </svg>
    </div>
  );
}
