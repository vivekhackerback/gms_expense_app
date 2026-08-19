import React from 'react';
import { StyleSheet, View, Image, TouchableOpacity, Modal, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useApp } from '../../context/AppContext';
import { Colors } from '../../constants/colors';
import { Spacing } from '../../constants/theme';

const { width, height } = Dimensions.get('window');

export const FullScreenImageViewer = () => {
  const { fullScreenImageUri, closeFullScreenImage } = useApp();

  if (!fullScreenImageUri) return null;

  return (
    <Modal
      visible={Boolean(fullScreenImageUri)}
      transparent={true}
      animationType="fade"
      onRequestClose={closeFullScreenImage}
    >
      <SafeAreaView style={styles.container}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={closeFullScreenImage}
          activeOpacity={0.8}
        >
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.imageWrapper}>
          <Image
            source={{ uri: fullScreenImageUri }}
            style={styles.image}
            resizeMode="contain"
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.25)',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrapper: {
    width: width,
    height: height * 0.85,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
