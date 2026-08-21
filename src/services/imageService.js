import * as ImagePicker from 'expo-image-picker';
import { File, Directory, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

export const getImagesDirectory = () => {
  if (Platform.OS === 'web') return null;
  try {
    return new Directory(Paths.document, 'transaction_photos');
  } catch (e) {
    return null;
  }
};

export const getImagesDirectoryUri = () => {
  const dir = getImagesDirectory();
  return dir ? `${dir.uri.replace(/\/*$/, '')}/` : null;
};

// Ensure persistent images directory exists
export const ensureImageDirectoryExists = async () => {
  if (Platform.OS === 'web') return;
  try {
    const dir = getImagesDirectory();
    if (dir && !dir.exists) {
      dir.create();
    }
  } catch (error) {
    console.warn('Error ensuring image directory:', error);
  }
};

// Copy an image to the app's persistent storage so it is never lost
export const persistImageLocally = async (tempUri) => {
  if (Platform.OS === 'web' || !tempUri) {
    return tempUri;
  }

  try {
    await ensureImageDirectoryExists();
    const imagesDir = getImagesDirectory();
    if (!imagesDir) return tempUri;

    const fileName = `img_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
    const targetFile = new File(imagesDir, fileName);
    const sourceFile = new File(tempUri);

    if (sourceFile.exists) {
      sourceFile.copy(targetFile);
      return targetFile.uri;
    }
    return tempUri;
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
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch (error) {
    console.warn('Error deleting local image file:', error);
  }
};
