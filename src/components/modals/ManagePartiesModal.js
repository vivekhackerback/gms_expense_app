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
import Ionicons from '@expo/vector-icons/Ionicons';
import { useApp } from '../../context/AppContext';
import { Colors } from '../../constants/colors';
import { Typography, Spacing, BorderRadius } from '../../constants/theme';
import { PartyRow } from '../khata/PartyRow';

export const ManagePartiesModal = () => {
  const {
    isManagePartiesOpen,
    setIsManagePartiesOpen,
    parties,
    saveParty,
    deletePartyItem,
    openPartyDetails,
  } = useApp();

  const [isAdding, setIsAdding] = useState(false);
  const [partyName, setPartyName] = useState('');
  const [partyPhone, setPartyPhone] = useState('');
  const [search, setSearch] = useState('');

  if (!isManagePartiesOpen) return null;

  const handleSaveParty = () => {
    if (!partyName.trim()) {
      Alert.alert('Validation Error', 'Please enter party name');
      return;
    }
    saveParty({
      name: partyName.trim(),
      phone: partyPhone.trim(),
    });
    setPartyName('');
    setPartyPhone('');
    setIsAdding(false);
  };

  const filteredParties = parties.filter((p) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      (p.phone && p.phone.toLowerCase().includes(term))
    );
  });

  return (
    <Modal
      visible={isManagePartiesOpen}
      animationType="slide"
      onRequestClose={() => setIsManagePartiesOpen(false)}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => {
              setIsAdding(false);
              setIsManagePartiesOpen(false);
            }}
          >
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Manage Parties</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setIsAdding(!isAdding)}
          >
            <Ionicons
              name={isAdding ? 'list-outline' : 'person-add-outline'}
              size={22}
              color={Colors.primary}
            />
          </TouchableOpacity>
        </View>

        {isAdding ? (
          <View style={styles.addForm}>
            <Text style={styles.sectionHeading}>Add New Party</Text>
            
            <Text style={styles.label}>Party / Contact Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Rahul Kumar, Sharma Electricals"
              placeholderTextColor={Colors.textMuted}
              value={partyName}
              onChangeText={setPartyName}
              autoFocus
            />

            <Text style={[styles.label, { marginTop: Spacing.md }]}>Phone Number (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 9876543210"
              placeholderTextColor={Colors.textMuted}
              value={partyPhone}
              onChangeText={setPartyPhone}
              keyboardType="phone-pad"
            />

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSaveParty}
            >
              <Text style={styles.saveBtnText}>Save Party</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <View style={styles.searchContainer}>
              <Ionicons name="search-outline" size={18} color={Colors.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search parties..."
                placeholderTextColor={Colors.textMuted}
                value={search}
                onChangeText={setSearch}
              />
            </View>

            <FlatList
              data={filteredParties}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <PartyRow
                  item={item}
                  onPress={() => {
                    setIsManagePartiesOpen(false);
                    openPartyDetails(item.id);
                  }}
                />
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No parties found.</Text>
                </View>
              }
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    margin: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.fontSizes.md,
    color: Colors.textPrimary,
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
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
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
  saveBtn: {
    marginTop: Spacing.xl,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
  },
  emptyState: {
    padding: Spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizes.md,
  },
});
