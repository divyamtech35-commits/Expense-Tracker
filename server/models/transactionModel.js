import { ID, Query } from 'node-appwrite';
import { appwriteConfigured, databases, databaseId, transactionsCollectionId } from '../config/appwrite.js';

const toTransaction = (document) => ({
  id: document.$id,
  type: document.type,
  amount: Number(document.amount),
  category: document.category,
  note: document.note || '',
  date: document.date,
  paymentMethod: document.paymentMethod || 'Card',
  createdAt: document.$createdAt,
});

export async function listTransactions({ month } = {}) {
  if (!appwriteConfigured) return [];
  const queries = [Query.orderDesc('date'), Query.limit(100)];
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, monthNumber] = month.split('-').map(Number);
    const start = `${month}-01`;
    const endDate = new Date(Date.UTC(year, monthNumber, 0));
    const end = `${month}-${String(endDate.getUTCDate()).padStart(2, '0')}`;
    queries.push(Query.greaterThanEqual('date', start), Query.lessThanEqual('date', end));
  }
  const result = await databases.listDocuments(databaseId, transactionsCollectionId, queries);
  return result.documents.map(toTransaction);
}

export async function createTransaction(data) {
  const document = await databases.createDocument(databaseId, transactionsCollectionId, ID.unique(), {
    type: data.type,
    amount: Number(data.amount),
    category: data.category.trim(),
    note: data.note?.trim() || '',
    date: data.date,
    paymentMethod: data.paymentMethod || 'Card',
  });
  return toTransaction(document);
}

export async function deleteTransaction(id) {
  await databases.deleteDocument(databaseId, transactionsCollectionId, id);
}
