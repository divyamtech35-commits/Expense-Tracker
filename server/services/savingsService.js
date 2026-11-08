import { ID, Query } from 'node-appwrite';
import { appwriteConfigured, databaseId, friendsTableIds, tablesDB } from '../config/appwrite.js';
import { amountToMinorUnits, MAX_MINOR_UNITS, minorToAmount } from './friendLedger.js';

const accountsTableId = friendsTableIds.savingsAccounts;
const entriesTableId = friendsTableIds.savings;
const invalid = (message, status = 400) => Object.assign(new Error(message), { status });
const notFound = (error) => Number(error?.code || error?.status) === 404;

function isDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

async function getOrCreateAccount() {
  try {
    return await tablesDB.getRow({ databaseId, tableId: accountsTableId, rowId: 'default' });
  } catch (error) {
    if (!notFound(error)) throw error;
  }
  try {
    return await tablesDB.createRow({
      databaseId,
      tableId: accountsTableId,
      rowId: 'default',
      data: { balanceMinor: 0, totalAddedMinor: 0, totalSpentMinor: 0 },
    });
  } catch (error) {
    if (Number(error?.code || error?.status) !== 409) throw error;
    return tablesDB.getRow({ databaseId, tableId: accountsTableId, rowId: 'default' });
  }
}

function mapEntry(row) {
  return {
    id: row.$id,
    type: row.type,
    amount: minorToAmount(row.amountMinor),
    date: row.date,
    description: row.description,
    paymentMethod: row.paymentMethod || '',
    createdAt: row.$createdAt,
  };
}

export async function getSavingsSummary() {
  if (!appwriteConfigured) throw invalid('Appwrite is not configured.', 503);
  const account = await getOrCreateAccount();
  const rows = [];
  for (let offset = 0; ; offset += 100) {
    const result = await tablesDB.listRows({
      databaseId,
      tableId: entriesTableId,
      queries: [Query.orderDesc('date'), Query.limit(100), Query.offset(offset)],
    });
    rows.push(...result.rows);
    if (rows.length >= result.total || result.rows.length < 100) break;
  }
  return {
    balance: minorToAmount(account.balanceMinor),
    totalAdded: minorToAmount(account.totalAddedMinor),
    totalSpent: minorToAmount(account.totalSpentMinor),
    entries: rows.map(mapEntry),
  };
}

export async function addSavingsEntry(input) {
  if (!appwriteConfigured) throw invalid('Appwrite is not configured.', 503);
  if (!['deposit', 'withdrawal'].includes(input.type)) throw invalid('Choose add savings or spend from savings.');
  if (!isDateOnly(input.date)) throw invalid('Enter a valid date.');
  if (typeof input.description !== 'string' || input.description.trim().length > 255) throw invalid('Description must be 255 characters or fewer.');
  if (typeof input.paymentMethod !== 'string' || input.paymentMethod.trim().length > 100) throw invalid('Payment method must be 100 characters or fewer.');
  const amountMinor = amountToMinorUnits(input.amount);
  await getOrCreateAccount();

  const transaction = await tablesDB.createTransaction({ ttl: 60 });
  try {
    const account = await tablesDB.getRow({ databaseId, tableId: accountsTableId, rowId: 'default', transactionId: transaction.$id });
    const sign = input.type === 'deposit' ? 1 : -1;
    if (sign < 0 && amountMinor > account.balanceMinor) throw invalid('This amount is higher than your available savings balance.', 409);
    const balanceMinor = account.balanceMinor + sign * amountMinor;
    const totalAddedMinor = account.totalAddedMinor + (sign > 0 ? amountMinor : 0);
    const totalSpentMinor = account.totalSpentMinor + (sign < 0 ? amountMinor : 0);
    if ([balanceMinor, totalAddedMinor, totalSpentMinor].some((value) => value > MAX_MINOR_UNITS)) {
      throw invalid('This entry exceeds the supported savings amount.');
    }
    await tablesDB.updateRow({
      databaseId,
      tableId: accountsTableId,
      rowId: 'default',
      transactionId: transaction.$id,
      data: { balanceMinor, totalAddedMinor, totalSpentMinor },
    });
    const entry = await tablesDB.createRow({
      databaseId,
      tableId: entriesTableId,
      rowId: ID.unique(),
      transactionId: transaction.$id,
      data: {
        type: input.type,
        amountMinor,
        date: input.date,
        description: input.description.trim(),
        paymentMethod: input.paymentMethod.trim(),
      },
    });
    await tablesDB.updateTransaction({ transactionId: transaction.$id, commit: true });
    return { entry: mapEntry(entry), balance: minorToAmount(balanceMinor) };
  } catch (error) {
    try { await tablesDB.updateTransaction({ transactionId: transaction.$id, rollback: true }); } catch { /* transaction may already have expired */ }
    throw error;
  }
}

export async function deleteSavingsEntry(id) {
  if (!appwriteConfigured) throw invalid('Appwrite is not configured.', 503);
  await getOrCreateAccount();
  const transaction = await tablesDB.createTransaction({ ttl: 60 });
  try {
    const [entry, account] = await Promise.all([
      tablesDB.getRow({ databaseId, tableId: entriesTableId, rowId: id, transactionId: transaction.$id }),
      tablesDB.getRow({ databaseId, tableId: accountsTableId, rowId: 'default', transactionId: transaction.$id }),
    ]);
    const isDeposit = entry.type === 'deposit';
    const balanceMinor = account.balanceMinor + (isDeposit ? -entry.amountMinor : entry.amountMinor);
    const totalAddedMinor = account.totalAddedMinor - (isDeposit ? entry.amountMinor : 0);
    const totalSpentMinor = account.totalSpentMinor - (isDeposit ? 0 : entry.amountMinor);
    if (balanceMinor < 0 || totalAddedMinor < 0 || totalSpentMinor < 0) throw invalid('Savings totals are inconsistent; the entry was not deleted.', 409);
    await tablesDB.updateRow({
      databaseId,
      tableId: accountsTableId,
      rowId: 'default',
      transactionId: transaction.$id,
      data: { balanceMinor, totalAddedMinor, totalSpentMinor },
    });
    await tablesDB.deleteRow({ databaseId, tableId: entriesTableId, rowId: id, transactionId: transaction.$id });
    await tablesDB.updateTransaction({ transactionId: transaction.$id, commit: true });
    return { balance: minorToAmount(balanceMinor) };
  } catch (error) {
    try { await tablesDB.updateTransaction({ transactionId: transaction.$id, rollback: true }); } catch { /* transaction may already have expired */ }
    throw error;
  }
}
