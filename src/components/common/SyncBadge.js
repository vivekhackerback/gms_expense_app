import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../constants/colors';
import { Typography, Spacing, BorderRadius } from '../../constants/theme';
import { useApp } from '../../context/AppContext';

export const SyncBadge = () => {
  const { syncStats, isSyncing, openBackupReport, networkStatus } = useApp();

  const handlePress = () => {
    openBackupReport();
  };

  if (isSyncing) {
    return (
      <View style={[styles.container, styles.syncingBg]}>
        <ActivityIndicator size="small" color={Colors.online} style={{ marginRight: 4 }} />
        <Text style={[styles.text, { color: Colors.online }]}>Syncing...</Text>
      </View>
    );
  }

  if (syncStats.pendingCount > 0) {
    return (
      <TouchableOpacity
        style={[styles.container, styles.pendingBg]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <Ionicons name="cloud-upload-outline" size={13} color={Colors.warning} style={{ marginRight: 4 }} />
        <Text style={[styles.text, { color: '#B45309' }]}>
          {syncStats.pendingCount} {syncStats.pendingCount === 1 ? 'pending' : 'pending'}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.container, styles.syncedBg]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Ionicons name="checkmark-circle" size={13} color={Colors.got} style={{ marginRight: 4 }} />
      <Text style={[styles.text, { color: Colors.gotDark }]}>All data synced</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  syncedBg: {
    backgroundColor: Colors.gotBg,
    borderColor: Colors.gotLight,
  },
  pendingBg: {
    backgroundColor: Colors.cashBg,
    borderColor: Colors.cashLight,
  },
  syncingBg: {
    backgroundColor: Colors.onlineBg,
    borderColor: Colors.onlineLight,
  },
  text: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.medium,
  },
});
