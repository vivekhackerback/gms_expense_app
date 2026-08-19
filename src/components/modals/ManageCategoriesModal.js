import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useApp } from '../../context/AppContext';
import { Colors } from '../../constants/colors';
import { Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';

const ICON_OPTIONS = [
  'restaurant-outline',
  'airplane-outline',
  'cart-outline',
  'receipt-outline',
  'home-outline',
  'speedometer-outline',
  'medkit-outline',
  'school-outline',
  'briefcase-outline',
  'cash-outline',
  'gift-outline',
  'fitness-outline',
  'car-outline',
  'film-outline',
  'game-controller-outline',
  'wallet-outline',
  'barbell-outline',
  'cafe-outline',
  'fast-food-outline',
  'shirt-outline',
  'book-outline',
  'build-outline',
  'bus-outline',
  'heart-outline',
  'grid-outline',
];

const COLOR_OPTIONS = [
  '#F97316',
  '#0EA5E9',
  '#EC4899',
  '#8B5CF6',
  '#6366F1',
  '#EAB308',
  '#EF4444',
  '#14B8A6',
  '#3B82F6',
  '#10B981',
  '#64748B',
  '#84CC16',
  '#A855F7',
  '#F43F5E',
];

export const ManageCategoriesModal = () => {
  const insets = useSafeAreaInsets();
  const {
    isManageCategoriesOpen,
    setIsManageCategoriesOpen,
    categories,
    saveCategory,
    deleteCategoryItem,
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
  list: {
    padding: Spacing.lg,
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
