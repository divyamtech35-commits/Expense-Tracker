import { addSavingsEntry, deleteSavingsEntry, getSavingsSummary } from '../services/savingsService.js';

export async function getSavings(_req, res, next) {
  try { res.json(await getSavingsSummary()); } catch (error) { next(error); }
}

export async function postSavingsEntry(req, res, next) {
  const body = req.body || {};
  if (!['deposit', 'withdrawal'].includes(body.type)
    || typeof body.amount !== 'string' && typeof body.amount !== 'number'
    || typeof body.date !== 'string'
    || typeof body.description !== 'string'
    || typeof body.paymentMethod !== 'string') {
    return res.status(400).json({ message: 'Enter a type, amount, date, description, and payment method.' });
  }
  try { res.status(201).json(await addSavingsEntry(body)); } catch (error) { next(error); }
}

export async function removeSavingsEntry(req, res, next) {
  try { res.json(await deleteSavingsEntry(req.params.id)); } catch (error) { next(error); }
}
