import React, { useRef, useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity, Image, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import AppText from "../common/AppText";
import { ICONS } from "../icons/icons";
import { COLORS, SPACING } from "../../theme";

interface ProfileImagePickerProps {
  imageUri: string | File | null;
  onImageSelected: (value: string | File) => void;
  size?: number;
}

// Utility: compress image file in browser using canvas
async function compressImageFileWeb(file: File, maxBytes = 200 * 1024): Promise<File> {
  const loadImage = () =>
    new Promise<any>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const ImgConstructor = (window as any).Image || (window as any).HTMLImageElement;
      const img: any = new ImgConstructor();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = (e: any) => {
        URL.revokeObjectURL(url);
        reject(e);
      };
      img.src = url;
    });

  const img = await loadImage();

  let canvas = document.createElement("canvas");
  let ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const MAX_DIM = 1024;
  let width = img.width;
  let height = img.height;
  if (width > MAX_DIM || height > MAX_DIM) {
    if (width > height) {
      height = Math.round((height * MAX_DIM) / width);
      width = MAX_DIM;
    } else {
      width = Math.round((width * MAX_DIM) / height);
      height = MAX_DIM;
    }
  }

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);

  let quality = 0.9;
  const minQuality = 0.3;

  while (true) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    const base64 = dataUrl.split(",")[1] || "";
    const bytes = Math.ceil((base64.length * 3) / 4);
    if (bytes <= maxBytes || quality <= minQuality) {
      // convert to blob
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const outFile = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
      return outFile;
    }
    quality = Math.max(minQuality, quality - 0.1);
  }
}

const ProfileImagePicker: React.FC<ProfileImagePickerProps> = ({ imageUri, onImageSelected, size = 100 }) => {
  const UserIcon = ICONS.user;
  const PlusIcon = ICONS.plus;
  const inputRef = useRef<any>(null);
  const [webPreview, setWebPreview] = useState<string | null>(null);

  useEffect(() => {
    // If parent passed a File (web), create preview URL
    if (Platform.OS === "web" && imageUri instanceof File) {
      const url = URL.createObjectURL(imageUri);
      setWebPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    if (typeof imageUri === "string") {
      setWebPreview(imageUri);
    }
  }, [imageUri]);

  const handlePickImage = async () => {
    try {
      if (Platform.OS === "web") {
        // trigger hidden file input
        if (inputRef.current) inputRef.current.click();
        return;
      }

      // Mobile flow: Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== "granted") {
        alert("Sorry, we need camera roll permissions to upload a profile photo.");
        return;
      }

      // Launch image picker (no base64 here — we'll use ImageManipulator for controlled resizing/compression)
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1.0,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const uri = asset.uri;

        console.log("Image picked - uri:", uri);

        if (!uri) {
          alert("Failed to read selected image");
          return;
        }

        // Iteratively resize and compress until under MAX_BYTES or until limits
        const MAX_BYTES = 200 * 1024; // 200 KB target
        let compress = 0.85;
        let maxDim = 1024;
        const minCompress = 0.3;
        const minDim = 200;

        let finalBase64: string | null = null;

        let lastManipResult: any = null;
        while (true) {
          try {
            const manipResult = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: maxDim } }], {
              compress,
              format: ImageManipulator.SaveFormat.JPEG,
              base64: true,
            });

            lastManipResult = manipResult;

            if (!manipResult.base64) {
              console.error("ImageManipulator returned no base64");
              break;
            }

            const base64String = manipResult.base64;
            const approxBytes = Math.ceil((base64String.length * 3) / 4);

            console.log("compress:", compress, "maxDim:", maxDim, "approxBytes:", approxBytes);

            finalBase64 = `data:image/jpeg;base64,${base64String}`;

            if (approxBytes <= MAX_BYTES) {
              // Good size
              break;
            }

            // If we can't reduce further, break with current
            if (compress <= minCompress && maxDim <= minDim) {
              console.warn("Unable to reduce image below MAX_BYTES, sending smallest possible");
              break;
            }

            // Make next pass: reduce quality and dimensions
            compress = Math.max(minCompress, compress - 0.15);
            maxDim = Math.max(minDim, Math.floor(maxDim * 0.8));
          } catch (err) {
            console.error("Error manipulating image:", err);
            break;
          }
        }

        if (finalBase64 && lastManipResult) {
          // Use the last manipulated URI as the selected image (local file)
          const finalUri = lastManipResult.uri || uri;
          console.log("Final image bytes (approx):", Math.ceil((finalBase64.length * 3) / 4));

          onImageSelected(finalUri);
        } else {
          alert("Failed to process selected image. Please try again.");
        }
      }
    } catch (error) {
      console.error("Error picking image:", error);
      alert("Failed to pick image. Please try again.");
    }
  };

  const handleWebFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files[0]) return;
    const file = files[0];

    // Try to compress in-browser
    try {
      const compressed = await compressImageFileWeb(file);
      onImageSelected(compressed);
    } catch (err) {
      console.error("Web compression failed, using original file:", err);
      onImageSelected(file);
    }
  };

  return (
    <View style={styles.container}>
      {Platform.OS === "web" ? (
        <React.Fragment>
          <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleWebFile} />
          <TouchableOpacity
            style={[styles.imageContainer, { width: size, height: size, borderRadius: size / 2 }]}
            onPress={handlePickImage}
            activeOpacity={0.7}
          >
            {webPreview ? (
              <Image
                source={{ uri: webPreview }}
                style={[styles.image, { borderRadius: size / 2 }]}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.placeholder, { borderRadius: size / 2 }]}>
                <UserIcon width={size * 0.5} height={size * 0.5} color={COLORS.lightGray} />
              </View>
            )}

            <View style={[styles.editBadge, { bottom: 0, right: 0 }]}>
              <PlusIcon width={16} height={16} color={COLORS.white} />
            </View>
          </TouchableOpacity>
        </React.Fragment>
      ) : (
        <TouchableOpacity
          style={[styles.imageContainer, { width: size, height: size, borderRadius: size / 2 }]}
          onPress={handlePickImage}
          activeOpacity={0.7}
        >
          {typeof imageUri === "string" && imageUri ? (
            <Image source={{ uri: imageUri }} style={[styles.image, { borderRadius: size / 2 }]} resizeMode="cover" />
          ) : (
            <View style={[styles.placeholder, { borderRadius: size / 2 }]}>
              <UserIcon width={size * 0.5} height={size * 0.5} color={COLORS.lightGray} />
            </View>
          )}

          <View style={[styles.editBadge, { bottom: 0, right: 0 }]}>
            <PlusIcon width={16} height={16} color={COLORS.white} />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  imageContainer: {
    position: "relative",
    overflow: "visible",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    width: "100%",
    height: "100%",
    backgroundColor: COLORS.white3,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: COLORS.lightGray,
    borderStyle: "dashed",
  },
  editBadge: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: COLORS.white,
  },
});

export default ProfileImagePicker;
