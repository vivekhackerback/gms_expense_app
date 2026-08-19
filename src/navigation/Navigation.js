import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useApp } from '../context/AppContext';
import { Colors } from '../constants/colors';
import { Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';

// Screens
import { HomeScreen } from '../screens/HomeScreen';
import { TransactionsScreen } from '../screens/TransactionsScreen';
import { KhataScreen } from '../screens/KhataScreen';
import { ReportsScreen } from '../screens/ReportsScreen';
import { MoreScreen } from '../screens/MoreScreen';

// Modals & Overlays
import { AddTransactionModal } from '../screens/AddTransactionModal';
import { TransactionDetailModal } from '../screens/TransactionDetailModal';
import { PartyDetailScreen } from '../screens/PartyDetailScreen';
import { FullScreenImageViewer } from '../components/modals/FullScreenImageViewer';
import { ManageCategoriesModal } from '../components/modals/ManageCategoriesModal';
import { ManagePartiesModal } from '../components/modals/ManagePartiesModal';
import { FloatingAddButton } from '../components/common/FloatingAddButton';

const TABS = [
  { name: 'Home', icon: 'home-outline', iconActive: 'home' },
  { name: 'Transactions', icon: 'receipt-outline', iconActive: 'receipt' },
  { name: 'Khata', icon: 'people-outline', iconActive: 'people' },
  { name: 'Reports', icon: 'pie-chart-outline', iconActive: 'pie-chart' },
  { name: 'More', icon: 'ellipsis-horizontal-circle-outline', iconActive: 'ellipsis-horizontal-circle' },
];

export const Navigation = () => {
  const insets = useSafeAreaInsets();
  const { activeTab, setActiveTab, openAddTransaction } = useApp();

  const renderActiveScreen = () => {
    switch (activeTab) {
      case 'Home':
        return <HomeScreen />;
      case 'Transactions':
        return <TransactionsScreen />;
      case 'Khata':
        return <KhataScreen />;
      case 'Reports':
        return <ReportsScreen />;
      case 'More':
        return <MoreScreen />;
      default:
        return <HomeScreen />;
    }
  };

  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 8);

  return (
    <View style={styles.container}>
      <View style={styles.screenContainer}>
        {renderActiveScreen()}
      </View>

      {/* Floating Add Action Button on Home, Transactions, and Khata tabs */}
      {(activeTab === 'Home' || activeTab === 'Transactions' || activeTab === 'Khata') && (
        <FloatingAddButton />
      )}

      {/* Bottom Navigation Bar with Safe Area Bottom Insets */}
      <View style={[styles.bottomBarWrapper, { paddingBottom: bottomPadding }]}>
        <View style={styles.bottomBar}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.name;
            return (
              <TouchableOpacity
                key={tab.name}
                style={styles.tabItem}
                onPress={() => setActiveTab(tab.name)}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
              >
                <Ionicons
                  name={isActive ? tab.iconActive : tab.icon}
                  size={23}
                  color={isActive ? Colors.primaryDark : Colors.textMuted}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    isActive && styles.tabLabelActive,
                  ]}
                  numberOfLines={1}
                >
                  {tab.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Modals and Overlays */}
      <AddTransactionModal />
      <TransactionDetailModal />
      <PartyDetailScreen />
      <FullScreenImageViewer />
      <ManageCategoriesModal />
      <ManagePartiesModal />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  screenContainer: {
    flex: 1,
  },
  bottomBarWrapper: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    ...Shadows.md,
  },
  bottomBar: {
    flexDirection: 'row',
    height: 60,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.surface,
    paddingTop: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  tabLabel: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textMuted,
    fontWeight: Typography.fontWeights.medium,
    marginTop: 3,
  },
  tabLabelActive: {
    color: Colors.primaryDark,
    fontWeight: Typography.fontWeights.bold,
  },
});
