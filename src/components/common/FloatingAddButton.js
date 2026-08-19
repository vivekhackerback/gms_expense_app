import React from 'react';
import { StyleSheet, TouchableOpacity, View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../constants/colors';
import { Shadows } from '../../constants/theme';
import { useApp } from '../../context/AppContext';

export const FloatingAddButton = ({ style, onPress }) => {
  const insets = useSafeAreaInsets();
  const { openAddTransaction } = useApp();

  const handlePress = () => {
    if (onPress) onPress();
    else openAddTransaction();
  };

  const bottomPosition = Math.max(insets.bottom, Platform.OS === 'android' ? 14 : 10) + 70;

  return (
    <TouchableOpacity
      style={[styles.button, Shadows.floating, { bottom: bottomPosition }, style]}
      onPress={handlePress}
      activeOpacity={0.85}
    >
      <Ionicons name="add" size={32} color="#FFFFFF" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: 20,
    zIndex: 99,
  },
});
