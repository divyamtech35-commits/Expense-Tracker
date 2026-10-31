import { appwriteConfigured, missingAppwriteConfig } from '../config/appwrite.js';
import * as Transaction from '../models/transactionModel.js';

export async function getTransactions(req, res, next) {
  if (!appwriteConfigured) return res.json({ mode: 'local', transactions: [] });
  try {
    const transactions = await Transaction.listTransactions({ month: req.query.month });
    res.json({ mode: 'appwrite', transactions });
  } catch (error) { next(error); }
}

export async function postTransaction(req, res, next) {
  const { type, amount, category, date, note, paymentMethod } = req.body;
  if (!['income', 'expense'].includes(type) || !Number.isFinite(Number(amount)) || Number(amount) <= 0 || typeof category !== 'string' || !category.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(date || '') || Number.isNaN(Date.parse(`${date}T00:00:00`))) {
    return res.status(400).json({ message: 'Add a valid type, positive amount, category, and date.' });
  }
  if (!appwriteConfigured) return res.status(503).json({ message: `Appwrite is not configured. Add ${missingAppwriteConfig.join(', ')} to your environment.` });
  try {
    const transaction = await Transaction.createTransaction({ type, amount, category, date, note, paymentMethod });
    res.status(201).json(transaction);
  } catch (error) { next(error); }
}

export async function removeTransaction(req, res, next) {
  if (!appwriteConfigured) return res.status(503).json({ message: 'Appwrite is not configured.' });
  try {
    await Transaction.deleteTransaction(req.params.id);
    res.json({ message: 'Transaction deleted.' });
  } catch (error) {
    if (error.code === 404) return res.status(404).json({ message: 'Transaction not found.' });
    next(error);
  }
}
