import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../constants/colors';
import { Shadows } from '../../constants/theme';
import { useApp } from '../../context/AppContext';

export const FloatingAddButton = ({ style, onPress }) => {
  const { openAddTransaction } = useApp();

  const handlePress = () => {
    if (onPress) onPress();
    else openAddTransaction();
  };

  return (
    <TouchableOpacity
      style={[styles.button, Shadows.floating, style]}
      onPress={handlePress}
      activeOpacity={0.85}
    >
      <Ionicons name="add" size={32} color="#FFFFFF" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    bottom: 24,
    right: 20,
    zIndex: 99,
  },
});
