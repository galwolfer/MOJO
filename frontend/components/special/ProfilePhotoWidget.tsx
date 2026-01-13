import React from "react";
import { View, StyleSheet } from "react-native";
import Widget from "./Widget";
import AppText from "../common/AppText";
import ProfileImagePicker from "../inputs/ProfileImagePicker";
import { SPACING, COLORS } from "../../theme";

/**
 * ProfilePhotoWidget
 *
 * Small, reusable widget that displays a title, optional subtitle and the
 * `ProfileImagePicker` inside a `Widget` container so it matches other
 * widgets across the app (rounded card, entrance animation support).
 *
 * Props:
 * - `imageUri` — string | File | null: current value passed to the picker
 * - `onImageSelected` — callback when a new image is selected
 * - `size` — optional thumbnail size (defaults to 80)
 * - `title` — optional title text
 * - `subtitle` — optional explanatory text
 *
 * Example usage:
 * ```tsx
 * <ProfilePhotoWidget
 *   imageUri={profileImage}
 *   onImageSelected={setProfileImage}
 *   size={88}
 *   title="Profile Photo (Optional)"
 *   subtitle="Tap to select or change your avatar"
 * />
 * ```
 */

type Props = {
  imageUri: string | File | null;
  onImageSelected: (value: string | File | null) => void;
  size?: number;
  title?: string;
  subtitle?: string;
};

const ProfilePhotoWidget: React.FC<Props> = ({
  imageUri,
  onImageSelected,
  size = 80,
  title = "Profile Photo (Optional)",
  subtitle,
}) => {
  return (
    <Widget entranceEnabled={true} style={styles.widget}>
      <View style={styles.header}>
        <AppText variant="bodyText" style={styles.title}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="notes" style={styles.subtitle}>
            {subtitle}
          </AppText>
        ) : null}
      </View>

      <View style={styles.pickerWrap}>
        <ProfileImagePicker imageUri={imageUri} onImageSelected={(v) => onImageSelected(v as any)} size={size} />
      </View>
    </Widget>
  );
};

const styles = StyleSheet.create({
  widget: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  header: {
    marginBottom: SPACING.sm,
    alignItems: "center",
  },
  title: {
    textAlign: "center",
  },
  subtitle: {
    marginTop: 4,
    textAlign: "center",
    color: COLORS.grayLight,
  },
  pickerWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACING.sm,
  },
});

export default ProfilePhotoWidget;
