import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useApp } from '../../context/AppContext';
import { Colors } from '../../constants/colors';
import { Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';

const ICON_OPTIONS = [
  // Food & Dining
  'restaurant-outline',
  'cafe-outline',
  'fast-food-outline',
  'pizza-outline',
  'beer-outline',
  'wine-outline',
  'nutrition-outline',
  'ice-cream-outline',
  'fish-outline',

  // Shopping & Lifestyle
  'cart-outline',
  'bag-handle-outline',
  'bag-outline',
  'pricetag-outline',
  'pricetags-outline',
  'shirt-outline',
  'glasses-outline',
  'diamond-outline',
  'basket-outline',
  'gift-outline',

  // Money, Finance & Business
  'cash-outline',
  'wallet-outline',
  'card-outline',
  'receipt-outline',
  'calculator-outline',
  'briefcase-outline',
  'business-outline',
  'trending-up-outline',
  'trending-down-outline',
  'stats-chart-outline',
  'pie-chart-outline',
  'bar-chart-outline',
  'vault-outline',
  'save-outline',

  // Home & Utilities
  'home-outline',
  'flash-outline',
  'water-outline',
  'bulb-outline',
  'tv-outline',
  'wifi-outline',
  'key-outline',
  'bed-outline',
  'trash-outline',
  'construct-outline',
  'hammer-outline',
  'build-outline',

  // Vehicles & Transportation
  'car-outline',
  'car-sport-outline',
  'bus-outline',
  'bicycle-outline',
  'airplane-outline',
  'train-outline',
  'boat-outline',
  'subway-outline',
  'speedometer-outline',
  'navigate-outline',
  'map-outline',
  'compass-outline',

  // Health, Fitness & Care
  'medkit-outline',
  'fitness-outline',
  'barbell-outline',
  'heart-outline',
  'pulse-outline',
  'bandage-outline',
  'body-outline',
  'cut-outline',
  'happy-outline',

  // Education & Office
  'school-outline',
  'book-outline',
  'library-outline',
  'pencil-outline',
  'newspaper-outline',
  'document-text-outline',
  'folder-outline',
  'attach-outline',
  'easel-outline',

  // Entertainment & Leisure
  'film-outline',
  'game-controller-outline',
  'musical-notes-outline',
  'headset-outline',
  'camera-outline',
  'videocam-outline',
  'balloon-outline',
  'football-outline',
  'color-palette-outline',
  'ticket-outline',

  // Tech & Communication
  'phone-portrait-outline',
  'laptop-outline',
  'desktop-outline',
  'hardware-chip-outline',
  'cloud-outline',
  'mail-outline',
  'chatbubble-ellipses-outline',
  'call-outline',
  'radio-outline',
  'battery-charging-outline',

  // People, Pets & Nature
  'people-outline',
  'person-outline',
  'paw-outline',
  'leaf-outline',
  'flower-outline',
  'star-outline',
  'ribbon-outline',
  'trophy-outline',
  'shield-checkmark-outline',
  'sparkles-outline',
  'grid-outline',
];

const COLOR_OPTIONS = [
  '#F97316', // Orange
  '#EA580C', // Deep Orange
  '#0EA5E9', // Sky Blue
  '#0284C7', // Ocean Blue
  '#3B82F6', // Blue
  '#1D4ED8', // Navy Blue
  '#EC4899', // Pink
  '#DB2777', // Rose Pink
  '#8B5CF6', // Purple
  '#7C3AED', // Deep Purple
  '#6366F1', // Indigo
  '#4F46E5', // Royal Indigo
  '#EAB308', // Yellow
  '#CA8A04', // Amber
  '#EF4444', // Red
  '#DC2626', // Crimson Red
  '#14B8A6', // Teal
  '#0D9488', // Deep Teal
  '#10B981', // Emerald
  '#059669', // Forest Green
  '#84CC16', // Lime
  '#65A30D', // Olive Green
  '#A855F7', // Violet
  '#9333EA', // Dark Violet
  '#F43F5E', // Rose
  '#E11D48', // Ruby
  '#64748B', // Slate Grey
  '#475569', // Charcoal
];

export const ManageCategoriesModal = () => {
  const insets = useSafeAreaInsets();
  const {
    isManageCategoriesOpen,
    setIsManageCategoriesOpen,
    categories,
    saveCategory,
    deleteCategoryItem,
    resetCategories,
  } = useApp();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [catName, setCatName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('grid-outline');
  const [selectedColor, setSelectedColor] = useState('#3B82F6');

  if (!isManageCategoriesOpen) return null;

  const openCreateForm = () => {
    setEditingCategoryId(null);
    setCatName('');
    setSelectedIcon('grid-outline');
    setSelectedColor('#3B82F6');
    setIsFormOpen(true);
  };

  const openEditForm = (category) => {
    setEditingCategoryId(category.id);
    setCatName(category.name);
    setSelectedIcon(category.icon || 'grid-outline');
    setSelectedColor(category.color || '#3B82F6');
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingCategoryId(null);
    setCatName('');
  };

  const handleSave = () => {
    if (!catName.trim()) {
      Alert.alert('Validation Error', 'Please enter a category name');
      return;
    }
    try {
      saveCategory({
        id: editingCategoryId || undefined,
        name: catName.trim(),
        icon: selectedIcon,
        color: selectedColor,
      });
      closeForm();
    } catch (e) {
      Alert.alert('Error', 'A category with this name might already exist.');
    }
  };

  const handleDelete = (id, name) => {
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${name}"?\n\nExisting transactions previously assigned to this category will not be altered and will continue to display "${name}". It will only be hidden for new transactions.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteCategoryItem(id);
            if (editingCategoryId === id) {
              closeForm();
            }
          },
        },
      ]
    );
  };

  const handleResetCategoriesPrompt = () => {
    Alert.alert(
      'Reset Categories',
      'Are you sure you want to reset categories to the default categories?\n\nThis will restore all default application categories with their original icons, colors, and structure without modifying your existing transaction records.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Categories',
          style: 'destructive',
          onPress: () => {
            try {
              resetCategories();
              Alert.alert('Categories Restored ✓', 'Categories restored successfully');
            } catch (err) {
              Alert.alert('Error', 'Failed to reset categories: ' + err.message);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={isManageCategoriesOpen}
      animationType="slide"
      onRequestClose={() => {
        closeForm();
        setIsManageCategoriesOpen(false);
      }}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 6 }]}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => {
              closeForm();
              setIsManageCategoriesOpen(false);
            }}
          >
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Manage Categories</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => {
              if (isFormOpen) closeForm();
              else openCreateForm();
            }}
          >
            <Ionicons
              name={isFormOpen ? 'list-outline' : 'add'}
              size={24}
              color={Colors.primary}
            />
          </TouchableOpacity>
        </View>

        {isFormOpen ? (
          <ScrollView
            style={styles.scrollForm}
            contentContainerStyle={styles.formContainer}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.formCard}>
              <Text style={styles.sectionHeading}>
                {editingCategoryId ? 'Edit Category' : 'Create New Category'}
              </Text>
              
              <Text style={styles.subHeading}>Category Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Subscriptions, Groceries, Gym"
                placeholderTextColor={Colors.textMuted}
                value={catName}
                onChangeText={setCatName}
                autoFocus
              />

              <Text style={styles.subHeading}>Select Icon</Text>
              <View style={styles.iconGrid}>
                {ICON_OPTIONS.map((icon) => (
                  <TouchableOpacity
                    key={icon}
                    style={[
                      styles.iconOption,
                      selectedIcon === icon && [styles.selectedIconOption, { borderColor: selectedColor }],
                    ]}
                    onPress={() => setSelectedIcon(icon)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={icon}
                      size={22}
                      color={selectedIcon === icon ? selectedColor : Colors.textSecondary}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.subHeading}>Select Color</Text>
              <View style={styles.colorGrid}>
                {COLOR_OPTIONS.map((col) => (
                  <TouchableOpacity
                    key={col}
                    style={[
                      styles.colorOption,
                      { backgroundColor: col },
                      selectedColor === col && styles.selectedColorOption,
                    ]}
                    onPress={() => setSelectedColor(col)}
                    activeOpacity={0.7}
                  />
                ))}
              </View>

              {/* Action Buttons */}
              <View style={styles.formActionsRow}>
                <TouchableOpacity
                  style={styles.cancelFormBtn}
                  onPress={closeForm}
                >
                  <Text style={styles.cancelFormBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: selectedColor }]}
                  onPress={handleSave}
                >
                  <Text style={styles.saveBtnText}>
                    {editingCategoryId ? 'Save Changes' : 'Create Category'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        ) : (
          <View style={{ flex: 1 }}>
            {/* Top Category Management Toolbar */}
            <View style={styles.listHeaderToolbar}>
              <TouchableOpacity
                style={styles.toolbarAddBtn}
                onPress={openCreateForm}
                activeOpacity={0.8}
              >
                <Ionicons name="add-circle" size={17} color="#FFFFFF" style={{ marginRight: 5 }} />
                <Text style={styles.toolbarAddBtnText}>Add Category</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toolbarResetBtn}
                onPress={handleResetCategoriesPrompt}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh-outline" size={16} color={Colors.primary} style={{ marginRight: 5 }} />
                <Text style={styles.toolbarResetBtnText}>Reset Categories</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={categories}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => (
                <View style={styles.categoryRow}>
                  <View
                    style={[
                      styles.catIconContainer,
                      { backgroundColor: (item.color || Colors.primary) + '20' },
                    ]}
                  >
                    <Ionicons
                      name={item.icon || 'grid-outline'}
                      size={20}
                      color={item.color || Colors.primary}
                    />
                  </View>
                  <View style={styles.catInfo}>
                    <Text style={styles.catName}>{item.name}</Text>
                    <Text style={styles.catUsage}>
                      {item.isCustom ? 'Custom Category' : 'Default Category'}
                    </Text>
                  </View>
                  
                  {/* Actions: Edit & Delete */}
                  <View style={styles.rowActions}>
                    <TouchableOpacity
                      style={styles.actionIconButton}
                      onPress={() => openEditForm(item)}
                    >
                      <Ionicons name="create-outline" size={19} color={Colors.primary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionIconButton}
                      onPress={() => handleDelete(item.id, item.name)}
                    >
                      <Ionicons name="trash-outline" size={19} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          </View>
        )}
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
  addBtn: {
    padding: Spacing.xs,
  },
  listHeaderToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  toolbarAddBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    ...Shadows.sm,
  },
  toolbarAddBtnText: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
    color: '#FFFFFF',
  },
  toolbarResetBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    ...Shadows.sm,
  },
  toolbarResetBtnText: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
  },
  list: {
    padding: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: 90,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  catIconContainer: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  catInfo: {
    flex: 1,
  },
  catName: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textPrimary,
  },
  catUsage: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  actionIconButton: {
    padding: Spacing.xs + 2,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.sm,
  },
  scrollForm: {
    flex: 1,
  },
  formContainer: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  sectionHeading: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  subHeading: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs + 2,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: Typography.fontSizes.md,
    backgroundColor: Colors.background,
    color: Colors.textPrimary,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: 4,
  },
  iconOption: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  selectedIconOption: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2.5,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: 4,
    marginBottom: Spacing.md,
  },
  colorOption: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  selectedColorOption: {
    borderWidth: 3,
    borderColor: Colors.textPrimary,
  },
  formActionsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  cancelFormBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelFormBtnText: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textSecondary,
  },
  saveBtn: {
    flex: 2,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
  },
});
