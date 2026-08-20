import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import { Platform, Alert } from 'react-native';
import { exportAllData, getTransactions, getReportsSummary } from '../database/queries';
import { formatCurrency, formatFullDateTime } from '../utils/formatters';

const escapeHtml = (unsafe) => {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Generate clean, print-friendly HTML for transaction statement PDF
 */
export const generateTransactionsPDFHtml = ({
  transactions = [],
  summary = {},
  dateRangeLabel = 'All Time',
  filterTypeLabel = 'All',
  filterModeLabel = 'All',
}) => {
  const now = new Date();
  const { date: generatedDate, time: generatedTime } = formatFullDateTime(now.toISOString());
  
  const netBal = Number(summary.netBalance || 0);
  const netBalClass = netBal > 0 ? 'net-pos' : netBal < 0 ? 'net-neg' : 'net-zero';
  const netBalSign = netBal > 0 ? '+' : '';

  const rowsHtml = transactions.map((t, idx) => {
    const isGave = t.type === 'gave';
    const isGot = t.type === 'got';
    const isCash = t.paymentMode === 'cash';

    const { date, time } = formatFullDateTime(t.transactionDate || t.createdAt);
    const primaryTitle = t.partyName || t.categoryName || 'General Transaction';
    const subTitle = t.partyName && t.categoryName ? t.categoryName : '';

    const gaveAmount = isGave ? `₹${(Math.abs(Number(t.amount) || 0)).toLocaleString('en-IN')}` : '-';
    const gotAmount = isGot ? `₹${(Math.abs(Number(t.amount) || 0)).toLocaleString('en-IN')}` : '-';

    const rawBal = t.runningBalance !== undefined && t.runningBalance !== null ? Number(t.runningBalance) : null;
    let balHtml = '-';
    if (rawBal !== null) {
      const balClass = rawBal > 0 ? 'bal-pos' : rawBal < 0 ? 'bal-neg' : 'bal-zero';
      balHtml = `<span class="${balClass}">${formatCurrency(rawBal)}</span>`;
    }

    return `
      <tr>
        <td class="text-center text-muted" style="width: 32px;">${idx + 1}</td>
        <td style="width: 105px; white-space: nowrap;">
          <div class="date-main">${escapeHtml(date)}</div>
          <div class="date-sub">${escapeHtml(time)}</div>
        </td>
        <td>
          <div class="party-title">${escapeHtml(primaryTitle)}</div>
          ${subTitle ? `<div class="category-sub">Category: ${escapeHtml(subTitle)}</div>` : ''}
          ${t.partyPhone ? `<div class="party-phone">&#128222; ${escapeHtml(t.partyPhone)}</div>` : ''}
          ${t.note ? `<div class="note-text">&#128221; ${escapeHtml(t.note)}</div>` : ''}
        </td>
        <td class="text-center" style="width: 75px;">
          <span class="mode-badge ${isCash ? 'mode-cash' : 'mode-online'}">
            ${isCash ? 'Cash' : 'Online'}
          </span>
        </td>
        <td class="text-right amt-gave" style="width: 95px;">${gaveAmount}</td>
        <td class="text-right amt-got" style="width: 95px;">${gotAmount}</td>
        <td class="text-right" style="width: 105px;">${balHtml}</td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Transaction Statement - GMS Expense & Khata Book</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 10mm 15mm 10mm;
      @bottom-right {
        content: "Page " counter(page) " of " counter(pages);
        font-size: 8pt;
        color: #64748b;
      }
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0F172A;
      margin: 0;
      padding: 0;
      font-size: 10px;
      line-height: 1.4;
      background: #FFFFFF;
    }

    /* Header Section */
    .statement-header {
      border-bottom: 2px solid #1E293B;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .header-top-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .brand-section {
      flex: 1;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 800;
      color: #0F172A;
      letter-spacing: -0.5px;
      margin: 0 0 3px 0;
    }
    .brand-sub {
      font-size: 11px;
      color: #475569;
      font-weight: 600;
      margin: 0;
    }
    .badge-report {
      background: #1E293B;
      color: #FFFFFF;
      font-size: 10px;
      font-weight: 700;
      padding: 5px 12px;
      border-radius: 4px;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      text-align: right;
    }

    /* Metadata Bar */
    .meta-bar {
      display: flex;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      padding: 8px 12px;
      margin-top: 10px;
      justify-content: space-between;
      font-size: 9.5px;
      color: #334155;
    }
    .meta-item {
      display: flex;
      flex-direction: column;
    }
    .meta-label {
      font-size: 8.5px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748B;
      letter-spacing: 0.4px;
      margin-bottom: 2px;
    }
    .meta-val {
      font-weight: 700;
      color: #0F172A;
    }

    /* Summary KPI Cards */
    .kpi-container {
      display: flex;
      gap: 8px;
      margin-bottom: 14px;
      page-break-inside: avoid;
    }
    .kpi-card {
      flex: 1;
      border-radius: 6px;
      padding: 8px 10px;
      border: 1px solid #E2E8F0;
      background: #FFFFFF;
    }
    .kpi-card.got {
      background: #F0FDF4;
      border-color: #BBF7D0;
    }
    .kpi-card.gave {
      background: #FEF2F2;
      border-color: #FECACA;
    }
    .kpi-card.net {
      background: #F8FAFC;
      border-color: #CBD5E1;
    }
    .kpi-card.breakdown {
      background: #F8FAFC;
      border-color: #E2E8F0;
    }
    .kpi-label {
      font-size: 8.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: #64748B;
      margin-bottom: 3px;
    }
    .kpi-value {
      font-size: 14px;
      font-weight: 800;
      letter-spacing: -0.3px;
      color: #0F172A;
    }
    .kpi-sub {
      font-size: 8.5px;
      color: #64748B;
      margin-top: 3px;
      font-weight: 500;
    }

    /* Table Styles */
    table.tx-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
    }
    thead {
      display: table-header-group;
    }
    tfoot {
      display: table-footer-group;
    }
    tr {
      page-break-inside: avoid;
    }
    th {
      background-color: #1E293B;
      color: #FFFFFF;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      padding: 7px 8px;
      border: 1px solid #1E293B;
      text-align: left;
    }
    th.text-right { text-align: right; }
    th.text-center { text-align: center; }
    td {
      padding: 6px 8px;
      border-bottom: 1px solid #E2E8F0;
      border-left: 1px solid #F1F5F9;
      border-right: 1px solid #F1F5F9;
      font-size: 9.5px;
      vertical-align: top;
    }
    tr:nth-child(even) td {
      background-color: #F8FAFC;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-muted { color: #94A3B8; }

    /* Custom Field Styles */
    .date-main {
      font-weight: 700;
      color: #1E293B;
    }
    .date-sub {
      font-size: 8.5px;
      color: #64748B;
    }
    .party-title {
      font-weight: 700;
      color: #0F172A;
      font-size: 10px;
    }
    .category-sub {
      font-size: 8.5px;
      color: #64748B;
      margin-top: 1px;
    }
    .party-phone {
      font-size: 8.5px;
      color: #475569;
      margin-top: 1px;
    }
    .note-text {
      font-size: 8.5px;
      color: #334155;
      background: rgba(0,0,0,0.03);
      padding: 2px 4px;
      border-radius: 3px;
      margin-top: 3px;
      display: inline-block;
    }

    /* Mode Badges */
    .mode-badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 8px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .mode-cash {
      background: #FEF3C7;
      color: #B45309;
      border: 1px solid #FDE68A;
    }
    .mode-online {
      background: #DBEAFE;
      color: #1D4ED8;
      border: 1px solid #BFDBFE;
    }

    /* Amount & Balance Colors (Strict Color Theory) */
    .amt-gave {
      color: #DC2626;
      font-weight: 700;
    }
    .amt-got {
      color: #059669;
      font-weight: 700;
    }
    .bal-pos {
      color: #059669;
      font-weight: 700;
    }
    .bal-neg {
      color: #DC2626;
      font-weight: 700;
    }
    .bal-zero {
      color: #64748B;
      font-weight: 600;
    }

    .net-pos { color: #059669; }
    .net-neg { color: #DC2626; }
    .net-zero { color: #334155; }

    /* Footer & Totals Row */
    .table-totals-row td {
      background-color: #F1F5F9 !important;
      font-weight: 800;
      border-top: 2px solid #CBD5E1;
      border-bottom: 2px solid #CBD5E1;
      padding: 8px;
      font-size: 10px;
    }
    .doc-footer {
      margin-top: 18px;
      padding-top: 10px;
      border-top: 1px solid #E2E8F0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: #94A3B8;
      font-size: 8.5px;
      page-break-inside: avoid;
    }
    .footer-app-name {
      font-weight: 600;
      color: #64748B;
    }
    .empty-rows {
      text-align: center;
      padding: 24px;
      color: #64748B;
      font-style: italic;
    }
  </style>
</head>
<body>

  <!-- 1. Statement Header -->
  <div class="statement-header">
    <div class="header-top-row">
      <div class="brand-section">
        <h1 class="brand-title">GMS Expense &amp; Khata Book</h1>
        <p class="brand-sub">Official Transaction Statement &amp; Financial Ledger</p>
      </div>
      <div class="badge-report">
        Transaction Statement
      </div>
    </div>

    <!-- Metadata Grid -->
    <div class="meta-bar">
      <div class="meta-item">
        <span class="meta-label">Statement Period</span>
        <span class="meta-val">${escapeHtml(dateRangeLabel)}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Filter Criteria</span>
        <span class="meta-val">Type: ${escapeHtml(filterTypeLabel)} &bull; Mode: ${escapeHtml(filterModeLabel)}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Total Transactions</span>
        <span class="meta-val">${transactions.length} record${transactions.length === 1 ? '' : 's'}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Generated On</span>
        <span class="meta-val">${escapeHtml(generatedDate)} at ${escapeHtml(generatedTime)}</span>
      </div>
    </div>
  </div>

  <!-- 2. KPI Summary Cards -->
  <div class="kpi-container">
    <div class="kpi-card got">
      <div class="kpi-label">Total You Got (Inflow)</div>
      <div class="kpi-value" style="color: #059669;">+${formatCurrency(summary.totalGot || 0)}</div>
      <div class="kpi-sub">Cash: ${formatCurrency(summary.cashGot || 0)} &bull; Online: ${formatCurrency(summary.onlineGot || 0)}</div>
    </div>

    <div class="kpi-card gave">
      <div class="kpi-label">Total You Gave (Outflow)</div>
      <div class="kpi-value" style="color: #DC2626;">-${formatCurrency(summary.totalGave || 0)}</div>
      <div class="kpi-sub">Cash: ${formatCurrency(summary.cashGave || 0)} &bull; Online: ${formatCurrency(summary.onlineGave || 0)}</div>
    </div>

    <div class="kpi-card net">
      <div class="kpi-label">Total Net Balance</div>
      <div class="kpi-value ${netBalClass}">${netBalSign}${formatCurrency(netBal)}</div>
      <div class="kpi-sub">${netBal >= 0 ? 'Net Positive Inflow' : 'Net Negative Outflow'}</div>
    </div>

    <div class="kpi-card breakdown">
      <div class="kpi-label">Payment Channels</div>
      <div class="kpi-sub" style="font-weight: 700; color: #B45309; margin-top: 2px;">
        Cash Bal: ${formatCurrency(summary.cashBalance || 0)}
      </div>
      <div class="kpi-sub" style="font-weight: 700; color: #1D4ED8; margin-top: 2px;">
        Online Bal: ${formatCurrency(summary.onlineBalance || 0)}
      </div>
    </div>
  </div>

  <!-- 3. Transactions Table -->
  <table class="tx-table">
    <thead>
      <tr>
        <th class="text-center" style="width: 32px;">#</th>
        <th style="width: 105px;">Date &amp; Time</th>
        <th>Description / Party / Category</th>
        <th class="text-center" style="width: 75px;">Mode</th>
        <th class="text-right" style="width: 95px;">You Gave (Dr)</th>
        <th class="text-right" style="width: 95px;">You Got (Cr)</th>
        <th class="text-right" style="width: 105px;">Balance</th>
      </tr>
    </thead>
    <tbody>
      ${transactions.length > 0 ? rowsHtml : '<tr><td colspan="7" class="empty-rows">No transactions recorded for the selected period.</td></tr>'}
    </tbody>
    <tfoot>
      <tr class="table-totals-row">
        <td colspan="4" class="text-right">PERIOD TOTALS:</td>
        <td class="text-right amt-gave">-${formatCurrency(summary.totalGave || 0)}</td>
        <td class="text-right amt-got">+${formatCurrency(summary.totalGot || 0)}</td>
        <td class="text-right ${netBalClass}">${netBalSign}${formatCurrency(netBal)}</td>
      </tr>
    </tfoot>
  </table>

  <!-- 4. Footer Note -->
  <div class="doc-footer">
    <div class="footer-app-name">Generated securely by GMS Expense &amp; Khata Book</div>
    <div>Report Date: ${escapeHtml(generatedDate)} &bull; End of Statement</div>
  </div>

</body>
</html>
  `;
};

/**
 * Exports transactions to PDF and triggers native share / download
 */
export const exportTransactionsToPDF = async ({
  startDate = null,
  endDate = null,
  filterType = null,
  filterMode = null,
  partyId = null,
  categoryId = null,
  search = '',
  dateRangeLabel = 'All Time',
} = {}) => {
  try {
    const transactions = getTransactions({
      limit: 10000,
      filterType,
      filterMode,
      partyId,
      categoryId,
      startDate,
      endDate,
      search,
    });

    if (!transactions || transactions.length === 0) {
      Alert.alert('No Transactions', 'No transactions found matching the selected date range and filter criteria.');
      return { success: false, error: 'NO_DATA' };
    }

    // Calculate period summary
    let totalGot = 0;
    let totalGave = 0;
    let cashGot = 0;
    let cashGave = 0;
    let onlineGot = 0;
    let onlineGave = 0;

    for (const t of transactions) {
      const amt = Number(t.amount) || 0;
      if (t.type === 'got') {
        totalGot += amt;
        if (t.paymentMode === 'cash') cashGot += amt;
        else onlineGot += amt;
      } else {
        totalGave += amt;
        if (t.paymentMode === 'cash') cashGave += amt;
        else onlineGave += amt;
      }
    }

    const summary = {
      totalGot,
      totalGave,
      netBalance: totalGot - totalGave,
      cashGot,
      cashGave,
      cashBalance: cashGot - cashGave,
      onlineGot,
      onlineGave,
      onlineBalance: onlineGot - onlineGave,
      totalTransactions: transactions.length,
    };

    let filterTypeLabel = 'All';
    if (filterType === 'gave') filterTypeLabel = 'You Gave Only';
    else if (filterType === 'got') filterTypeLabel = 'You Got Only';

    let filterModeLabel = 'All';
    if (filterMode === 'cash') filterModeLabel = 'Cash Only';
    else if (filterMode === 'online') filterModeLabel = 'Online Only';

    const html = generateTransactionsPDFHtml({
      transactions,
      summary,
      dateRangeLabel,
      filterTypeLabel,
      filterModeLabel,
    });

    if (Platform.OS === 'web') {
      await Print.printAsync({ html });
      return { success: true };
    }

    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Transaction Statement (${dateRangeLabel})`,
        UTI: 'com.adobe.pdf',
      });
      return { success: true, uri };
    } else {
      Alert.alert('PDF Created', `PDF successfully generated and saved to: ${uri}`);
      return { success: true, uri };
    }
  } catch (error) {
    console.error('Error generating PDF:', error);
    Alert.alert('Export Failed', 'An error occurred while generating the PDF statement. Please try again.');
    return { success: false, error };
  }
};

export const exportTransactionsToCSV = async () => {
  const transactions = getTransactions({ limit: 10000 });
  if (!transactions || transactions.length === 0) {
    Alert.alert('No Data', 'No transactions to export.');
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
    Alert.alert('Export CSV', 'Sharing is not available on this device');
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
    Alert.alert('Export JSON', 'Sharing is not available on this device');
  }
};

