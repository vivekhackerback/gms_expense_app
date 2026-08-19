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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useApp } from '../../context/AppContext';
import { Colors } from '../../constants/colors';
import { Typography, Spacing, BorderRadius } from '../../constants/theme';

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

  const [isAdding, setIsAdding] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('grid-outline');
  const [selectedColor, setSelectedColor] = useState('#3B82F6');

  if (!isManageCategoriesOpen) return null;

  const handleSaveCategory = () => {
    if (!newCatName.trim()) {
      Alert.alert('Validation Error', 'Please enter a category name');
      return;
    }
    try {
      saveCategory({
        name: newCatName.trim(),
        icon: selectedIcon,
        color: selectedColor,
      });
      setNewCatName('');
      setIsAdding(false);
    } catch (e) {
      Alert.alert('Error', 'A category with this name might already exist.');
    }
  };

  const handleDelete = (id, name) => {
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${name}"? Existing transactions will retain their data.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteCategoryItem(id),
        },
      ]
    );
  };

  return (
    <Modal
      visible={isManageCategoriesOpen}
      animationType="slide"
      onRequestClose={() => setIsManageCategoriesOpen(false)}
    >
      <SafeAreaView style={styles.container}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 6 }]}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => {
              setIsAdding(false);
              setIsManageCategoriesOpen(false);
            }}
          >
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Manage Categories</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setIsAdding(!isAdding)}
          >
            <Ionicons
              name={isAdding ? 'list-outline' : 'add'}
              size={24}
              color={Colors.primary}
            />
          </TouchableOpacity>
        </View>

        {isAdding ? (
          <View style={styles.addForm}>
            <Text style={styles.sectionHeading}>Create New Category</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Subscriptions, Groceries, Gym"
              placeholderTextColor={Colors.textMuted}
              value={newCatName}
              onChangeText={setNewCatName}
              autoFocus
            />

            <Text style={styles.subHeading}>Choose Icon</Text>
            <View style={styles.iconGrid}>
              {ICON_OPTIONS.map((icon) => (
                <TouchableOpacity
                  key={icon}
                  style={[
                    styles.iconOption,
                    selectedIcon === icon && styles.selectedIconOption,
                  ]}
                  onPress={() => setSelectedIcon(icon)}
                >
                  <Ionicons
                    name={icon}
                    size={22}
                    color={selectedIcon === icon ? selectedColor : Colors.textSecondary}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.subHeading}>Choose Color</Text>
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
                />
              ))}
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: selectedColor }]}
              onPress={handleSaveCategory}
            >
              <Text style={styles.saveBtnText}>Save Category</Text>
            </TouchableOpacity>
          </View>
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
                    {item.isCustom ? 'Custom Category' : 'Default'}
                  </Text>
                </View>
                {Boolean(item.isCustom) && (
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(item.id, item.name)}
                  >
                    <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                  </TouchableOpacity>
                )}
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
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  catIconContainer: {
    width: 40,
    height: 40,
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
  deleteBtn: {
    padding: Spacing.sm,
  },
  addForm: {
    padding: Spacing.xl,
    backgroundColor: Colors.surface,
    margin: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
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
    marginBottom: Spacing.sm,
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
  },
  iconOption: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  selectedIconOption: {
    borderColor: Colors.primary,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginVertical: Spacing.xs,
  },
  colorOption: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  selectedColorOption: {
    borderWidth: 3,
    borderColor: Colors.textPrimary,
  },
  saveBtn: {
    marginTop: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
  },
});
