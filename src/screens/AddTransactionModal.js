import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useApp } from '../context/AppContext';
import { Colors } from '../constants/colors';
import { Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';
import { pickImagesFromGallery, takePhotoWithCamera } from '../services/imageService';

export const AddTransactionModal = () => {
  const {
    isAddTransactionOpen,
    addTransactionDefaults,
    editingTransaction,
    closeAddTransaction,
    saveTransaction,
    categories,
    parties,
    saveParty,
    openFullScreenImage,
  } = useApp();

  const [amount, setAmount] = useState('');
  const [type, setType] = useState('gave'); // 'gave' | 'got'
  const [paymentMode, setPaymentMode] = useState('cash'); // 'cash' | 'online'
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [selectedPartyId, setSelectedPartyId] = useState(null);
  const [note, setNote] = useState('');
  const [images, setImages] = useState([]); // [{ localUri, fileName }]
  
  // Quick Party Creation inline
  const [isAddingPartyInline, setIsAddingPartyInline] = useState(false);
  const [inlinePartyName, setInlinePartyName] = useState('');

  // Sync state with open defaults or editing item
  useEffect(() => {
    if (isAddTransactionOpen) {
      if (editingTransaction) {
        setAmount(String(editingTransaction.amount || ''));
        setType(editingTransaction.type || 'gave');
        setPaymentMode(editingTransaction.paymentMode || 'cash');
        setSelectedCategoryId(editingTransaction.categoryId || null);
        setSelectedPartyId(editingTransaction.partyId || null);
        setNote(editingTransaction.note || '');
        setImages(editingTransaction.images || []);
      } else {
        setAmount('');
        setType(addTransactionDefaults.type || 'gave');
        setPaymentMode(addTransactionDefaults.paymentMode || 'cash');
        setSelectedCategoryId(categories[0]?.id || null);
        setSelectedPartyId(addTransactionDefaults.partyId || null);
        setNote('');
        setImages([]);
      }
      setIsAddingPartyInline(false);
      setInlinePartyName('');
    }
  }, [isAddTransactionOpen, editingTransaction, addTransactionDefaults, categories]);

  if (!isAddTransactionOpen) return null;

  const handlePickGallery = async () => {
    const picked = await pickImagesFromGallery();
    if (picked && picked.length > 0) {
      setImages((prev) => [...prev, ...picked]);
    }
  };

  const handleCaptureCamera = async () => {
    const captured = await takePhotoWithCamera();
    if (captured) {
      setImages((prev) => [...prev, captured]);
    }
  };

  const handleRemoveImage = (indexToRemove) => {
    setImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleAddPartyInline = () => {
    if (!inlinePartyName.trim()) {
      setIsAddingPartyInline(false);
      return;
    }
    const newParty = saveParty({ name: inlinePartyName.trim() });
    setSelectedPartyId(newParty.id);
    setInlinePartyName('');
    setIsAddingPartyInline(false);
  };

  const handleSave = () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than ₹0.');
      return;
    }

    try {
      saveTransaction({
        amount: numAmount,
        type,
        paymentMode,
        categoryId: selectedCategoryId,
        partyId: selectedPartyId,
        note: note.trim(),
        transactionDate: editingTransaction?.transactionDate || new Date().toISOString(),
        images,
      });
      closeAddTransaction();
    } catch (err) {
      Alert.alert('Save Error', 'Failed to save transaction: ' + err.message);
    }
  };

  return (
    <Modal
      visible={isAddTransactionOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={closeAddTransaction}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={closeAddTransaction} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {editingTransaction ? 'Edit Transaction' : 'New Transaction'}
            </Text>
            <View style={{ width: 32 }} />
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Amount Hero Input */}
            <View style={styles.amountContainer}>
              <Text style={styles.currencySymbol}>₹</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0"
                placeholderTextColor={Colors.textMuted}
                value={amount}
                onChangeText={(val) => {
                  // Allow numbers and one decimal point only
                  const sanitized = val.replace(/[^0-9.]/g, '');
                  setAmount(sanitized);
                }}
                keyboardType="numeric"
                autoFocus={!editingTransaction}
                selectTextOnFocus
              />
            </View>

            {/* Transaction Type: [ You Gave ] [ You Got ] */}
            <Text style={styles.sectionLabel}>TRANSACTION TYPE</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  type === 'gave' && styles.typeButtonGaveActive,
                ]}
                onPress={() => setType('gave')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="arrow-up-circle"
                  size={20}
                  color={type === 'gave' ? '#FFFFFF' : Colors.gave}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.typeButtonText,
                    type === 'gave' && styles.typeButtonTextActive,
                    { color: type === 'gave' ? '#FFFFFF' : Colors.gaveDark },
                  ]}
                >
                  You Gave
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.typeButton,
                  type === 'got' && styles.typeButtonGotActive,
                ]}
                onPress={() => setType('got')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="arrow-down-circle"
                  size={20}
                  color={type === 'got' ? '#FFFFFF' : Colors.got}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.typeButtonText,
                    type === 'got' && styles.typeButtonTextActive,
                    { color: type === 'got' ? '#FFFFFF' : Colors.gotDark },
                  ]}
                >
                  You Got
                </Text>
              </TouchableOpacity>
            </View>

            {/* Payment Mode: [ Cash ] [ Online ] */}
            <Text style={styles.sectionLabel}>PAYMENT MODE</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  paymentMode === 'cash' && styles.modeButtonCashActive,
                ]}
                onPress={() => setPaymentMode('cash')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="cash-outline"
                  size={18}
                  color={paymentMode === 'cash' ? '#FFFFFF' : '#B45309'}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.modeButtonText,
                    paymentMode === 'cash' && styles.modeButtonTextActive,
                    { color: paymentMode === 'cash' ? '#FFFFFF' : '#B45309' },
                  ]}
                >
                  Cash
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modeButton,
                  paymentMode === 'online' && styles.modeButtonOnlineActive,
                ]}
                onPress={() => setPaymentMode('online')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="card-outline"
                  size={18}
                  color={paymentMode === 'online' ? '#FFFFFF' : '#1D4ED8'}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.modeButtonText,
                    paymentMode === 'online' && styles.modeButtonTextActive,
                    { color: paymentMode === 'online' ? '#FFFFFF' : '#1D4ED8' },
                  ]}
                >
                  Online
                </Text>
              </TouchableOpacity>
            </View>

            {/* Category Selector */}
            <Text style={styles.sectionLabel}>CATEGORY</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScroll}
            >
              {categories.map((cat) => {
                const isSelected = selectedCategoryId === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryChip,
                      isSelected && [styles.selectedCategoryChip, { borderColor: cat.color || Colors.primary }],
                    ]}
                    onPress={() => setSelectedCategoryId(cat.id)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.catIconCircle,
                        { backgroundColor: isSelected ? (cat.color || Colors.primary) : Colors.surfaceSubtle },
                      ]}
                    >
                      <Ionicons
                        name={cat.icon || 'grid-outline'}
                        size={16}
                        color={isSelected ? '#FFFFFF' : (cat.color || Colors.textSecondary)}
                      />
                    </View>
                    <Text
                      style={[
                        styles.categoryChipText,
                        isSelected && { fontWeight: Typography.fontWeights.bold, color: Colors.textPrimary },
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Party Selector (Optional) */}
            <View style={styles.partyHeaderRow}>
              <Text style={styles.sectionLabel}>PARTY (OPTIONAL)</Text>
              {!isAddingPartyInline && (
                <TouchableOpacity
                  onPress={() => setIsAddingPartyInline(true)}
                  style={styles.addPartyQuickBtn}
                >
                  <Ionicons name="add" size={16} color={Colors.accent} />
                  <Text style={styles.addPartyQuickText}>New Party</Text>
                </TouchableOpacity>
              )}
            </View>

            {isAddingPartyInline ? (
              <View style={styles.inlinePartyForm}>
                <TextInput
                  style={styles.inlinePartyInput}
                  placeholder="Enter Party Name..."
                  placeholderTextColor={Colors.textMuted}
                  value={inlinePartyName}
                  onChangeText={setInlinePartyName}
                  autoFocus
                />
                <TouchableOpacity
                  style={styles.inlinePartySaveBtn}
                  onPress={handleAddPartyInline}
                >
                  <Text style={styles.inlinePartySaveText}>Add</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.inlinePartyCancelBtn}
                  onPress={() => {
                    setIsAddingPartyInline(false);
                    setInlinePartyName('');
                  }}
                >
                  <Ionicons name="close" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.partyScroll}
              >
                <TouchableOpacity
                  style={[
                    styles.partyChip,
                    selectedPartyId === null && styles.selectedPartyChip,
                  ]}
                  onPress={() => setSelectedPartyId(null)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.partyChipText,
                      selectedPartyId === null && styles.selectedPartyChipText,
                    ]}
                  >
                    None
                  </Text>
                </TouchableOpacity>

                {parties.map((p) => {
                  const isSelected = selectedPartyId === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.partyChip,
                        isSelected && styles.selectedPartyChip,
                      ]}
                      onPress={() => setSelectedPartyId(p.id)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.partyChipText,
                          isSelected && styles.selectedPartyChipText,
                        ]}
                      >
                        {p.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Note Input */}
            <Text style={styles.sectionLabel}>NOTE / DESCRIPTION (OPTIONAL)</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="e.g. Lunch with team, monthly internet bill..."
              placeholderTextColor={Colors.textMuted}
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={2}
            />

            {/* Photos & Receipts (Multiple Support) */}
            <Text style={styles.sectionLabel}>PHOTOS / BILLS</Text>
            <View style={styles.photosContainer}>
              <View style={styles.photoActionsRow}>
                <TouchableOpacity
                  style={styles.addPhotoBtn}
                  onPress={handleCaptureCamera}
                  activeOpacity={0.7}
                >
                  <Ionicons name="camera-outline" size={20} color={Colors.primary} />
                  <Text style={styles.addPhotoText}>Camera</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.addPhotoBtn}
                  onPress={handlePickGallery}
                  activeOpacity={0.7}
                >
                  <Ionicons name="images-outline" size={20} color={Colors.primary} />
                  <Text style={styles.addPhotoText}>Gallery</Text>
                </TouchableOpacity>
              </View>

              {images.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbnailsScroll}>
                  {images.map((img, index) => {
                    const uri = typeof img === 'string' ? img : (img.localUri || img.uri);
                    return (
                      <View key={index} style={styles.thumbnailWrapper}>
                        <TouchableOpacity
                          onPress={() => openFullScreenImage(uri)}
                          activeOpacity={0.9}
                        >
                          <Image source={{ uri }} style={styles.thumbnailImage} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.removeImageBadge}
                          onPress={() => handleRemoveImage(index)}
                        >
                          <Ionicons name="close" size={14} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            {/* Save Transaction Button */}
            <TouchableOpacity
              style={[styles.saveButton, Shadows.md]}
              onPress={handleSave}
              activeOpacity={0.85}
            >
              <Text style={styles.saveButtonText}>Save Transaction</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl * 2,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xl,
    ...Shadows.sm,
  },
  currencySymbol: {
    fontSize: Typography.fontSizes.amountHero,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
    marginRight: Spacing.sm,
  },
  amountInput: {
    fontSize: Typography.fontSizes.amountHero,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
    minWidth: 120,
    textAlign: 'left',
  },
  sectionLabel: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  typeButtonGaveActive: {
    backgroundColor: Colors.gave,
    borderColor: Colors.gave,
  },
  typeButtonGotActive: {
    backgroundColor: Colors.got,
    borderColor: Colors.got,
  },
  typeButtonText: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
  },
  typeButtonTextActive: {
    color: '#FFFFFF',
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  modeButtonCashActive: {
    backgroundColor: Colors.cash,
    borderColor: Colors.cash,
  },
  modeButtonOnlineActive: {
    backgroundColor: Colors.online,
    borderColor: Colors.online,
  },
  modeButtonText: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
  },
  modeButtonTextActive: {
    color: '#FFFFFF',
  },
  categoryScroll: {
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
    marginBottom: Spacing.md,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: Spacing.xs,
  },
  selectedCategoryChip: {
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 2,
  },
  catIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  categoryChipText: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeights.medium,
  },
  partyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  addPartyQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 2,
    paddingHorizontal: Spacing.xs,
  },
  addPartyQuickText: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.accent,
    fontWeight: Typography.fontWeights.semibold,
  },
  partyScroll: {
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
    marginBottom: Spacing.md,
  },
  partyChip: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: Spacing.xs,
  },
  selectedPartyChip: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  partyChipText: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeights.medium,
  },
  selectedPartyChipText: {
    color: '#FFFFFF',
    fontWeight: Typography.fontWeights.bold,
  },
  inlinePartyForm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  inlinePartyInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: Typography.fontSizes.sm,
    color: Colors.textPrimary,
  },
  inlinePartySaveBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
  },
  inlinePartySaveText: {
    color: '#FFFFFF',
    fontWeight: Typography.fontWeights.bold,
    fontSize: Typography.fontSizes.xs,
  },
  inlinePartyCancelBtn: {
    padding: Spacing.xs,
  },
  noteInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    fontSize: Typography.fontSizes.md,
    color: Colors.textPrimary,
    minHeight: 64,
    textAlignVertical: 'top',
    marginBottom: Spacing.lg,
  },
  photosContainer: {
    marginBottom: Spacing.xl,
  },
  photoActionsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  addPhotoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  addPhotoText: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.primary,
  },
  thumbnailsScroll: {
    flexDirection: 'row',
    marginTop: Spacing.xs,
  },
  thumbnailWrapper: {
    position: 'relative',
    marginRight: Spacing.md,
  },
  thumbnailImage: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  removeImageBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: Colors.danger,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    backgroundColor: Colors.primaryDark,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.fontWeights.bold,
    letterSpacing: 0.2,
  },
});
