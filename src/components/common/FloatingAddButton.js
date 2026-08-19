import React, { useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Platform,
  Animated,
  Vibration,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/colors';
import { Typography, Shadows, BorderRadius } from '../../constants/theme';
import { useApp } from '../../context/AppContext';

const LONG_PRESS_THRESHOLD = 2000; // 2000ms (2 seconds)

export const FloatingAddButton = ({ style }) => {
  const insets = useSafeAreaInsets();
  const { openAddTransaction } = useApp();

  const [isGaveActive, setIsGaveActive] = useState(false);
  const isGaveActiveRef = useRef(false);
  const holdTimerRef = useRef(null);
  const hasVibratedRef = useRef(false);

  // Animated values
  const animProgress = useRef(new Animated.Value(0)).current; // 0 = Green, 1 = Red
  const animScale = useRef(new Animated.Value(1)).current;
  const animRipple = useRef(new Animated.Value(0)).current;
  const animTooltip = useRef(new Animated.Value(0)).current;
  const holdProgress = useRef(new Animated.Value(0)).current; // 0 to 1 during 2s hold

  // Reliable Haptic Feedback triggering ONCE on real Android & iOS hardware
  const triggerHaptic = () => {
    if (hasVibratedRef.current) return;
    hasVibratedRef.current = true;

    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      // Guarantee vibration on physical Android devices
      Vibration.vibrate(Platform.OS === 'android' ? 120 : 60);
    } catch (e) {
      try {
        Vibration.vibrate(100);
      } catch (err) {}
    }
  };

  const startHoldAnimation = () => {
    // Breathing scale animation during the 2s hold
    Animated.sequence([
      Animated.timing(animScale, {
        toValue: 1.08,
        duration: 700,
        useNativeDriver: false,
      }),
      Animated.timing(animScale, {
        toValue: 1.04,
        duration: 600,
        useNativeDriver: false,
      }),
      Animated.timing(animScale, {
        toValue: 1.12,
        duration: 700,
        useNativeDriver: false,
      }),
    ]).start();

    // Progress timer filling up
    Animated.timing(holdProgress, {
      toValue: 1,
      duration: LONG_PRESS_THRESHOLD,
      useNativeDriver: false,
    }).start();
  };

  const triggerGaveState = () => {
    isGaveActiveRef.current = true;
    setIsGaveActive(true);

    // Trigger physical vibration
    triggerHaptic();

    // Morph Green -> Red + Pulse Bounce + Badge Popup + Outer Glow Ring
    Animated.parallel([
      Animated.timing(animProgress, {
        toValue: 1,
        duration: 280,
        useNativeDriver: false,
      }),
      Animated.sequence([
        Animated.timing(animScale, {
          toValue: 1.28,
          duration: 160,
          useNativeDriver: false,
        }),
        Animated.spring(animScale, {
          toValue: 1.14,
          friction: 4,
          tension: 80,
          useNativeDriver: false,
        }),
      ]),
      Animated.timing(animRipple, {
        toValue: 1,
        duration: 400,
        useNativeDriver: false,
      }),
      Animated.spring(animTooltip, {
        toValue: 1,
        friction: 5,
        tension: 100,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const handlePressIn = () => {
    isGaveActiveRef.current = false;
    hasVibratedRef.current = false;
    setIsGaveActive(false);

    // Start breathing animation
    startHoldAnimation();

    // Start exact 2000ms timer
    holdTimerRef.current = setTimeout(() => {
      triggerGaveState();
    }, LONG_PRESS_THRESHOLD);
  };

  const resetAnimations = () => {
    Animated.parallel([
      Animated.timing(animProgress, {
        toValue: 0,
        duration: 200,
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
      Animated.timing(holdProgress, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }),
    ]).start(() => {
      setIsGaveActive(false);
      isGaveActiveRef.current = false;
      hasVibratedRef.current = false;
    });
  };

  const handlePressOut = () => {
    // Clear timer
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    const wasGaveTriggered = isGaveActiveRef.current;

    // Reset visual state
    resetAnimations();

    // Open appropriate modal based on whether 2-second threshold was reached
    if (wasGaveTriggered) {
      // 2+ seconds hold -> You Gave
      openAddTransaction({ type: 'gave' });
    } else {
      // Released before 2 seconds -> You Got
      openAddTransaction({ type: 'got' });
    }
  };

  const bottomPosition = Math.max(insets.bottom, Platform.OS === 'android' ? 14 : 10) + 70;

  // Background color interpolation: Green (#10B981) -> Red (#EF4444)
  const interpolatedBg = animProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.got, Colors.gave],
  });

  const rippleScale = animRipple.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1.6],
  });

  const rippleOpacity = animRipple.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0, 0.45, 0],
  });

  const tooltipTranslateY = animTooltip.interpolate({
    inputRange: [0, 1],
    outputRange: [12, -10],
  });

  const tooltipScale = animTooltip.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1],
  });

  return (
    <View style={[styles.wrapper, { bottom: bottomPosition }, style]} pointerEvents="box-none">
      {/* Prominent Floating "YOU GAVE" Badge */}
      <Animated.View
        style={[
          styles.tooltipBadge,
          {
            opacity: animTooltip,
            transform: [
              { translateY: tooltipTranslateY },
              { scale: tooltipScale },
            ],
          },
        ]}
        pointerEvents="none"
      >
        <Ionicons name="arrow-up-circle" size={16} color="#FFFFFF" style={{ marginRight: 5 }} />
        <Text style={styles.tooltipText}>YOU GAVE</Text>
      </Animated.View>

      {/* Ripple ring animation on 2s activation */}
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

      {/* Touch Interactive Button with Pressable */}
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
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
          <Ionicons
            name={isGaveActive ? 'arrow-up' : 'add'}
            size={isGaveActive ? 30 : 34}
            color="#FFFFFF"
          />
        </Animated.View>
      </Pressable>
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
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  rippleRing: {
    position: 'absolute',
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: Colors.gave,
    zIndex: -1,
  },
  tooltipBadge: {
    position: 'absolute',
    top: -38,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    ...Shadows.lg,
  },
  tooltipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: Typography.fontWeights.bold,
    letterSpacing: 0.8,
  },
});
