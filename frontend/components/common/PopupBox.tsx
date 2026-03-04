import React from "react";
import { Modal, Pressable, StyleSheet, View, ScrollView } from "react-native";
import Box from "../layout/Box";
import { SPACING, COLORS } from "../../theme";

interface PopupBoxProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  titleColor?: string;
  /** optional icon to render left of title text */
  titleIcon?: React.ReactNode;
  children?: React.ReactNode;
  contentStyle?: object;
  /** whether clicking outside the popup closes it (default: true) */
  closeOnBackdropPress?: boolean;
}

export default function PopupBox({
  visible,
  onClose,
  title,
  titleColor,
  titleIcon,
  children,
  closeOnBackdropPress = true,
}: PopupBoxProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={closeOnBackdropPress ? onClose : undefined}>
        <Pressable onPress={(e) => e.stopPropagation()} style={styles.boxContainer}>
          <View style={styles.boxWrapper}>
            <Box title={title} titleColor={titleColor || COLORS.primary1} titleIcon={titleIcon}>
              <View style={styles.scrollWrapper}>
                <ScrollView showsVerticalScrollIndicator={true} nestedScrollEnabled={true} style={styles.scrollView}>
                  {children}
                </ScrollView>
              </View>
            </Box>
          </View>
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
  boxContainer: {
    maxHeight: "80%",
  },
  boxWrapper: {
    maxHeight: "100%",
  },
  scrollWrapper: {
    maxHeight: 500,
  },
  scrollView: {
    flexGrow: 0,
  },
});
