import React, { useRef, useState } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  Platform,
  Animated,
  Vibration,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/colors';
import { Typography, Shadows, BorderRadius } from '../../constants/theme';
import { useApp } from '../../context/AppContext';

const HOLD_DURATION = 450; // ms to trigger long press transition

export const FloatingAddButton = ({ style }) => {
  const insets = useSafeAreaInsets();
  const { openAddTransaction } = useApp();

  const [isHolding, setIsHolding] = useState(false);
  const isLongPressTriggeredRef = useRef(false);

  // Animated values
  const animProgress = useRef(new Animated.Value(0)).current; // 0 = Green (You Got), 1 = Red (You Gave)
  const animScale = useRef(new Animated.Value(1)).current;
  const animRipple = useRef(new Animated.Value(0)).current;
  const animTooltip = useRef(new Animated.Value(0)).current;

  const triggerHaptic = () => {
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
    } catch (e) {
      // Fallback
      Vibration.vibrate(60);
    }
  };

  const handlePressIn = () => {
    isLongPressTriggeredRef.current = false;
    setIsHolding(true);

    // Animate color, scale, and ripple
    Animated.parallel([
      Animated.timing(animProgress, {
        toValue: 1,
        duration: HOLD_DURATION,
        useNativeDriver: false,
      }),
      Animated.timing(animScale, {
        toValue: 1.12,
        duration: HOLD_DURATION,
        useNativeDriver: false,
      }),
      Animated.timing(animRipple, {
        toValue: 1,
        duration: HOLD_DURATION,
        useNativeDriver: false,
      }),
      Animated.timing(animTooltip, {
        toValue: 1,
        duration: HOLD_DURATION * 0.8,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    setIsHolding(false);

    // If it was a short tap (not long press), smoothly revert
    Animated.parallel([
      Animated.spring(animProgress, {
        toValue: 0,
        friction: 6,
        useNativeDriver: false,
      }),
      Animated.spring(animScale, {
        toValue: 1,
        friction: 6,
        useNativeDriver: false,
      }),
      Animated.timing(animRipple, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }),
      Animated.timing(animTooltip, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const handleLongPress = () => {
    isLongPressTriggeredRef.current = true;
    triggerHaptic();

    // Open modal with 'gave'
    openAddTransaction({ type: 'gave' });

    // Reset animations
    handlePressOut();
  };

  const handlePress = () => {
    // Normal quick tap -> defaults to 'got'
    if (!isLongPressTriggeredRef.current) {
      openAddTransaction({ type: 'got' });
    }
  };

  const bottomPosition = Math.max(insets.bottom, Platform.OS === 'android' ? 14 : 10) + 70;

  // Interpolate button background from Green (#10B981) to Red (#EF4444)
  const interpolatedBg = animProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.got, Colors.gave],
  });

  const rippleScale = animRipple.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1.45],
  });

  const rippleOpacity = animRipple.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.35, 0.15],
  });

  const tooltipTranslateY = animTooltip.interpolate({
    inputRange: [0, 1],
    outputRange: [10, -8],
  });

  return (
    <View style={[styles.wrapper, { bottom: bottomPosition }, style]} pointerEvents="box-none">
      {/* Floating Tooltip Pill during long press */}
      <Animated.View
        style={[
          styles.tooltipBadge,
          {
            opacity: animTooltip,
            transform: [{ translateY: tooltipTranslateY }],
          },
        ]}
        pointerEvents="none"
      >
        <Ionicons name="arrow-up-circle" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
        <Text style={styles.tooltipText}>You Gave ₹</Text>
      </Animated.View>

      {/* Ripple ring while holding */}
      <Animated.View
        style={[
          styles.rippleRing,
          {
            opacity: rippleOpacity,
            transform: [{ scale: rippleScale }],
          },
        ]}
        pointerEvents="none"
      />

      {/* Animated Floating Add Button */}
      <TouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onLongPress={handleLongPress}
        onPress={handlePress}
        delayLongPress={HOLD_DURATION}
        activeOpacity={0.9}
      >
        <Animated.View
          style={[
            styles.button,
            Shadows.floating,
            {
              backgroundColor: interpolatedBg,
              transform: [{ scale: animScale }],
            },
          ]}
        >
          <Ionicons name="add" size={32} color="#FFFFFF" />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    right: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
  },
  button: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rippleRing: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.gave,
    zIndex: -1,
  },
  tooltipBadge: {
    position: 'absolute',
    top: -34,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gave,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    ...Shadows.md,
  },
  tooltipText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.bold,
  },
});
