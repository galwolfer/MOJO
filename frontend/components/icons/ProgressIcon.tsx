/**
 * ProgressIcon (web)
 *
 * A compact progress indicator drawn with SVG and animated via `motion/react`.
 * Value is 0..1 and the component morphs a rounded rect fill into a check
 * when complete. Use for small status indicators in lists or buttons.
 */
import { motion, useSpring, useTransform, useMotionValue, animate } from "motion/react";
import { useEffect } from "react";
import { useColors } from "../../context/ThemeContext";
const svgPaths = { p24bd7b90: "M7 9.06818L8.33333 11.25L11 7.25" };

interface ProgressIconProps {
  value: number; // 0 to 1
  size?: number;
}

/**
 * ProgressIcon - Animated progress indicator for web platforms.
 * @param value - Progress value between 0 and 1.
 * @param size - The size of the icon.
 */
export function ProgressIcon({ value, size = 18 }: ProgressIconProps) {
  const colors = useColors();

  // Clamp value between 0 and 1
  const clampedValue = Math.max(0, Math.min(1, value));
  2;
  // Smooth spring animation for value changes
  const springValue = useSpring(0, {
    stiffness: 300,
    damping: 20, // Lower damping for more bounce
  });

  // Separate motion value for 100% completion animation
  const completionProgress = useMotionValue(0);

  useEffect(() => {
    // Use slower animation when reaching 100%
    if (clampedValue === 1) {
      animate(springValue, clampedValue, {
        type: "spring",
        stiffness: 150,
        damping: 35,
      });

      // Trigger completion animation over 0.3 seconds
      animate(completionProgress, 1, {
        duration: 0.3,
        ease: "easeOut",
      });
    } else {
      springValue.set(clampedValue);
      // Reset completion progress when not at 100%
      completionProgress.set(0);
    }
  }, [clampedValue, springValue, completionProgress]);

  // Calculate color based on progress
  const getColor = (progress: number) => {
    if (progress < 0.52) return colors.primary7; // Red (theme)
    if (progress < 0.82) return colors.primary5; // Yellow (theme)
    return colors.primary6; // Green (theme)
  };

  // Progress circle parameters
  const radius = 6.5;
  const centerY = 9;
  const diameter = radius * 2;

  // Transform spring value to fill height (bottom to top)
  // Normalize so 90% progress looks like ~80% fill to avoid looking "too full"
  const fillHeight = useTransform(springValue, [0, 0.8, 0.9, 1], [0, diameter * 0.8, diameter * 0.82, diameter]);

  // Transform to Y position (starts at bottom, moves up)
  // Compress the top portion to match the normalized fill
  const fillY = useTransform(
    springValue,
    [0, 0.8, 0.9, 1],
    [centerY + radius, centerY - radius * 0.6, centerY - radius * 0.64, centerY - radius],
  );

  // Stroke width increases during completion animation
  const strokeWidth = useTransform(completionProgress, [0, 1], [1, 2.5]);

  // Fill opacity - disappears at 100%
  const fillOpacity = useTransform(completionProgress, [0, 1], [1, 0]);

  // Corner radius morphing - from very rounded (circle-like) to less rounded (square)
  const cornerRadius = useTransform(completionProgress, [0, 1], [5.75, 3.75]);

  // Rounded rectangle dimensions (slightly smaller than circle to fit nicely)
  const rectX = 3.25;
  const rectY = 3.25;
  const rectWidth = 11.5;
  const rectHeight = 11.5;

  // Checkmark drawing animation - only at 100%
  const checkPathLength = 10; // Approximate path length for the checkmark
  const checkDashoffset = useTransform(completionProgress, [0, 1], [checkPathLength, 0]);

  // Checkmark opacity - only at 100%
  const checkOpacity = useTransform(completionProgress, [0, 1], [0, 1]);

  // Checkmark bounce scale - playful pop-in effect
  const checkScale = useTransform(
    completionProgress,
    [0, 0.52, 0.77, 1],
    [0.52, 1.15, 0.95, 1], // Starts small, overshoots, pulls back, settles
  );

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <motion.svg
        className="block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 18 18"
        style={{ overflow: "visible" }}
      >
        <defs>
          <clipPath id={`rounded-rect-clip-${size}`}>
            <motion.rect x={rectX} y={rectY} width={rectWidth} height={rectHeight} rx={cornerRadius} />
          </clipPath>
        </defs>

        {/* Main shape with fill animation */}
        <motion.g>
          {/* Filled portion (animates from bottom to top) */}
          <motion.rect
            x={rectX}
            y={fillY}
            width={rectWidth}
            height={fillHeight}
            fill={getColor(clampedValue)}
            clipPath={`url(#rounded-rect-clip-${size})`}
            initial={false}
            style={{ opacity: fillOpacity }}
          />

          {/* Morphing stroke outline - rounded rectangle */}
          <motion.rect
            x={rectX}
            y={rectY}
            width={rectWidth}
            height={rectHeight}
            rx={cornerRadius}
            stroke={getColor(clampedValue)}
            strokeWidth={strokeWidth}
            fill="none"
            initial={false}
          />
        </motion.g>

        {/* Checkmark (complete state) - drawn animation */}
        <motion.path
          d={svgPaths.p24bd7b90}
          stroke={colors.primary6}
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
      </motion.svg>
    </div>
  );
}
