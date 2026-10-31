import { appwriteConfigured, missingAppwriteConfig } from '../config/appwrite.js';
import * as Settings from '../models/settingsModel.js';

export async function getSettings(req, res, next) {
  if (!appwriteConfigured) return res.status(503).json({ message: `Appwrite is not configured. Add ${missingAppwriteConfig.join(', ')} to your environment.` });
  try {
    res.json(await Settings.getSettings());
  } catch (error) { next(error); }
}

const listKeys = new Set(['expenseCategories', 'incomeCategories', 'paymentMethods']);

export async function putSettings(req, res, next) {
  if (!appwriteConfigured) return res.status(503).json({ message: `Appwrite is not configured. Add ${missingAppwriteConfig.join(', ')} to your environment.` });
  const { action, key, value } = req.body || {};
  let normalizedValue = value;

  if (action === 'set' && key === 'dailyBudget') {
    if (!Number.isFinite(Number(value)) || Number(value) < 0) {
      return res.status(400).json({ message: 'Daily spending guide must be a non-negative number.' });
    }
    normalizedValue = Number(value);
  } else if (action === 'set' && key === 'currency') {
    if (typeof value !== 'string' || !/^[A-Z]{3}$/.test(value)) {
      return res.status(400).json({ message: 'Currency must be a three-letter uppercase code.' });
    }
  } else if ((action === 'add' || action === 'remove') && listKeys.has(key)) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 100) {
      return res.status(400).json({ message: 'Category and payment method names must be 1–100 characters.' });
    }
    normalizedValue = value.trim();
  } else {
    return res.status(400).json({ message: 'Unsupported settings update.' });
  }

  try {
    const settings = await Settings.mutateSettings({ action, key, value: normalizedValue });
    res.json(settings);
  } catch (error) { next(error); }
}
