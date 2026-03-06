import React, { useEffect, useState, useRef } from "react";
import { View, StyleSheet, Image, Alert, Platform } from "react-native";
import { moderateScale } from "react-native-size-matters";
import AppText from "../../../components/common/AppText";
import Input from "../../../components/inputs/Input";
import AppButton from "../../../components/common/AppButton";
import ProfilePhotoWidget from "../../../components/special/ProfilePhotoWidget";
import ErrorText from "../../../components/common/ErrorText";
import PopupBox from "../../../components/common/PopupBox";
import { COLORS, SPACING, SHADOWS } from "../../../theme";
import { useColors } from "../../../context/ThemeContext";
import { useAuth } from "../../../context/AuthContext";
import { ICONS } from "../../../components/icons/icons";
import { updateProfile, deleteAccount } from "../../../services/apiClient";
import { Box } from "../../../components";
import UserAvatar from "../../../components/common/UserAvatar";

export default function ProfileSettings() {
  const colors = useColors();
  const { user, signIn, signOut, token } = useAuth();
  const UserIcon = ICONS.user;

  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
  const [newProfileImage, setNewProfileImage] = useState<string | File | null>(null);
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  // Use ref to track if we've already set initial values
  const initializedRef = useRef(false);

  useEffect(() => {
    if (user && !isEditMode && !initializedRef.current) {
      setEditedUsername(user.username || "");
      setEditedEmail(user.email || "");
      setEditedDisplayName(user.displayName || user.username || "");
      setEditedProfileImage(user.profileImage || null);
      initializedRef.current = true;
    }
    if (isEditMode) {
      initializedRef.current = false;
    }
  }, [user, isEditMode]);

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
              await import("../../../services/apiClient")
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
              await import("../../../services/apiClient")
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
    }
  };

  // delete account logic
  const handleDeleteAccount = () => {
    setShowDeletePopup(true);
  };

  const confirmDeleteAccount = async () => {
    setIsDeletingAccount(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      await signOut();
    } catch (err: any) {
      setDeleteError(err?.message || "Failed to delete account");
    } finally {
      setIsDeletingAccount(false);
      setShowDeletePopup(false);
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
              <UserAvatar size={moderateScale(104)} imageUri={editedProfileImage ?? null} />
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
            <View style={[styles.imageSection, { borderBottomColor: colors.bg2 }]}>
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
              <View style={[styles.passwordSection, { borderTopColor: colors.bg2 }]}>
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

            {/* delete account action inside edit mode */}
            {!showPasswordSection && (
              <AppButton
                title={isDeletingAccount ? "Deleting..." : "Delete Account"}
                onPress={() => setShowDeletePopup(true)}
                mode="light"
                color={colors.gray1}
                style={styles.button}
                disabled={isSaving || isDeletingAccount}
              />
            )}
            <View style={styles.editButtons}>
              <AppButton
                title="Cancel"
                onPress={handleCancel}
                mode="light"
                color={colors.gray2}
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
                <AppText variant="notes" style={[styles.userUsername, { color: colors.gray1 }]}>
                  @{user.username}
                </AppText>
              )}
              <AppText variant="notes" style={[styles.userEmail, { color: colors.gray1 }]}>
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

      <PopupBox visible={showDeletePopup} onClose={() => setShowDeletePopup(false)} title="Delete Account">
        <AppText>
          Are you sure you want to delete your account? This action cannot be undone and all your data will be
          permanently deleted.
        </AppText>
        <View style={{ flexDirection: "row", gap: SPACING.md, justifyContent: "center", marginTop: SPACING.md }}>
          <AppButton title="Cancel" onPress={() => setShowDeletePopup(false)} color="primary6" />
          <AppButton
            title={isDeletingAccount ? "Deleting..." : "Delete"}
            onPress={confirmDeleteAccount}
            mode="light"
            color="primary7"
            disabled={isDeletingAccount}
          />
        </View>
      </PopupBox>

      <PopupBox visible={!!deleteError} onClose={() => setDeleteError(null)} title="Error" titleColor={COLORS.primary6}>
        <ErrorText>{deleteError}</ErrorText>
        <View style={{ marginTop: SPACING.md }}>
          <AppButton title="Close" onPress={() => setDeleteError(null)} />
        </View>
      </PopupBox>
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
    gap: SPACING.sm,
  },
  userName: {
    color: COLORS.primary1,
    textTransform: "uppercase",
  },
  userUsername: {
    marginTop: SPACING.xs,
  },
  userEmail: {},
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
    borderBottomWidth: SPACING.xs,
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
    borderTopWidth: SPACING.xs,
  },
  passwordSectionTitle: {
    color: COLORS.primary1,
    marginBottom: SPACING.sm,
  },
});
