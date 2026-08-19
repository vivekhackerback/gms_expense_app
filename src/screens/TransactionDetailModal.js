import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useApp } from '../context/AppContext';
import { Colors } from '../constants/colors';
import { Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';
import { formatCurrency, formatFullDateTime } from '../utils/formatters';
import { getTransactionById } from '../database/queries';

export const TransactionDetailModal = () => {
  const insets = useSafeAreaInsets();
  const {
    viewingTransactionId,
    closeTransactionDetails,
    openEditTransaction,
    deleteTransactionItem,
    openFullScreenImage,
  } = useApp();

  const [transaction, setTransaction] = useState(null);

  useEffect(() => {
    if (viewingTransactionId) {
      const tx = getTransactionById(viewingTransactionId);
      setTransaction(tx);
    } else {
      setTransaction(null);
    }
  }, [viewingTransactionId]);

  if (!viewingTransactionId || !transaction) return null;

  const isGave = transaction.type === 'gave';
  const typeText = isGave ? 'You Gave' : 'You Got';
  const modeText = transaction.paymentMode === 'cash' ? 'Cash' : 'Online';
  const { date, time } = formatFullDateTime(transaction.transactionDate || transaction.createdAt);

  const handleDelete = () => {
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to permanently delete this transaction?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteTransactionItem(transaction.id);
            closeTransactionDetails();
          },
        },
      ]
    );
  };

  const handleEdit = () => {
    const txToEdit = transaction;
    closeTransactionDetails();
    openEditTransaction(txToEdit);
  };

  return (
    <Modal
      visible={Boolean(viewingTransactionId)}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={closeTransactionDetails}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 6 }]}>
          <TouchableOpacity onPress={closeTransactionDetails} style={styles.closeBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Transaction Details</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleEdit} style={styles.actionIconBtn}>
              <Ionicons name="pencil-outline" size={20} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDelete} style={styles.actionIconBtn}>
              <Ionicons name="trash-outline" size={20} color={Colors.danger} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Main Card */}
          <View style={[styles.mainCard, Shadows.sm]}>
            <View style={styles.categoryHeader}>
              <View
                style={[
                  styles.categoryIconCircle,
                  { backgroundColor: isGave ? Colors.gaveBg : Colors.gotBg },
                ]}
              >
                <Ionicons
                  name={transaction.categoryIcon || 'grid-outline'}
                  size={24}
                  color={isGave ? Colors.gave : Colors.got}
                />
              </View>
              <Text style={styles.categoryName}>
                {transaction.categoryName || 'General'}
              </Text>
            </View>

            <View style={styles.amountSection}>
              <Text
                style={[
                  styles.typeLabel,
                  { color: isGave ? Colors.gaveDark : Colors.gotDark },
                ]}
              >
                {typeText}
              </Text>
              <Text
                style={[
                  styles.amount,
                  { color: isGave ? Colors.gave : Colors.got },
                ]}
              >
                {isGave ? '-' : '+'}{formatCurrency(transaction.amount)}
              </Text>
            </View>

            <View style={styles.modeAndDateRow}>
              <View
                style={[
                  styles.modeBadge,
                  transaction.paymentMode === 'cash' ? styles.cashBadge : styles.onlineBadge,
                ]}
              >
                <Ionicons
                  name={transaction.paymentMode === 'cash' ? 'cash-outline' : 'card-outline'}
                  size={14}
                  color={transaction.paymentMode === 'cash' ? '#B45309' : '#1D4ED8'}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.modeText,
                    transaction.paymentMode === 'cash' ? styles.cashText : styles.onlineText,
                  ]}
                >
                  {modeText}
                </Text>
              </View>

              <View style={styles.dateTimeContainer}>
                <Text style={styles.dateText}>{date}</Text>
                <Text style={styles.timeText}>{time}</Text>
              </View>
            </View>
          </View>

          {/* Party Details Card */}
          {transaction.partyName ? (
            <View style={[styles.infoCard, Shadows.sm]}>
              <Text style={styles.infoLabel}>PARTY</Text>
              <View style={styles.partyRow}>
                <View style={styles.partyAvatar}>
                  <Text style={styles.partyAvatarText}>
                    {transaction.partyName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View>
                  <Text style={styles.partyName}>{transaction.partyName}</Text>
                  {transaction.partyPhone ? (
                    <Text style={styles.partyPhone}>{transaction.partyPhone}</Text>
                  ) : null}
                </View>
              </View>
            </View>
          ) : null}

          {/* Note Card */}
          {transaction.note ? (
            <View style={[styles.infoCard, Shadows.sm]}>
              <Text style={styles.infoLabel}>NOTE</Text>
              <Text style={styles.noteContent}>{transaction.note}</Text>
            </View>
          ) : null}

          {/* Photos Card */}
          {transaction.images && transaction.images.length > 0 ? (
            <View style={[styles.infoCard, Shadows.sm]}>
              <Text style={styles.infoLabel}>ATTACHED PHOTOS ({transaction.images.length})</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
                {transaction.images.map((img) => (
                  <TouchableOpacity
                    key={img.id || img.localUri}
                    onPress={() => openFullScreenImage(img.localUri)}
                    activeOpacity={0.85}
                    style={styles.photoWrapper}
                  >
                    <Image source={{ uri: img.localUri }} style={styles.photoItem} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* Action Buttons */}
          <View style={styles.bottomButtonsRow}>
            <TouchableOpacity
              style={[styles.editButton, Shadows.sm]}
              onPress={handleEdit}
              activeOpacity={0.8}
            >
              <Ionicons name="create-outline" size={18} color={Colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.deleteButton, Shadows.sm]}
              onPress={handleDelete}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={18} color={Colors.danger} style={{ marginRight: 6 }} />
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTitle: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
  },
  closeBtn: {
    padding: Spacing.xs,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  actionIconBtn: {
    padding: Spacing.xs,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl * 2,
    gap: Spacing.md,
  },
  mainCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
  },
  categoryHeader: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  categoryIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  categoryName: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textSecondary,
  },
  amountSection: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  typeLabel: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  amount: {
    fontSize: Typography.fontSizes.amountHero,
    fontWeight: Typography.fontWeights.bold,
    letterSpacing: -0.5,
  },
  modeAndDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  cashBadge: {
    backgroundColor: Colors.cashLight,
  },
  onlineBadge: {
    backgroundColor: Colors.onlineLight,
  },
  modeText: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.bold,
  },
  cashText: {
    color: '#B45309',
  },
  onlineText: {
    color: '#1D4ED8',
  },
  dateTimeContainer: {
    alignItems: 'flex-end',
  },
  dateText: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.medium,
    color: Colors.textPrimary,
  },
  timeText: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textMuted,
  },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  infoLabel: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  partyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  partyAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  partyAvatarText: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.accent,
  },
  partyName: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textPrimary,
  },
  partyPhone: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  noteContent: {
    fontSize: Typography.fontSizes.md,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  photosScroll: {
    flexDirection: 'row',
    marginTop: Spacing.xs,
  },
  photoWrapper: {
    marginRight: Spacing.md,
  },
  photoItem: {
    width: 90,
    height: 90,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bottomButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  editButtonText: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.primary,
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.gaveBg,
    borderWidth: 1,
    borderColor: Colors.gaveLight,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  deleteButtonText: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.danger,
  },
});
