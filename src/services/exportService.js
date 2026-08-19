import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { exportAllData, getTransactions } from '../database/queries';

export const exportTransactionsToCSV = async () => {
  const transactions = getTransactions({ limit: 10000 });
  if (!transactions || transactions.length === 0) {
    alert('No transactions to export.');
    return;
  }

  const headers = ['ID', 'UUID', 'Date', 'Type', 'Payment Mode', 'Amount', 'Category', 'Party Name', 'Party Phone', 'Note', 'Images Attached'];
  const rows = transactions.map((t) => [
    t.id,
    `"${t.uuid}"`,
    `"${t.transactionDate}"`,
    t.type === 'gave' ? 'You Gave' : 'You Got',
    t.paymentMode === 'cash' ? 'Cash' : 'Online',
    t.amount,
    `"${t.categoryName || 'Uncategorized'}"`,
    `"${t.partyName || ''}"`,
    `"${t.partyPhone || ''}"`,
    `"${(t.note || '').replace(/"/g, '""')}"`,
    t.imageCount || 0,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

  if (Platform.OS === 'web') {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Expense_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  const fileUri = `${FileSystem.cacheDirectory}Expense_Report_${Date.now()}.csv`;
  await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: 'Export Transactions CSV',
      UTI: 'public.comma-separated-values-text',
    });
  } else {
    alert('Sharing is not available on this device');
  }
};

export const exportFullJSONBackup = async () => {
  const backupData = exportAllData();
  const jsonContent = JSON.stringify(backupData, null, 2);

  if (Platform.OS === 'web') {
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Expense_Khata_Backup_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  const fileUri = `${FileSystem.cacheDirectory}Expense_Khata_Backup_${Date.now()}.json`;
  await FileSystem.writeAsStringAsync(fileUri, jsonContent, { encoding: FileSystem.EncodingType.UTF8 });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/json',
      dialogTitle: 'Export Complete Data Backup',
      UTI: 'public.json',
    });
  } else {
    alert('Sharing is not available on this device');
  }
};
