import React from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Box from "../layout/Box";
import { SPACING, COLORS } from "../../theme";

interface PopupBoxProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  titleColor?: string;
  children?: React.ReactNode;
  contentStyle?: object;
}

export default function PopupBox({ visible, onClose, title, titleColor, children, contentStyle }: PopupBoxProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <Box title={title} titleColor={titleColor || COLORS.primary1} style={contentStyle}>
            <View>{children}</View>
          </Box>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.lg,
  },
});
