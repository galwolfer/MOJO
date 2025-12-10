import React from "react";
import { motion } from "motion/react";
import { COLORS } from "../../theme";

interface ChevronProps {
  isOpen: boolean;
  size?: number;
  color?: string;
}

export const Chevron = ({ isOpen, size = 17, color = COLORS.primary1 }: ChevronProps) => {
  // Original path: curve pointing down
  // Reconstructed based on the inverse of pathUp
  const pathDown = "M1.25 1.25L5.99 6.67C7.19 8.04 9.31 8.04 10.51 6.67L15.25 1.25";

  // Flipped path: up arrow
  const pathUp = "M1.25002 7.92L5.99229 2.5C7.18752 1.13 9.31251 1.13 10.5077 2.5L15.25 7.92";

  return (
    <div
      style={{ width: size, height: size * (9 / 17), display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <svg width="100%" height="100%" viewBox="0 0 17 9" fill="none" style={{ display: "block", overflow: "visible" }}>
        <motion.path
          d={pathDown}
          stroke={color}
          strokeLinecap="round"
          strokeWidth="2.5"
          initial={false}
          animate={{ d: isOpen ? pathUp : pathDown }}
          transition={{
            duration: 0.3,
            ease: "easeInOut",
          }}
        />
      </svg>
    </div>
  );
};
