import React, { useEffect, useState } from "react";
import { View, StyleSheet, Image, Alert, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { moderateScale } from "react-native-size-matters";
import AppText from "../../components/common/AppText";
import Input from "../../components/inputs/Input";
import AppButton from "../../components/common/AppButton";
import ProfilePhotoWidget from "../../components/special/ProfilePhotoWidget";
import ErrorText from "../../components/common/ErrorText";
import { COLORS, SPACING, SHADOWS } from "../../theme";
import { useAuth } from "../../context/AuthContext";
import { ICONS } from "../../components/icons/icons";
import { updateProfile } from "../../services/apiClient";
import { getUserPreferences } from "../../services/apiClient";
import { getOjoType } from "../../config/ojoTypeConfig";
import { Box } from "../../components";

export default function ProfileSettings() {
  const { user, signIn, token } = useAuth();
  const UserIcon = ICONS.user;

  const [isEditMode, setIsEditMode] = useState(false);
  const [editedUsername, setEditedUsername] = useState(user?.username || "");
  const [editedEmail, setEditedEmail] = useState(user?.email || "");
  const [editedDisplayName, setEditedDisplayName] = useState(user?.displayName || user?.username || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editedProfileImage, setEditedProfileImage] = useState<string | null>(user?.profileImage || null);
  const [ojoGradient, setOjoGradient] = useState<string[] | null>(null);
  const [newProfileImage, setNewProfileImage] = useState<string | File | null>(null);
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  useEffect(() => {
    if (user && !isEditMode) {
      setEditedUsername(user.username || "");
      setEditedEmail(user.email || "");
      setEditedDisplayName(user.displayName || user.username || "");
      setEditedProfileImage(user.profileImage || null);
    }
  }, [user, isEditMode]);

  // Load user's OjoType gradient for avatar outline
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const prefs = await getUserPreferences();
        const ojoName = prefs?.ojoType?.name as any;
        const cfg = ojoName ? getOjoType(ojoName) : getOjoType("mentorjo");
        if (mounted) setOjoGradient(cfg.gradient2 ?? cfg.gradient ?? [cfg.color, cfg.color]);
      } catch (e) {
        // ignore and keep default colors
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleEditProfile = () => {
    setIsEditMode(true);
    setEditedUsername(user?.username || "");
    setEditedEmail(user?.email || "");
    setEditedDisplayName(user?.displayName || user?.username || "");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setNewProfileImage(null);
    setShowPasswordSection(false);
  };

  const handlePickImage = async () => {
    // This component delegates picking to the child widget / picker; kept for parity
  };

  const handleDeleteProfileImage = () => {
    setEditedProfileImage(null);
    setNewProfileImage("");
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);

      if (!editedUsername || !editedEmail) {
        setError("Username and email are required");
        setIsSaving(false);
        return;
      }

      if (newPassword || confirmPassword || currentPassword) {
        if (!currentPassword) {
          setError("Current password is required to change password");
          setIsSaving(false);
          return;
        }
        if (!newPassword) {
          setError("New password is required");
          setIsSaving(false);
          return;
        }
        if (newPassword.length < 6) {
          setError("New password must be at least 6 characters");
          setIsSaving(false);
          return;
        }
        if (newPassword !== confirmPassword) {
          setError("New passwords do not match");
          setIsSaving(false);
          return;
        }
      }

      const updateData: any = {
        username: editedUsername,
        email: editedEmail,
        name: editedDisplayName,
      };

      if (newPassword) {
        updateData.currentPassword = currentPassword;
        updateData.newPassword = newPassword;
      }

      // Handle profile image upload or deletion
      if (newProfileImage !== null) {
        if (newProfileImage === "") {
          updateData.profileImage = null;
        } else if (newProfileImage instanceof File) {
          if (newProfileImage.size && newProfileImage.size > 400 * 1024) {
            setError("Profile image too large. Please choose a smaller image.");
            setIsSaving(false);
            return;
          }

          try {
            const uploadResp = await (
              await import("../../services/apiClient")
            ).uploadProfileImage(newProfileImage as File);
            if (uploadResp && uploadResp.url) updateData.profileImage = uploadResp.url;
            else {
              setError("Failed to upload profile image. Please try again.");
              setIsSaving(false);
              return;
            }
          } catch (err: any) {
            setError(String(err?.message || "Failed to upload image"));
            setIsSaving(false);
            return;
          }
        } else if (typeof newProfileImage === "string") {
          try {
            if (Platform.OS !== "web") {
              const { getInfoAsync } = await import("expo-file-system/legacy");
              const info = await getInfoAsync(newProfileImage as string, { size: true } as any);
              if (!info.exists) {
                setError("Selected profile image could not be found. Please re-select the image.");
                setIsSaving(false);
                return;
              }
              if (info.size && info.size > 400 * 1024) {
                setError("Profile image too large. Please choose a smaller image.");
                setIsSaving(false);
                return;
              }
            }

            const uploadResp = await (
              await import("../../services/apiClient")
            ).uploadProfileImage(newProfileImage as string);
            if (uploadResp && uploadResp.url) updateData.profileImage = uploadResp.url;
            else {
              setError("Failed to upload profile image. Please try again.");
              setIsSaving(false);
              return;
            }
          } catch (err: any) {
            setError(String(err?.message || "Failed to upload image"));
            setIsSaving(false);
            return;
          }
        }
      }

      const response = await updateProfile(updateData);

      if (response.user && token) {
        const updatedUser: any = {
          id: response.user.id,
          username: response.user.username,
          email: response.user.email,
          displayName: response.user.profile?.name || editedDisplayName,
          profileImage:
            response.user.profile?.profileImage !== undefined
              ? response.user.profile?.profileImage
              : user?.profileImage,
        };
        await signIn(token, updatedUser);
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setNewProfileImage(null);
      setIsEditMode(false);
    } catch (err: any) {
      setError(err?.message || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditMode(false);
    setEditedUsername(user?.username || "");
    setEditedEmail(user?.email || "");
    setEditedDisplayName(user?.displayName || user?.username || "");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setEditedProfileImage(user?.profileImage || null);
    setNewProfileImage(null);
    setError(null);
    setShowPasswordSection(false);
  };

  return (
    <Box title="Profile">
      <View style={styles.profileContent}>
        <View style={styles.avatarContainer}>
          {!isEditMode && (
            <View>
              <LinearGradient
                colors={(ojoGradient ?? [COLORS.primary1, COLORS.primary2]) as [string, string, ...string[]]}
                end={{ x: 1, y: 1 }}
                style={styles.avatarGradient}
              >
                <View style={styles.avatarInner}>
                  {editedProfileImage ? (
                    <Image source={{ uri: editedProfileImage }} style={styles.avatarImagePlain} />
                  ) : (
                    <UserIcon size={moderateScale(35)} color={COLORS.lightGray} />
                  )}
                </View>
              </LinearGradient>
              <AppButton
                icon="edit"
                mode="filled"
                color="primary1"
                onPress={handleEditProfile}
                style={styles.editOverlayButton}
              />
            </View>
          )}
        </View>

        {isEditMode ? (
          <View style={styles.editForm}>
            <View style={styles.imageSection}>
              <AppText variant="boldText" style={styles.imageSectionTitle}>
                Profile Picture
              </AppText>
              <ProfilePhotoWidget
                imageUri={newProfileImage ?? editedProfileImage ?? null}
                onImageSelected={(val) => {
                  try {
                    if (val instanceof File) {
                      setNewProfileImage(val);
                      const url = URL.createObjectURL(val);
                      setEditedProfileImage(url);
                    } else if (typeof val === "string") {
                      setNewProfileImage(val);
                      setEditedProfileImage(val);
                    } else {
                      setNewProfileImage(null);
                      setEditedProfileImage(null);
                    }
                  } catch (e) {
                    console.warn("Failed to preview selected image", e);
                    if (typeof val === "string") setEditedProfileImage(val);
                  }
                }}
                size={96}
                title="Profile Photo"
                subtitle="Tap to select or change your avatar"
                onDelete={handleDeleteProfileImage}
              />
            </View>

            <Input label="Display Name" value={editedDisplayName} onChangeText={setEditedDisplayName} />
            <Input label="Username" value={editedUsername} onChangeText={setEditedUsername} />
            <Input label="Email" value={editedEmail} onChangeText={setEditedEmail} type="email" />

            <AppButton
              title={showPasswordSection ? "Hide Password Change" : "Change Password (Optional)"}
              onPress={() => setShowPasswordSection(!showPasswordSection)}
              mode="light"
              color="primary1"
              style={styles.button}
            />

            {showPasswordSection && (
              <View style={styles.passwordSection}>
                <Input
                  label="Current Password"
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  type="password"
                  placeholder="Enter current password"
                />
                <AppText variant="boldText" style={styles.passwordSectionTitle}>
                  Enter New Password
                </AppText>
                <Input
                  label="New Password"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  type="password"
                  placeholder="At least 6 characters"
                />
                <Input
                  label="Confirm New Password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  type="password"
                  placeholder="Re-enter new password"
                />
              </View>
            )}

            {error && <ErrorText>{error}</ErrorText>}

            <View style={styles.editButtons}>
              <AppButton
                title="Cancel"
                onPress={handleCancel}
                mode="light"
                color="lightGray"
                style={[styles.button]}
                disabled={isSaving}
              />
              <AppButton
                title={isSaving ? "Saving..." : "Save"}
                onPress={handleSave}
                mode="filled"
                color="primary6"
                style={[styles.button]}
                disabled={isSaving}
              />
            </View>
          </View>
        ) : (
          <>
            <View style={styles.userInfo}>
              <AppText variant="title3" style={styles.userName}>
                {user?.displayName || user?.username || "User"}
              </AppText>
              {user?.username && (
                <AppText variant="notes" style={styles.userUsername}>
                  @{user.username}
                </AppText>
              )}
              <AppText variant="notes" style={styles.userEmail}>
                {user?.email || "email@example.com"}
              </AppText>
            </View>

            <AppButton
              title="Edit profile details"
              onPress={handleEditProfile}
              mode="filled"
              color="primary6"
              style={styles.editButton}
            />
          </>
        )}
      </View>
    </Box>
  );
}

const styles = StyleSheet.create({
  profileContent: {
    alignItems: "center",
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  avatarContainer: {
    marginBottom: SPACING.sm,
    position: "relative",
  },
  avatarGradient: {
    width: moderateScale(104),
    height: moderateScale(104),
    borderRadius: moderateScale(52),
    alignItems: "center",
    justifyContent: "center",
    padding: moderateScale(2),
    ...SHADOWS.card,
  },
  avatarInner: {
    width: moderateScale(100),
    height: moderateScale(100),
    borderRadius: moderateScale(50),
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImagePlain: {
    width: "100%",
    height: "100%",
  },
  editOverlayButton: {
    position: "absolute",
    top: SPACING.sm,
    right: SPACING.sm,
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: moderateScale(16),
    paddingVertical: 0,
    paddingHorizontal: 0,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.card,
  },
  userInfo: {
    alignItems: "center",
    gap: 4,
  },
  userName: {
    color: COLORS.primary1,
    textTransform: "uppercase",
  },
  userUsername: {
    color: COLORS.lightGray,
    marginTop: 2,
  },
  userEmail: {
    color: COLORS.lightGray,
  },
  editButton: {
    alignSelf: "center",
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: SPACING.xlg,
    marginTop: SPACING.sm,
  },
  editForm: {
    width: "100%",
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  imageSection: {
    width: "100%",
    gap: SPACING.md,
    marginBottom: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.white2,
  },
  imageSectionTitle: {
    color: COLORS.primary1,
  },
  deleteButton: {
    alignSelf: "center",
    marginTop: SPACING.sm,
  },
  editButtons: {
    flexDirection: "row",
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  button: {
    width: "100%",
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    alignItems: "center",
    justifyContent: "center",
  },

  passwordSection: {
    width: "100%",
    gap: SPACING.md,
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.white2,
  },
  passwordSectionTitle: {
    color: COLORS.primary1,
    marginBottom: SPACING.sm,
  },
});
