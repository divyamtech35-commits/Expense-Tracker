import { ID, Query } from 'node-appwrite';
import { databaseId, friendsTableIds, tablesDB } from '../config/appwrite.js';
import { SELF_PARTICIPANT_ID } from '../services/friendLedger.js';
import { applyRepayment } from '../services/friendLedger.js';

const table = (key) => friendsTableIds[key];
const row = async (key, id, transactionId) => tablesDB.getRow({ databaseId, tableId: table(key), rowId: id, ...(transactionId ? { transactionId } : {}) });
const insert = (key, data, transactionId, rowId = ID.unique()) => tablesDB.createRow({ databaseId, tableId: table(key), rowId, data, ...(transactionId ? { transactionId } : {}) });
const update = (key, id, data, transactionId) => tablesDB.updateRow({ databaseId, tableId: table(key), rowId: id, data, ...(transactionId ? { transactionId } : {}) });
const remove = (key, id, transactionId) => tablesDB.deleteRow({ databaseId, tableId: table(key), rowId: id, ...(transactionId ? { transactionId } : {}) });

export async function listRows(key, filters = []) {
  const all = [];
  for (let offset = 0; ; offset += 100) {
    const page = await tablesDB.listRows({ databaseId, tableId: table(key), queries: [...filters, Query.limit(100), Query.offset(offset)] });
    all.push(...page.rows);
    if (all.length >= page.total || page.rows.length < 100) return all;
  }
}

export const listFriends = () => listRows('friends', [Query.orderAsc('name')]);
export const getFriend = (id) => row('friends', id);
export const createFriend = (data) => insert('friends', { ...data, archived: false });
export const updateFriend = (id, data) => update('friends', id, data);
export const listBills = () => listRows('bills', [Query.orderDesc('date')]);
export const listSplits = (billId) => listRows('splits', [Query.equal('billId', billId)]);
export const listAllSplits = () => listRows('splits');
export const listLoans = () => listRows('loans', [Query.orderDesc('date')]);
export const listSettlements = () => listRows('settlements', [Query.orderDesc('date')]);
export const listTransfers = () => listRows('transfers', [Query.orderDesc('date')]);
export const getRow = row;
export const createRow = insert;
export const updateRow = update;
export const deleteRow = remove;

export async function runAtomic(work) {
  const transaction = await tablesDB.createTransaction({ ttl: 60 });
  try {
    const value = await work(transaction.$id);
    await tablesDB.updateTransaction({ transactionId: transaction.$id, commit: true });
    return value;
  } catch (error) {
    try { await tablesDB.updateTransaction({ transactionId: transaction.$id, rollback: true }); } catch { /* transaction may already have expired */ }
    throw error;
  }
}

export async function settleOutstanding({ friendId, direction, amountMinor, relatedType, relatedId, date, paymentMethod, requestId }) {
  return runAtomic(async (transactionId) => {
    const previous = await listRowsInTransaction('settlements', [Query.equal('requestId', requestId)], transactionId);
    if (previous.length) return previous[0];
    if (relatedType === 'shared_bill') {
      const bill = await row('bills', relatedId, transactionId);
      const splits = await listRowsInTransaction('splits', [Query.equal('billId', relatedId)], transactionId);
      const participantId = direction === 'received' ? friendId : SELF_PARTICIPANT_ID;
      const split = splits.find((item) => item.participantId === participantId);
      const expectedPayer = direction === 'received' ? SELF_PARTICIPANT_ID : friendId;
      if (bill.payerId !== expectedPayer || !split) throw Object.assign(new Error('No matching outstanding balance exists for this bill.'), { status: 409 });
      const repayment = applyRepayment(split.outstandingMinor, amountMinor);
      await update('splits', split.$id, { outstandingMinor: repayment.outstandingMinor }, transactionId);
    } else if (relatedType === 'loan') {
      const loan = await row('loans', relatedId, transactionId);
      const expectedDirection = direction === 'received' ? 'given' : 'borrowed';
      if (loan.friendId !== friendId || loan.direction !== expectedDirection) throw Object.assign(new Error('This loan does not belong to the selected friend.'), { status: 409 });
      const repayment = applyRepayment(loan.outstandingMinor, amountMinor);
      await update('loans', relatedId, { repaidMinor: loan.repaidMinor + amountMinor, outstandingMinor: repayment.outstandingMinor, status: repayment.status }, transactionId);
    } else {
      throw Object.assign(new Error('Select a valid bill or loan.'), { status: 400 });
    }
    return insert('settlements', { friendId, direction, amountMinor, relatedType, relatedId, date, paymentMethod, requestId }, transactionId, requestId);
  });
}

export async function deleteLoan(id) {
  return runAtomic(async (transactionId) => {
    const loan = await row('loans', id, transactionId);
    const settlements = await listRowsInTransaction('settlements', [Query.equal('relatedId', id)], transactionId);
    if (loan.repaidMinor > 0 || settlements.some((item) => item.relatedType === 'loan')) {
      throw Object.assign(new Error('This loan has repayment history and cannot be deleted.'), { status: 409 });
    }
    await remove('loans', id, transactionId);
  });
}

export async function updateLoan(id, data) {
  return runAtomic(async (transactionId) => {
    const loan = await row('loans', id, transactionId);
    const settlements = await listRowsInTransaction('settlements', [Query.equal('relatedId', id)], transactionId);
    if (loan.direction !== data.direction) throw Object.assign(new Error('A loan cannot be moved between Money given and Money borrowed.'), { status: 409 });
    if (settlements.some((item) => item.relatedType === 'loan') && loan.friendId !== data.friendId) {
      throw Object.assign(new Error('The friend cannot be changed after repayments have been recorded.'), { status: 409 });
    }
    if (data.originalMinor < loan.repaidMinor) throw Object.assign(new Error('The amount cannot be less than the repayments already recorded.'), { status: 409 });
    const outstandingMinor = data.originalMinor - loan.repaidMinor;
    const status = outstandingMinor === 0 ? 'settled' : loan.repaidMinor > 0 ? 'partially_paid' : 'pending';
    return update('loans', id, { friendId: data.friendId, originalMinor: data.originalMinor, outstandingMinor, date: data.date, dueDate: data.dueDate, purpose: data.purpose, paymentMethod: data.paymentMethod, status }, transactionId);
  });
}

export async function listRowsInTransaction(key, filters, transactionId) {
  const result = await tablesDB.listRows({ databaseId, tableId: table(key), queries: [...filters, Query.limit(100)], transactionId });
  if (result.total > result.rows.length) throw new Error('Unexpectedly large split list; settlement was not applied.');
  return result.rows;
}

