import { ID, Query } from 'node-appwrite';
import { databaseId, friendsTableIds, tablesDB, transactionsTableId } from '../config/appwrite.js';
import * as Db from '../models/friendManagementModel.js';
import { amountToMinorUnits, calculateBillShares, minorToAmount, SELF_PARTICIPANT_ID, splitEqually, validateCustomSplits } from './friendLedger.js';

const exists = async (id) => (await Db.listFriends()).some((friend) => friend.$id === id && !friend.archived);
const invalid = (message) => Object.assign(new Error(message), { status: 400 });
const dateOnly = (date) => {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
};

async function prepareBill(input) {
  const { participantIds, ...bill } = input;
  const totalMinor = amountToMinorUnits(bill.totalAmount);
  if (!Array.isArray(participantIds) || participantIds.some((id) => id !== SELF_PARTICIPANT_ID && typeof id !== 'string')) throw invalid('Choose valid participants.');
  if (bill.payerId !== SELF_PARTICIPANT_ID && !await exists(bill.payerId)) throw invalid('Choose a valid payer.');
  const allParticipants = [...new Set(participantIds)];
  const friendValidity = await Promise.all(allParticipants.filter((id) => id !== SELF_PARTICIPANT_ID).map(exists));
  if (allParticipants.length !== participantIds.length || friendValidity.some((valid) => !valid)) throw invalid('Choose each active friend only once.');
  if (!allParticipants.includes(SELF_PARTICIPANT_ID) || !allParticipants.includes(bill.payerId)) throw invalid('The payer and you must be included as participants.');
  if (!dateOnly(bill.date)) throw invalid('Enter a valid bill date.');
  const shares = bill.splitMethod === 'equal' ? splitEqually(totalMinor, allParticipants) : validateCustomSplits(totalMinor, input.shares || []);
  if (shares.length !== allParticipants.length || shares.some((share) => !allParticipants.includes(share.participantId))) throw invalid('Split participants must match the selected participants.');
  const { personalExpenseMinor, splits } = calculateBillShares(shares, bill.payerId);
  return { bill, totalMinor, personalExpenseMinor, splits };
}

function transactionData(bill, selfShare, billId) {
  return { type: 'expense', amount: minorToAmount(selfShare), category: bill.category || 'Shared bill', note: `Shared: ${bill.title.trim()}`, date: bill.date, paymentMethod: bill.paymentMethod || 'Other', sourceType: 'shared_bill', sourceId: billId };
}

async function writeSplits(billId, splits, transactionId) {
  for (const split of splits) await Db.createRow('splits', { billId, participantId: split.participantId, shareMinor: split.shareMinor, outstandingMinor: split.outstandingMinor }, transactionId);
}

export async function addBill(input) {
  const { bill, totalMinor, personalExpenseMinor, splits } = await prepareBill(input);
  return Db.runAtomic(async (transactionId) => {
    const billId = ID.unique();
    let expenseTransactionId = '';
    if (personalExpenseMinor > 0) {
      expenseTransactionId = ID.unique();
      await tablesDB.createRow({ databaseId, tableId: transactionsTableId, rowId: expenseTransactionId, transactionId, data: transactionData(bill, personalExpenseMinor, billId) });
    }
    await Db.createRow('bills', { title: bill.title.trim(), description: bill.description?.trim() || '', totalMinor, date: bill.date, payerId: bill.payerId, splitMethod: bill.splitMethod, category: bill.category || '', paymentMethod: bill.paymentMethod || '', expenseTransactionId }, transactionId, billId);
    await writeSplits(billId, splits, transactionId);
    return { id: billId };
  });
}

export async function editBill(id, input) {
  const { bill, totalMinor, personalExpenseMinor, splits } = await prepareBill(input);
  const existing = await Db.getRow('bills', id);
  return Db.runAtomic(async (transactionId) => {
    const priorSettlements = await Db.listRowsInTransaction('settlements', [Query.equal('relatedId', id)], transactionId);
    if (priorSettlements.some((item) => item.relatedType === 'shared_bill')) throw Object.assign(new Error('A bill with settlement history cannot be edited.'), { status: 409 });
    const oldSplits = await Db.listRowsInTransaction('splits', [Query.equal('billId', id)], transactionId);
    let expenseTransactionId = existing.expenseTransactionId || '';
    if (personalExpenseMinor > 0) {
      const data = transactionData(bill, personalExpenseMinor, id);
      if (expenseTransactionId) await tablesDB.updateRow({ databaseId, tableId: transactionsTableId, rowId: expenseTransactionId, transactionId, data });
      else { expenseTransactionId = ID.unique(); await tablesDB.createRow({ databaseId, tableId: transactionsTableId, rowId: expenseTransactionId, transactionId, data }); }
    } else if (expenseTransactionId) {
      await tablesDB.deleteRow({ databaseId, tableId: transactionsTableId, rowId: expenseTransactionId, transactionId });
      expenseTransactionId = '';
    }
    for (const split of oldSplits) await Db.deleteRow('splits', split.$id, transactionId);
    await writeSplits(id, splits, transactionId);
    await Db.updateRow('bills', id, { title: bill.title.trim(), description: bill.description?.trim() || '', totalMinor, date: bill.date, payerId: bill.payerId, splitMethod: bill.splitMethod, category: bill.category || '', paymentMethod: bill.paymentMethod || '', expenseTransactionId }, transactionId);
    return { id };
  });
}

export async function billDetail(id) {
  const bill = await Db.getRow('bills', id);
  return { ...bill, total: minorToAmount(bill.totalMinor), splits: await Db.listSplits(id) };
}

export async function addLoan(input) {
  if (!await exists(input.friendId)) throw invalid('Choose an active friend.');
  const originalMinor = amountToMinorUnits(input.amount);
  if (!dateOnly(input.date) || (input.dueDate && !dateOnly(input.dueDate))) throw invalid('Enter valid loan and due dates.');
  if (!['given', 'borrowed'].includes(input.direction)) throw invalid('Choose money given or borrowed.');
  return Db.createRow('loans', { friendId: input.friendId, direction: input.direction, originalMinor, repaidMinor: 0, outstandingMinor: originalMinor, date: input.date, dueDate: input.dueDate || '', purpose: input.purpose.trim(), paymentMethod: input.paymentMethod, status: 'pending' });
}

export async function editLoan(id, input) {
  if (!await exists(input.friendId)) throw invalid('Choose an active friend.');
  const originalMinor = amountToMinorUnits(input.amount);
  if (!dateOnly(input.date) || (input.dueDate && !dateOnly(input.dueDate))) throw invalid('Enter valid loan and due dates.');
  if (!['given', 'borrowed'].includes(input.direction)) throw invalid('Choose money given or borrowed.');
  if (typeof input.purpose !== 'string' || !input.purpose.trim() || input.purpose.trim().length > 255) throw invalid('Enter a purpose up to 255 characters.');
  if (typeof input.paymentMethod !== 'string' || !input.paymentMethod.trim() || input.paymentMethod.trim().length > 100) throw invalid('Enter a valid payment method.');
  return Db.updateLoan(id, { ...input, originalMinor, dueDate: input.dueDate || '', purpose: input.purpose.trim(), paymentMethod: input.paymentMethod.trim() });
}

export async function addTransfer(input) {
  if (!await exists(input.friendId)) throw invalid('Choose an active friend.');
  const amountMinor = amountToMinorUnits(input.amount);
  if (!dateOnly(input.date) || !['gift', 'other'].includes(input.kind) || !['given', 'received'].includes(input.direction)) throw invalid('Enter a valid transfer type and date.');
  return Db.runAtomic(async (transactionId) => {
    const transfer = await Db.createRow('transfers', { friendId: input.friendId, direction: input.direction, amountMinor, date: input.date, purpose: input.purpose.trim(), paymentMethod: input.paymentMethod, kind: input.kind }, transactionId);
    if (input.kind === 'gift') {
      const transactionRowId = ID.unique();
      await tablesDB.createRow({ databaseId, tableId: transactionsTableId, rowId: transactionRowId, transactionId, data: { type: input.direction === 'given' ? 'expense' : 'income', amount: minorToAmount(amountMinor), category: input.direction === 'given' ? 'Gift' : 'Gift received', note: `Gift ${input.direction === 'given' ? 'to' : 'from'} friend: ${input.purpose.trim()}`, date: input.date, paymentMethod: input.paymentMethod, sourceType: 'friend_transfer', sourceId: transfer.$id } });
      await Db.updateRow('transfers', transfer.$id, { transactionId: transactionRowId }, transactionId);
    }
    return transfer;
  });
}

export async function listLedger() {
  const [friends, bills, loans, settlements, transfers, allSplits] = await Promise.all([Db.listFriends(), Db.listBills(), Db.listLoans(), Db.listSettlements(), Db.listTransfers(), Db.listAllSplits()]);
  const splitsByBill = new Map();
  for (const split of allSplits) {
    const group = splitsByBill.get(split.billId) || [];
    group.push(split);
    splitsByBill.set(split.billId, group);
  }
  const friendRows = friends.map((friend) => {
    let receivableMinor = 0; let payableMinor = 0;
    for (const bill of bills) {
      const splits = splitsByBill.get(bill.$id) || [];
      if (bill.payerId === SELF_PARTICIPANT_ID) receivableMinor += splits.filter((split) => split.participantId === friend.$id).reduce((sum, split) => sum + split.outstandingMinor, 0);
      if (bill.payerId === friend.$id) payableMinor += splits.filter((split) => split.participantId === SELF_PARTICIPANT_ID).reduce((sum, split) => sum + split.outstandingMinor, 0);
    }
    loans.filter((loan) => loan.friendId === friend.$id).forEach((loan) => loan.direction === 'given' ? receivableMinor += loan.outstandingMinor : payableMinor += loan.outstandingMinor);
    return { ...friend, receivableMinor, payableMinor, receivable: minorToAmount(receivableMinor), payable: minorToAmount(payableMinor), net: minorToAmount(receivableMinor - payableMinor) };
  });
  return {
    friends: friendRows,
    bills: bills.map((bill) => ({ ...bill, total: minorToAmount(bill.totalMinor), splits: splitsByBill.get(bill.$id) || [] })),
    loans: loans.map((loan) => ({ ...loan, original: minorToAmount(loan.originalMinor), repaid: minorToAmount(loan.repaidMinor), outstanding: minorToAmount(loan.outstandingMinor), overdue: Boolean(loan.dueDate && loan.outstandingMinor && loan.dueDate < new Date().toISOString().slice(0, 10)) })),
    settlements: settlements.map((settlement) => ({ ...settlement, amount: minorToAmount(settlement.amountMinor) })),
    transfers: transfers.map((transfer) => ({ ...transfer, amount: minorToAmount(transfer.amountMinor) })),
    billsPending: bills.filter((bill) => (splitsByBill.get(bill.$id) || []).some((split) => split.outstandingMinor > 0)).length,
    totalReceivable: minorToAmount(friendRows.reduce((sum, friend) => sum + friend.receivableMinor, 0)),
    totalPayable: minorToAmount(friendRows.reduce((sum, friend) => sum + friend.payableMinor, 0)),
    totalLent: minorToAmount(loans.filter((loan) => loan.direction === 'given').reduce((sum, loan) => sum + loan.originalMinor, 0)),
    totalBorrowed: minorToAmount(loans.filter((loan) => loan.direction === 'borrowed').reduce((sum, loan) => sum + loan.originalMinor, 0)),
  };
}

export async function listBillsWithSplits() {
  const [bills, splits] = await Promise.all([Db.listBills(), Db.listAllSplits()]);
  const byBill = new Map();
  for (const split of splits) {
    const group = byBill.get(split.billId) || [];
    group.push(split);
    byBill.set(split.billId, group);
  }
  return bills.map((bill) => ({ ...bill, total: minorToAmount(bill.totalMinor), splits: byBill.get(bill.$id) || [] }));
}

export async function listLoansForApi() {
  const loans = await Db.listLoans();
  return loans.map((loan) => ({ ...loan, original: minorToAmount(loan.originalMinor), repaid: minorToAmount(loan.repaidMinor), outstanding: minorToAmount(loan.outstandingMinor), overdue: Boolean(loan.dueDate && loan.outstandingMinor && loan.dueDate < new Date().toISOString().slice(0, 10)) }));
}

export async function deleteLoan(id) {
  return Db.deleteLoan(id);
}

export async function listSettlementsForApi(month) {
  const settlements = await Db.listSettlements(month);
  return settlements.map((settlement) => ({ ...settlement, amount: minorToAmount(settlement.amountMinor) }));
}

export async function addFriend(input) {
  const name = input.name.trim();
  if (!name) throw invalid('Friend name is required.');
  return Db.createFriend({ name, mobile: input.mobile?.trim() || '', notes: input.notes?.trim() || '' });
}

export async function editFriend(id, input) {
  if (!await exists(id)) throw Object.assign(new Error('Friend not found.'), { status: 404 });
  const name = input.name.trim();
  if (!name) throw invalid('Friend name is required.');
  return Db.updateFriend(id, { name, mobile: input.mobile?.trim() || '', notes: input.notes?.trim() || '' });
}

export async function archiveFriend(id) {
  const friend = await Db.getFriend('friends', id);
  if (friend.archived) return;
  const ledger = await listLedger();
  const summary = ledger.friends.find((item) => item.$id === id);
  if (!summary) throw Object.assign(new Error('Friend not found.'), { status: 404 });
  if (summary.receivableMinor || summary.payableMinor) throw Object.assign(new Error('Settle this friend’s outstanding balance before deleting the friend.'), { status: 409 });
  await Db.updateFriend(id, { archived: true });
}

export async function deleteBill(id) {
  return Db.runAtomic(async (transactionId) => {
    const bill = await Db.getRow('bills', id, transactionId);
    const splits = await Db.listRowsInTransaction('splits', [Query.equal('billId', id)], transactionId);
    const settlements = await Db.listRowsInTransaction('settlements', [Query.equal('relatedId', id)], transactionId);
    if (settlements.some((item) => item.relatedType === 'shared_bill') || splits.some((split) => split.outstandingMinor !== (split.participantId === bill.payerId ? 0 : split.shareMinor))) throw Object.assign(new Error('A bill with settlement history cannot be deleted.'), { status: 409 });
    for (const split of splits) await Db.deleteRow('splits', split.$id, transactionId);
    await Db.deleteRow('bills', id, transactionId);
    if (bill.expenseTransactionId) await tablesDB.deleteRow({ databaseId, tableId: transactionsTableId, rowId: bill.expenseTransactionId, transactionId });
  });
}

export async function friendDetail(id) {
  const ledger = await listLedger();
  const friend = ledger.friends.find((item) => item.$id === id);
  if (!friend) throw Object.assign(new Error('Friend not found.'), { status: 404 });
  const bills = ledger.bills.filter((bill) => bill.payerId === id || bill.splits.some((split) => split.participantId === id));
  return { friend, bills, loans: ledger.loans.filter((loan) => loan.friendId === id), settlements: ledger.settlements.filter((settlement) => settlement.friendId === id), transfers: ledger.transfers.filter((transfer) => transfer.friendId === id) };
}

export { SELF_PARTICIPANT_ID, amountToMinorUnits };
