import dotenv from 'dotenv';
import { Client, TablesDB } from 'node-appwrite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertCompatibleColumns, defaultSettings, settingsColumns, transactionColumns } from '../config/appwriteSchema.js';

// Load the root .env even when launched from server/scripts.
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: resolve(projectRoot, '.env') });

const requiredEnv = ['APPWRITE_ENDPOINT', 'APPWRITE_PROJECT_ID', 'APPWRITE_API_KEY', 'APPWRITE_DATABASE_ID'];
const missing = requiredEnv.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const databaseId = process.env.APPWRITE_DATABASE_ID.trim();
const tableId = (process.env.APPWRITE_TRANSACTIONS_TABLE_ID || process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID || 'transactions').trim();
const settingsTableId = (process.env.APPWRITE_SETTINGS_TABLE_ID || 'settings').trim();
const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT.trim())
  .setProject(process.env.APPWRITE_PROJECT_ID.trim())
  .setKey(process.env.APPWRITE_API_KEY.trim());
const tablesDB = new TablesDB(client);

async function createTransactionsTable() {
  let existing;
  try {
    existing = await tablesDB.getTable({ databaseId, tableId });
  } catch (error) {
    if (Number(error?.code) !== 404 && Number(error?.status) !== 404) throw error;
  }

  if (!existing) {
    await tablesDB.createTable({
      databaseId,
      tableId,
      name: 'Transactions',
      permissions: [],
      rowSecurity: false,
      columns: transactionColumns,
      indexes: [{ key: 'idx_transactions_date', type: 'key', attributes: ['date'] }],
    });
    console.log(`Created Transactions table "${tableId}" in existing TablesDB database "${databaseId}".`);
  } else {
    assertCompatibleColumns(existing, transactionColumns);
    const { indexes } = await tablesDB.listIndexes({ databaseId, tableId });
    const hasDateIndex = indexes.some((index) => ['key', 'unique'].includes(index.type)
      && (index.attributes?.includes('date') || index.columns?.includes('date')));
    if (!hasDateIndex) {
      await tablesDB.createIndex({ databaseId, tableId, key: 'idx_transactions_date', type: 'key', columns: ['date'] });
      console.log('Created the missing transactions date index.');
    }
    console.log(`Transactions table already exists with a compatible schema: ${existing.$id}`);
  }
}

async function createSettingsTable() {
  let existing;
  try {
    existing = await tablesDB.getTable({ databaseId, tableId: settingsTableId });
  } catch (error) {
    if (Number(error?.code) !== 404 && Number(error?.status) !== 404) throw error;
  }

  if (!existing) {
    await tablesDB.createTable({
      databaseId,
      tableId: settingsTableId,
      name: 'Settings',
      permissions: [],
      rowSecurity: false,
      columns: settingsColumns,
    });
    console.log(`Created Settings table "${settingsTableId}".`);
  } else {
    assertCompatibleColumns(existing, settingsColumns);
    console.log(`Settings table already exists with a compatible schema: ${existing.$id}`);
  }

  try {
    await tablesDB.getRow({ databaseId, tableId: settingsTableId, rowId: 'default' });
    console.log('Settings row already has initial values.');
  } catch (error) {
    if (Number(error?.code) !== 404 && Number(error?.status) !== 404) throw error;
    await tablesDB.createRow({
      databaseId,
      tableId: settingsTableId,
      rowId: 'default',
      data: defaultSettings,
    });
    console.log('Seeded the Settings table with default categories, payment methods, daily budget, and currency.');
  }
}

async function setup() {
  await createTransactionsTable();
  await createSettingsTable();
}

setup().catch((error) => {
  console.error(`Appwrite TablesDB setup failed: ${error.message}`);
  if (error.code) console.error(`Appwrite error code: ${error.code}`);
  process.exitCode = 1;
});
