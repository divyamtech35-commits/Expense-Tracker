import { appwriteConfigured, missingAppwriteConfig } from '../config/appwrite.js';
import * as Transaction from '../models/transactionModel.js';

function isValidDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function getTransactions(req, res, next) {
  if (!appwriteConfigured) return res.status(503).json({ message: `Appwrite is not configured. Add ${missingAppwriteConfig.join(', ')} to your environment.` });
  try {
    const transactions = await Transaction.listTransactions({ month: req.query.month });
    res.json({ mode: 'appwrite', transactions });
  } catch (error) { next(error); }
}

export async function getPaymentMethodBalances(req, res, next) {
  if (!appwriteConfigured) return res.status(503).json({ message: `Appwrite is not configured. Add ${missingAppwriteConfig.join(', ')} to your environment.` });
  try {
    res.json(await Transaction.getPaymentMethodBalances());
  } catch (error) { next(error); }
}

export async function postTransaction(req, res, next) {
  const { type, amount, category, date, note, paymentMethod } = req.body || {};
  if (!['income', 'expense'].includes(type) || !Number.isFinite(Number(amount)) || Number(amount) <= 0 || typeof category !== 'string' || !category.trim() || typeof paymentMethod !== 'string' || !paymentMethod.trim() || !isValidDateOnly(date)) {
    return res.status(400).json({ message: 'Add a valid type, positive amount, category, payment method, and date.' });
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
    await Transaction.assertTransactionCanBeDeleted(req.params.id);
    await Transaction.deleteTransaction(req.params.id);
    res.json({ message: 'Transaction deleted.' });
  } catch (error) {
    const isMissingRow = Number(error.code) === 404
      && (error.type === 'row_not_found' || /row .*could not be found|row .*not found/i.test(error.message || ''));
    if (isMissingRow) return res.status(404).json({ message: 'Transaction not found.' });
    next(error);
  }
}
