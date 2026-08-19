import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Colors } from '../../constants/colors';
import { Typography, Spacing, BorderRadius } from '../../constants/theme';

export const SegmentedControl = ({
  options = [],
  selectedIndex = 0,
  onChange,
  activeColor = Colors.primary,
  activeTextColor = Colors.textInverse,
}) => {
  return (
    <View style={styles.container}>
      {options.map((option, index) => {
        const isSelected = index === selectedIndex;
        const label = typeof option === 'string' ? option : option.label;
        const count = typeof option === 'object' ? option.count : null;

        return (
          <TouchableOpacity
            key={index}
            style={[
              styles.segment,
              isSelected && [styles.selectedSegment, { backgroundColor: activeColor }],
            ]}
            onPress={() => onChange(index)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.segmentText,
                isSelected && [styles.selectedSegmentText, { color: activeTextColor }],
              ]}
              numberOfLines={1}
            >
              {label}
              {count !== null && count !== undefined ? ` (${count})` : ''}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.md,
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.sm,
  },
  selectedSegment: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.medium,
    color: Colors.textSecondary,
  },
  selectedSegmentText: {
    fontWeight: Typography.fontWeights.bold,
  },
});
