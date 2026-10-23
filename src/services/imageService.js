import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

const IMAGES_DIR = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}transaction_photos/` : null;

// Ensure persistent images directory exists
export const ensureImageDirectoryExists = async () => {
  if (!IMAGES_DIR || Platform.OS === 'web') return;
  try {
    const dirInfo = await FileSystem.getInfoAsync(IMAGES_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(IMAGES_DIR, { intermediates: true });
    }
  } catch (error) {
    console.warn('Error ensuring image directory:', error);
  }
};

// Copy an image to the app's persistent storage so it is never lost
export const persistImageLocally = async (tempUri) => {
  if (Platform.OS === 'web' || !IMAGES_DIR || !tempUri) {
    return tempUri;
  }

  try {
    await ensureImageDirectoryExists();
    const fileName = `img_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
    const destination = `${IMAGES_DIR}${fileName}`;
    await FileSystem.copyAsync({ from: tempUri, to: destination });
    return destination;
  } catch (error) {
    console.warn('Failed to copy image to app directory, using temp URI:', error);
    return tempUri;
  }
};

// Pick single/multiple images from gallery
export const pickImagesFromGallery = async () => {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Camera roll permission is required to select photos.');
      return [];
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.7,
      selectionLimit: 5,
    });

    if (result.canceled || !result.assets) {
      return [];
    }

    const persistedUris = await Promise.all(
      result.assets.map(async (asset) => {
        const localUri = await persistImageLocally(asset.uri);
        return {
          localUri,
          fileName: asset.fileName || localUri.split('/').pop() || 'photo.jpg',
        };
      })
    );

    return persistedUris;
  } catch (error) {
    console.error('Error picking images from gallery:', error);
    return [];
  }
};

// Take photo using device camera
export const takePhotoWithCamera = async () => {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      alert('Camera permission is required to capture receipts/photos.');
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];
    const localUri = await persistImageLocally(asset.uri);
    return {
      localUri,
      fileName: asset.fileName || localUri.split('/').pop() || 'camera_photo.jpg',
    };
  } catch (error) {
    console.error('Error taking photo with camera:', error);
    return null;
  }
};

// Delete a locally stored image file safely
export const deleteLocalImageFile = async (uri) => {
  if (Platform.OS === 'web' || !uri) return;
  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch (error) {
    console.warn('Error deleting local image file:', error);
  }
};

export const getImageDirectory = () => IMAGES_DIR;

// Check if an image file exists locally, or resolve from fileName inside persistent IMAGES_DIR
export const resolveLocalImageUri = async (uri, fileName) => {
  if (Platform.OS === 'web' || !uri) return uri;

  // 1. Direct path check
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info && info.exists && info.size > 0) {
      return uri;
    }
  } catch (e) {}

  // 2. Check without file:// prefix or with file:// prefix
  try {
    const alt = uri.startsWith('file://') ? uri.replace('file://', '') : `file://${uri}`;
    const infoAlt = await FileSystem.getInfoAsync(alt);
    if (infoAlt && infoAlt.exists && infoAlt.size > 0) {
      return alt;
    }
  } catch (e) {}

  // 3. Fallback to current persistent directory + fileName
  const cleanName = fileName || uri.split('/').pop();
  if (IMAGES_DIR && cleanName) {
    const candidate = `${IMAGES_DIR}${cleanName}`;
    try {
      const infoCand = await FileSystem.getInfoAsync(candidate);
      if (infoCand && infoCand.exists && infoCand.size > 0) {
        return candidate;
      }
    } catch (e) {}
  }

  // 4. Check cache directory candidate
  if (FileSystem.cacheDirectory && cleanName) {
    const cacheCandidate = `${FileSystem.cacheDirectory}${cleanName}`;
    try {
      const infoCache = await FileSystem.getInfoAsync(cacheCandidate);
      if (infoCache && infoCache.exists && infoCache.size > 0) {
        return cacheCandidate;
      }
    } catch (e) {}
  }

  return null;
};

// Extract safe MIME type for multipart upload
export const getImageMimeType = (uri, fileName) => {
  const name = (fileName || uri || '').toLowerCase();
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
};

// Download a remote receipt image from server and store persistently
export const downloadAndSaveImageLocally = async (remoteUrl, fileName, token = null) => {
  if (Platform.OS === 'web' || !remoteUrl) return null;

  try {
    await ensureImageDirectoryExists();
    const cleanName = fileName || remoteUrl.split('/').pop() || `receipt_${Date.now()}.jpg`;
    const targetLocalUri = `${IMAGES_DIR}${cleanName}`;

    // If file already exists and is non-empty, avoid downloading again
    try {
      const existingInfo = await FileSystem.getInfoAsync(targetLocalUri);
      if (existingInfo && existingInfo.exists && existingInfo.size > 0) {
        return targetLocalUri;
      }
    } catch (e) {}

    const res = await FileSystem.downloadAsync(remoteUrl, targetLocalUri, {
      headers: {
        'ngrok-skip-browser-warning': 'true',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });

    if (res.status === 200) {
      return targetLocalUri;
    }
    console.warn(`[ImageService] HTTP ${res.status} downloading ${remoteUrl}`);
    return null;
  } catch (err) {
    console.warn(`[ImageService] Error downloading remote image ${remoteUrl}:`, err);
    return null;
  }
};

