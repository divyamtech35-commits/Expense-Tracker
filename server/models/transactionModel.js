import { ID, Query } from 'node-appwrite';
import { appwriteConfigured, tablesDB, databaseId, friendsTableIds, transactionsTableId } from '../config/appwrite.js';

function mapRow(row) {
  return {
    id: row.$id,
    type: row.type,
    amount: Number(row.amount),
    category: row.category,
    note: row.note || '',
    date: row.date,
    paymentMethod: row.paymentMethod,
    createdAt: row.$createdAt,
  };
}

export async function listTransactions({ month } = {}) {
  if (!appwriteConfigured) return [];
  const baseQueries = [Query.orderDesc('date')];
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, monthNumber] = month.split('-').map(Number);
    const start = `${month}-01`;
    const nextMonth = new Date(Date.UTC(year, monthNumber, 1));
    const endExclusive = `${nextMonth.getUTCFullYear()}-${String(nextMonth.getUTCMonth() + 1).padStart(2, '0')}-01`;
    baseQueries.push(Query.greaterThanEqual('date', start), Query.lessThan('date', endExclusive));
  }
  const rows = [];
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const result = await tablesDB.listRows({
      databaseId,
      tableId: transactionsTableId,
      queries: [...baseQueries, Query.limit(pageSize), Query.offset(offset)],
    });
    rows.push(...result.rows);
    if (rows.length >= result.total || result.rows.length < pageSize) break;
  }
  return rows.map(mapRow);
}

export async function getPaymentMethodBalances() {
  if (!appwriteConfigured) return { cash: 0, upi: 0 };
  const balancesMinor = { cash: 0, upi: 0 };
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const result = await tablesDB.listRows({
      databaseId,
      tableId: transactionsTableId,
      queries: [Query.limit(pageSize), Query.offset(offset)],
    });
    for (const row of result.rows) {
      const method = String(row.paymentMethod || '').trim().toLowerCase();
      if (!Object.hasOwn(balancesMinor, method) || !['income', 'expense'].includes(row.type)) continue;
      const amountMinor = Math.round(Number(row.amount) * 100);
      balancesMinor[method] += row.type === 'income' ? amountMinor : -amountMinor;
    }
    if (offset + result.rows.length >= result.total || result.rows.length < pageSize) break;
  }
  return { cash: balancesMinor.cash / 100, upi: balancesMinor.upi / 100 };
}

export async function createTransaction(data) {
  const row = await tablesDB.createRow({
    databaseId,
    tableId: transactionsTableId,
    rowId: ID.unique(),
    data: {
      type: data.type,
      amount: Number(data.amount),
      category: data.category.trim(),
      note: data.note?.trim() || '',
      date: data.date,
      paymentMethod: data.paymentMethod,
    },
  });
  return mapRow(row);
}

export async function deleteTransaction(id) {
  await tablesDB.deleteRow({ databaseId, tableId: transactionsTableId, rowId: id });
}

export async function assertTransactionCanBeDeleted(id) {
  const row = await tablesDB.getRow({ databaseId, tableId: transactionsTableId, rowId: id });
  if (row.sourceType || row.category === 'Gift' || row.category === 'Gift received') {
    throw Object.assign(new Error('This transaction is linked to friend activity. Delete or edit it from the Friends section.'), { status: 409 });
  }
  const linkedBills = await tablesDB.listRows({ databaseId, tableId: friendsTableIds.bills, queries: [Query.equal('expenseTransactionId', id), Query.limit(1)] });
  if (linkedBills.total > 0) throw Object.assign(new Error('This transaction is the personal share of a shared bill. Change it from Split Bills.'), { status: 409 });
}
