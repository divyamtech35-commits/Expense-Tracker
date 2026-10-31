import { appwriteConfigured, tablesDB, databaseId } from '../config/appwrite.js';
import { assertCompatibleColumns, defaultSettings, settingsColumns } from '../config/appwriteSchema.js';

const settingsTableId = process.env.APPWRITE_SETTINGS_TABLE_ID || 'settings';
const settingsRowId = 'default';
const listKeys = new Set(['expenseCategories', 'incomeCategories', 'paymentMethods']);
let settingsWriteQueue = Promise.resolve();
let settingsTableReady;

const isAppwriteCode = (error, code) => Number(error?.code || error?.status) === code;

function invalidateSettingsTableCache() {
  settingsTableReady = undefined;
}

async function ensureSettingsTable() {
  if (!settingsTableReady) {
    const validation = (async () => {
      try {
        const existing = await tablesDB.getTable({ databaseId, tableId: settingsTableId });
        assertCompatibleColumns(existing, settingsColumns);
        return existing;
      } catch (error) {
        if (!isAppwriteCode(error, 404)) throw error;
      }

      try {
        return await tablesDB.createTable({
          databaseId,
          tableId: settingsTableId,
          name: 'Settings',
          permissions: [],
          rowSecurity: false,
          columns: settingsColumns,
        });
      } catch (error) {
        // Another request or the setup script may have created it after our 404.
        if (!isAppwriteCode(error, 409)) throw error;
        const existing = await tablesDB.getTable({ databaseId, tableId: settingsTableId });
        assertCompatibleColumns(existing, settingsColumns);
        return existing;
      }
    })();

    settingsTableReady = validation.catch((error) => {
      settingsTableReady = undefined;
      throw error;
    });
  }
  return settingsTableReady;
}

async function ensureDefaultSettingsRow() {
  try {
    return await tablesDB.getRow({ databaseId, tableId: settingsTableId, rowId: settingsRowId });
  } catch (error) {
    if (!isAppwriteCode(error, 404)) throw error;
  }

  try {
    return await tablesDB.createRow({ databaseId, tableId: settingsTableId, rowId: settingsRowId, data: defaultSettings });
  } catch (error) {
    // Another request may have inserted the singleton row concurrently.
    if (!isAppwriteCode(error, 409)) throw error;
    return tablesDB.getRow({ databaseId, tableId: settingsTableId, rowId: settingsRowId });
  }
}

function mapSettings(row) {
  if (!Array.isArray(row.expenseCategories) || !Array.isArray(row.incomeCategories)
    || !Array.isArray(row.paymentMethods) || !Number.isFinite(Number(row.dailyBudget))
    || typeof row.currency !== 'string') {
    throw new Error(`The Appwrite settings row in table "${settingsTableId}" is incomplete. Run npm run setup:appwrite or correct its columns and default row.`);
  }
  return {
    expenseCategories: row.expenseCategories,
    incomeCategories: row.incomeCategories,
    paymentMethods: row.paymentMethods,
    dailyBudget: Number(row.dailyBudget),
    currency: row.currency,
  };
}

export async function getSettings() {
  if (!appwriteConfigured) throw new Error('Appwrite is not configured.');
  await ensureSettingsTable();
  try {
    return mapSettings(await tablesDB.getRow({ databaseId, tableId: settingsTableId, rowId: settingsRowId }));
  } catch (error) {
    if (!isAppwriteCode(error, 404)) throw error;
    invalidateSettingsTableCache();
    await ensureSettingsTable();
    return mapSettings(await ensureDefaultSettingsRow());
  }
}

async function saveSettings(settings) {
  if (!appwriteConfigured) throw new Error('Appwrite is not configured.');
  try {
    const row = await tablesDB.updateRow({
      databaseId,
      tableId: settingsTableId,
      rowId: settingsRowId,
      data: settings,
    });
    return mapSettings(row);
  } catch (error) {
    if (!isAppwriteCode(error, 404)) throw error;
    invalidateSettingsTableCache();
    await ensureSettingsTable();
    await ensureDefaultSettingsRow();
    const row = await tablesDB.updateRow({
      databaseId,
      tableId: settingsTableId,
      rowId: settingsRowId,
      data: settings,
    });
    return mapSettings(row);
  }
}

export function mutateSettings({ action, key, value }) {
  const operation = settingsWriteQueue.then(async () => {
    const current = await getSettings();
    let next;

    if (action === 'set' && (key === 'dailyBudget' || key === 'currency')) {
      next = { ...current, [key]: key === 'dailyBudget' ? Number(value) : value };
    } else if ((action === 'add' || action === 'remove') && listKeys.has(key)) {
      const items = current[key];
      const exists = items.some((item) => item.toLowerCase() === value.toLowerCase());
      if (action === 'add' && !exists && items.length >= 100) {
        const error = new Error('A settings list cannot contain more than 100 items.');
        error.code = 400;
        throw error;
      }
      const updated = action === 'add'
        ? exists ? items : [...items, value]
        : items.filter((item) => item !== value);
      next = { ...current, [key]: updated };
    } else {
      throw new Error('Unsupported settings update.');
    }

    return saveSettings(next);
  });

  settingsWriteQueue = operation.then(() => undefined, () => undefined);
  return operation;
}
