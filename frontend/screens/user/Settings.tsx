import React, { useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity, Image, Alert, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import AppText from "../../components/common/AppText";
import Input from "../../components/inputs/Input";
import AppButton from "../../components/common/AppButton";
import ProfilePhotoWidget from "../../components/special/ProfilePhotoWidget";
import { COLORS, SPACING, SHADOWS } from "../../theme";
import { useAuth } from "../../context/AuthContext";
import { useNavigation } from "../../context/NavigationContext";
import { ICONS } from "../../components/icons/icons";
import ScrollableContent from "../../components/layout/ScrollableContent";
import Box from "../../components/layout/Box";
import { moderateScale } from "react-native-size-matters";
import { updateProfile, deleteAccount } from "../../services/apiClient";
import type { User } from "../../context/AuthContext";

/**
 * SettingsScreen
 *
 * Displays user settings with:
 * - Profile settings section with user info
 * - My Preferences section with various settings options
 * - Sign out button
 */

type SettingsScreenProps = {
  onBack: () => void;
};

export default function SettingsScreen({ onBack }: SettingsScreenProps) {
  const { user, signOut, signIn, token } = useAuth();
  const { setHeaderConfig } = useNavigation();

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

  const LeftIcon = ICONS.left;
  const UserIcon = ICONS.user;
  const EditIcon = ICONS.prefrences;
  const ChatIcon = ICONS.ojo;
  const NotificationIcon = ICONS.notifications;
  const PencilIcon = ICONS.edit;

  // Update local state when user changes
  useEffect(() => {
    if (user && !isEditMode) {
      setEditedUsername(user.username || "");
      setEditedEmail(user.email || "");
      setEditedDisplayName(user.displayName || user.username || "");
    }
  }, [user, isEditMode]);

  useEffect(() => {
    setHeaderConfig({
      title: "Mojo",
      show: true,
      icon: ICONS.mojo,
      leftElement: (
        <TouchableOpacity onPress={onBack} style={styles.headerButton}>
          <LeftIcon size={24} color={COLORS.primary1} />
        </TouchableOpacity>
      ),
      rightElement: (
        <View style={styles.headerRight}>
          <AppButton icon="settings" mode="light" color="primary1" disabled />
        </View>
      ),
    });
  }, [onBack]);

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
    console.log("handlePickImage called");
    try {
      // Request permission
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError("Camera roll permission is required to change your profile picture");
        return;
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        console.log("Image picked:", asset.uri);
        setNewProfileImage(asset.uri);
        setEditedProfileImage(asset.uri);
      }
    } catch (err: any) {
      console.error("Error picking image:", err);
      setError("Failed to pick image");
    }
  };

  const handleDeleteProfileImage = () => {
    console.log("handleDeleteProfileImage called");
    setEditedProfileImage(null);
    setNewProfileImage(""); // Mark as deleted
  };

  const handleSave = async () => {
    console.log("handleSave called");
    try {
      setIsSaving(true);
      setError(null);

      // Basic validation
      if (!editedUsername || !editedEmail) {
        console.log("Validation failed - missing username or email");
        setError("Username and email are required");
        setIsSaving(false);
        return;
      }

      // Password validation if changing password
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

      console.log("Calling updateProfile API with:", {
        username: editedUsername,
        email: editedEmail,
        name: editedDisplayName,
      });

      // Call API to update profile
      const updateData: any = {
        username: editedUsername,
        email: editedEmail,
        name: editedDisplayName,
      };

      // Add password fields if changing password
      if (newPassword) {
        updateData.currentPassword = currentPassword;
        updateData.newPassword = newPassword;
      }

      // Handle profile image upload or deletion (same as signup flow)
      if (newProfileImage !== null) {
        if (newProfileImage === "") {
          // Delete image - set to null
          updateData.profileImage = null;
        } else if (newProfileImage instanceof File) {
          // Web: profileImage is a File
          if (newProfileImage.size && newProfileImage.size > 400 * 1024) {
            setError("Profile image too large. Please choose a smaller image.");
            setIsSaving(false);
            return;
          }

          try {
            const uploadResp = await (
              await import("../../services/apiClient")
            ).uploadProfileImage(newProfileImage as File);
            if (uploadResp && uploadResp.url) {
              updateData.profileImage = uploadResp.url;
            } else {
              setError("Failed to upload profile image. Please try again.");
              setIsSaving(false);
              return;
            }
          } catch (err: any) {
            console.error("Image upload error:", err);
            setError(String(err?.message || "Failed to upload image"));
            setIsSaving(false);
            return;
          }
        } else if (typeof newProfileImage === "string") {
          // Native: profileImage is a file URI string
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
            if (uploadResp && uploadResp.url) {
              updateData.profileImage = uploadResp.url;
            } else {
              setError("Failed to upload profile image. Please try again.");
              setIsSaving(false);
              return;
            }
          } catch (err: any) {
            console.error("Image upload error:", err);
            setError(String(err?.message || "Failed to upload image"));
            setIsSaving(false);
            return;
          }
        }
      }

      const response = await updateProfile(updateData);

      console.log("updateProfile response:", response);

      // Update local user state with the returned user data
      if (response.user && token) {
        const updatedUser: User = {
          id: response.user.id,
          username: response.user.username,
          email: response.user.email,
          displayName: response.user.profile?.name || editedDisplayName,
          profileImage: response.user.profile?.profileImage || user?.profileImage,
        };
        console.log("Updating local user state:", updatedUser);
        await signIn(token, updatedUser);
      }

      console.log("Profile update successful, exiting edit mode");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setNewProfileImage(null);
      setIsEditMode(false);
    } catch (err: any) {
      console.error("Error updating profile:", err);
      setError(err?.message || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    console.log("handleCancel called");
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

  const handleEditPreferences = () => {
    // TODO: Navigate to preferences screen
    console.log("Edit preferences pressed");
  };

  const handleChatSettings = () => {
    // TODO: Navigate to chat settings screen
    console.log("Chat settings pressed");
  };

  const handleNotifications = () => {
    // TODO: Navigate to notifications settings screen
    console.log("Notifications pressed");
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently deleted.",
      [
        {
          text: "Cancel",
          onPress: () => console.log("Delete cancelled"),
          style: "cancel",
        },
        {
          text: "Delete",
          onPress: async () => {
            try {
              setIsSaving(true);
              console.log("Deleting account...");
              await deleteAccount();
              console.log("Account deleted successfully");
              // Sign out after account deletion
              await signOut();
            } catch (err: any) {
              console.error("Error deleting account:", err);
              setError(err?.message || "Failed to delete account");
              setIsSaving(false);
            }
          },
          style: "destructive",
        },
      ],
    );
  };

  return (
    <ScrollableContent
      respectHeader={true}
      respectNavBar={true}
      extraTopPadding={SPACING.lg}
      scrollKey="settings"
      contentContainerStyle={styles.contentContainer}
      extraBottomPadding={SPACING.xlg * 3}
    >
      {/* Settings Title */}
      <View style={styles.titleSection}>
        <ICONS.settings size={28} color={COLORS.primary1} />
        <AppText variant="title2" style={styles.title}>
          SETTINGS
        </AppText>
      </View>

      {/* Profile Settings Section */}
      <Box title="Profile" titleColor={COLORS.primary1}>
        <View style={styles.profileContent}>
          {/* User Avatar with gradient ring */}
          <View style={styles.avatarContainer}>
            <LinearGradient
              colors={[COLORS.primary1, COLORS.primary2, COLORS.primary4]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarGradient}
            >
              <View style={styles.avatarInner}>
                {editedProfileImage ? (
                  <Image
                    source={{
                      uri: editedProfileImage,
                    }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <UserIcon size={40} color={COLORS.lightGray} />
                )}
              </View>
            </LinearGradient>

            {/* Edit button overlay */}
            {!isEditMode && (
              <TouchableOpacity style={styles.editOverlay} onPress={handleEditProfile}>
                <PencilIcon size={20} color={COLORS.colorWhite} />
              </TouchableOpacity>
            )}
          </View>

          {/* User Info */}
          {isEditMode ? (
            <View style={styles.editForm}>
              {/* Profile Image Options */}
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
                />
                {editedProfileImage ? (
                  <TouchableOpacity style={[styles.imageButton, styles.deleteImageButton]} onPress={handleDeleteProfileImage}>
                    <AppText variant="boldText" style={styles.deleteImageButtonText}>
                      Delete Photo
                    </AppText>
                  </TouchableOpacity>
                ) : null}
              </View>

              <Input label="Display Name" value={editedDisplayName} onChangeText={setEditedDisplayName} />
              <Input label="Username" value={editedUsername} onChangeText={setEditedUsername} />
              <Input label="Email" value={editedEmail} onChangeText={setEditedEmail} type="email" />

              {/* Change Password Button */}
              <TouchableOpacity
                style={styles.changePasswordButton}
                onPress={() => setShowPasswordSection(!showPasswordSection)}
              >
                <AppText variant="boldText" style={styles.changePasswordButtonText}>
                  {showPasswordSection ? "Hide Password Change" : "Change Password (Optional)"}
                </AppText>
              </TouchableOpacity>

              {/* Password Change Section */}
              {showPasswordSection && (
                <View style={styles.passwordSection}>
                  <AppText variant="boldText" style={styles.passwordSectionTitle}>
                    Enter New Password
                  </AppText>
                  <Input
                    label="Current Password"
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    type="password"
                    placeholder="Enter current password"
                  />
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

              {error && (
                <AppText variant="notes" style={styles.errorText}>
                  {error}
                </AppText>
              )}
              <View style={styles.editButtons}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={handleCancel}
                  disabled={isSaving}
                >
                  <AppText variant="boldText" style={styles.cancelButtonText}>
                    Cancel
                  </AppText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.saveButton, isSaving && styles.disabledButton]}
                  onPress={handleSave}
                  disabled={isSaving}
                >
                  <AppText variant="boldText" style={styles.saveButtonText}>
                    {isSaving ? "Saving..." : "Save"}
                  </AppText>
                </TouchableOpacity>
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

              {/* Edit Profile Button */}
              <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
                <AppText variant="boldText" style={styles.editButtonText}>
                  Edit profile details
                </AppText>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Box>

      {/* My Preferences Section */}
      <Box title="My Prefrences" titleColor={COLORS.primary1}>
        <View style={styles.preferencesContent}>
          {/* Edit my preferences */}
          <TouchableOpacity style={styles.preferenceItem} onPress={handleEditPreferences}>
            <View style={styles.preferenceIcon}>
              <EditIcon size={20} color={COLORS.primary2} />
            </View>
            <AppText variant="bodyText" style={styles.preferenceText}>
              Edit my prefrences
            </AppText>
          </TouchableOpacity>

          {/* Chat settings */}
          <TouchableOpacity style={styles.preferenceItem} onPress={handleChatSettings}>
            <View style={styles.preferenceIcon}>
              <ChatIcon size={20} color={COLORS.primary1} />
            </View>
            <AppText variant="bodyText" style={styles.preferenceText}>
              Chat settings
            </AppText>
          </TouchableOpacity>

          {/* Notifications */}
          <TouchableOpacity style={styles.preferenceItem} onPress={handleNotifications}>
            <View style={styles.preferenceIcon}>
              <NotificationIcon size={20} color={COLORS.primary5} />
            </View>
            <AppText variant="bodyText" style={styles.preferenceText}>
              Notifications
            </AppText>
          </TouchableOpacity>
        </View>
      </Box>

      {/* Logout Button */}
      <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
        <AppText variant="boldText" style={styles.signOutText}>
          Logout
        </AppText>
      </TouchableOpacity>

      {/* Delete Account Button */}
      <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount} disabled={isSaving}>
        <AppText variant="boldText" style={styles.deleteButtonText}>
          Delete Account
        </AppText>
      </TouchableOpacity>
    </ScrollableContent>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    padding: SPACING.md,
    alignItems: "center",
    gap: SPACING.lg,
    paddingBottom: SPACING.xlg * 6,
  },

  // Title Section
  titleSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  title: {
    color: COLORS.primary1,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  // Header Button
  headerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerRight: {
    width: moderateScale(44),
    height: moderateScale(44),
    alignItems: "center",
    justifyContent: "center",
  },

  // Profile Content
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
    width: moderateScale(100),
    height: moderateScale(100),
    borderRadius: moderateScale(50),
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInner: {
    width: "100%",
    height: "100%",
    borderRadius: moderateScale(48),
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarText: {
    color: COLORS.primary1,
    fontSize: moderateScale(40),
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: moderateScale(48),
  },
  editOverlay: {
    position: "absolute",
    top: SPACING.sm,
    right: SPACING.sm,
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: moderateScale(16),
    backgroundColor: COLORS.primary1,
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
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.primary6,
    borderRadius: SPACING.xlg,
    marginTop: SPACING.sm,
  },
  editButtonText: {
    color: COLORS.colorWhite,
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
  imageButtonsRow: {
    flexDirection: "row",
    gap: SPACING.md,
  },
  imageButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.primary6,
    borderRadius: SPACING.md,
    alignItems: "center",
    justifyContent: "center",
  },
  imageButtonText: {
    color: COLORS.colorWhite,
    fontSize: moderateScale(12),
  },
  deleteImageButton: {
    backgroundColor: COLORS.primary5,
  },
  deleteImageButtonText: {
    color: COLORS.colorWhite,
    fontSize: moderateScale(12),
  },
  changePasswordButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.white2,
    borderRadius: SPACING.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.primary2,
  },
  changePasswordButtonText: {
    color: COLORS.primary2,
    fontSize: moderateScale(14),
  },
  editButtons: {
    flexDirection: "row",
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  button: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: SPACING.md,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.primary1,
  },
  cancelButtonText: {
    color: COLORS.primary1,
  },
  saveButton: {
    backgroundColor: COLORS.primary6,
  },
  saveButtonText: {
    color: COLORS.colorWhite,
  },
  disabledButton: {
    opacity: 0.5,
  },
  errorText: {
    color: COLORS.primary5,
    textAlign: "center",
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

  // Preferences Content
  preferencesContent: {
    width: "100%",
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  preferenceItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  preferenceIcon: {
    width: moderateScale(24),
    alignItems: "center",
  },
  preferenceText: {
    color: COLORS.black,
  },

  // Sign Out Button
  signOutButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xlg,
    backgroundColor: COLORS.white,
    borderRadius: SPACING.xlg,
    ...SHADOWS.card,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.primary1,
  },
  signOutText: {
    color: COLORS.primary1,
  },
  deleteButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xlg,
    backgroundColor: COLORS.primary5,
    borderRadius: SPACING.xlg,
    ...SHADOWS.card,
    marginTop: SPACING.md,
    marginBottom: SPACING.xlg * 2,
  },
  deleteButtonText: {
    color: COLORS.colorWhite,
  },
});
