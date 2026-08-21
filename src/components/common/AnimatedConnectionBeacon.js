import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Animated, Easing } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../constants/colors';
import { Typography, BorderRadius } from '../../constants/theme';

/**
 * AnimatedConnectionBeacon
 * 
 * Provides dynamic animations for server connection status:
 * - Online / Healthy: Smooth green pulsating ripple effect & glowing dot.
 * - Checking / Syncing: Continuous rotating spinner / pulsing radar ring.
 * - Offline / Failed: Subtle shake / blink warning animation.
 */
export const AnimatedConnectionBeacon = ({
  status = 'working', // 'working', 'checking', 'failed', 'offline'
  size = 'md', // 'sm', 'md', 'lg'
  showLabel = false,
  labelText = '',
  latencyMs = null,
}) => {
  // Animation Values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rippleAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const isWorking = status === 'working' || status === 'online' || status === 'synced';
  const isChecking = status === 'checking' || status === 'uploading' || status === 'syncing';
  const isFailed = status === 'failed' || status === 'offline' || status === 'error';

  useEffect(() => {
    let rippleLoop = null;
    let rotateLoop = null;
    let pulseLoop = null;

    if (isWorking) {
      // Smooth breathing pulse & wave ripple
      rippleAnim.setValue(0);
      rippleLoop = Animated.loop(
        Animated.parallel([
          Animated.timing(rippleAnim, {
            toValue: 1,
            duration: 2200,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.15,
              duration: 1100,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1100,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      rippleLoop.start();
    } else if (isChecking) {
      // Rotation for checking/syncing
      rotateAnim.setValue(0);
      rotateLoop = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      rotateLoop.start();
    } else if (isFailed) {
      // Subtle alert pulse / shake
      pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(shakeAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(shakeAnim, {
            toValue: -1,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(shakeAnim, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.delay(1800),
        ])
      );
      pulseLoop.start();
    }

    return () => {
      rippleLoop?.stop();
      rotateLoop?.stop();
      pulseLoop?.stop();
    };
  }, [status, isWorking, isChecking, isFailed]);

  // Dimensions
  const dotSize = size === 'lg' ? 18 : size === 'sm' ? 9 : 12;
  const rippleSize = dotSize * 2.8;

  // Colors
  const mainColor = isWorking ? '#059669' : isChecking ? '#2563EB' : '#DC2626';
  const rippleColor = isWorking ? 'rgba(16, 185, 129, 0.35)' : isChecking ? 'rgba(59, 130, 246, 0.3)' : 'rgba(239, 68, 68, 0.25)';
  const labelColor = isWorking ? '#059669' : isChecking ? '#2563EB' : '#DC2626';

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const shakeTranslateX = shakeAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-3, 0, 3],
  });

  const rippleScale = rippleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 2.2],
  });

  const rippleOpacity = rippleAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.7, 0.3, 0],
  });

  return (
    <View style={styles.container}>
      <View style={[styles.beaconWrapper, { width: rippleSize, height: rippleSize }]}>
        {/* Animated Expanding Ripple Wave */}
        {isWorking && (
          <Animated.View
            style={[
              styles.rippleWave,
              {
                width: dotSize * 1.5,
                height: dotSize * 1.5,
                borderRadius: (dotSize * 1.5) / 2,
                backgroundColor: rippleColor,
                transform: [{ scale: rippleScale }],
                opacity: rippleOpacity,
              },
            ]}
          />
        )}

        {/* Core Dot / Indicator */}
        {isChecking ? (
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Ionicons name="sync-circle" size={dotSize * 1.5} color={mainColor} />
          </Animated.View>
        ) : isFailed ? (
          <Animated.View style={{ transform: [{ translateX: shakeTranslateX }] }}>
            <View
              style={[
                styles.dot,
                {
                  width: dotSize,
                  height: dotSize,
                  borderRadius: dotSize / 2,
                  backgroundColor: mainColor,
                  shadowColor: mainColor,
                },
              ]}
            >
              <View style={styles.innerDot} />
            </View>
          </Animated.View>
        ) : (
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <View
              style={[
                styles.dot,
                {
                  width: dotSize,
                  height: dotSize,
                  borderRadius: dotSize / 2,
                  backgroundColor: mainColor,
                  shadowColor: mainColor,
                },
              ]}
            >
              <View style={styles.innerDot} />
            </View>
          </Animated.View>
        )}
      </View>

      {/* Optional Status Label & Latency */}
      {showLabel && (
        <View style={styles.labelContainer}>
          <Text style={[styles.labelText, { color: labelColor }]}>
            {labelText || (isWorking ? 'Connected' : isChecking ? 'Checking...' : 'Offline')}
          </Text>
          {latencyMs != null && latencyMs > 0 && (
            <Text style={styles.latencyText}>{latencyMs}ms</Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  beaconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  rippleWave: {
    position: 'absolute',
  },
  dot: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 4,
  },
  innerDot: {
    width: '40%',
    height: '40%',
    borderRadius: 99,
    backgroundColor: '#FFFFFF',
    opacity: 0.9,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 4,
  },
  labelText: {
    fontSize: 12,
    fontWeight: Typography.fontWeights.bold,
  },
  latencyText: {
    fontSize: 10.5,
    color: Colors.textSecondary,
    backgroundColor: Colors.surfaceSubtle,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: BorderRadius.xs || 4,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
});
