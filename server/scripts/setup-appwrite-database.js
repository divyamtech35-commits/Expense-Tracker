import dotenv from 'dotenv';
import { Client, TablesDB } from 'node-appwrite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertCompatibleColumns, defaultSettings, friendsFeatureTables, settingsColumns, transactionColumns } from '../config/appwriteSchema.js';

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
const featureTableIds = {
  friends: process.env.APPWRITE_FRIENDS_TABLE_ID || 'friends',
  shared_bills: process.env.APPWRITE_SHARED_BILLS_TABLE_ID || 'shared_bills',
  bill_splits: process.env.APPWRITE_BILL_SPLITS_TABLE_ID || 'bill_splits',
  friend_loans: process.env.APPWRITE_FRIEND_LOANS_TABLE_ID || 'friend_loans',
  friend_settlements: process.env.APPWRITE_FRIEND_SETTLEMENTS_TABLE_ID || 'friend_settlements',
  friend_transfers: process.env.APPWRITE_FRIEND_TRANSFERS_TABLE_ID || 'friend_transfers',
  savings_entries: process.env.APPWRITE_SAVINGS_ENTRIES_TABLE_ID || 'savings_entries',
  savings_accounts: process.env.APPWRITE_SAVINGS_ACCOUNTS_TABLE_ID || 'savings_accounts',
};
const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT.trim())
  .setProject(process.env.APPWRITE_PROJECT_ID.trim())
  .setKey(process.env.APPWRITE_API_KEY.trim());
const tablesDB = new TablesDB(client);

async function ensureOptionalColumns(tableId, existing, expectedColumns) {
  let columns = new Map((existing.columns || []).map((column) => [column.key, column]));
  for (const expected of expectedColumns) {
    if (columns.has(expected.key) || expected.required || expected.type !== 'varchar') continue;
    await tablesDB.createVarcharColumn({ databaseId, tableId, key: expected.key, size: expected.size || 255, required: false });
    let ready = false;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await new Promise((resolveWait) => setTimeout(resolveWait, 500));
      existing = await tablesDB.getTable({ databaseId, tableId });
      columns = new Map((existing.columns || []).map((column) => [column.key, column]));
      const created = columns.get(expected.key);
      if (created?.status === 'available') { ready = true; break; }
      if (created?.status === 'failed' || created?.status === 'stuck') throw new Error(`Appwrite could not create optional column "${expected.key}" in table "${tableId}".`);
    }
    if (!ready) throw new Error(`Timed out waiting for optional column "${expected.key}" in table "${tableId}".`);
    console.log(`Added optional column "${expected.key}" to table "${tableId}".`);
  }
  return existing;
}

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
    existing = await ensureOptionalColumns(tableId, existing, transactionColumns);
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

function tableColumns(columns) {
  return columns.map(({ key, type, size, required }) => ({ key, type, size, required }));
}

async function ensureFeatureTable(definition) {
  let existing;
  try {
    existing = await tablesDB.getTable({ databaseId, tableId: definition.id });
  } catch (error) {
    if (Number(error?.code) !== 404 && Number(error?.status) !== 404) throw error;
  }
  if (!existing) {
    await tablesDB.createTable({
      databaseId,
      tableId: definition.id,
      name: definition.name,
      permissions: [],
      rowSecurity: false,
      columns: tableColumns(definition.columns),
    });
    console.log(`Created ${definition.name} table "${definition.id}".`);
  } else {
    existing = await ensureOptionalColumns(definition.id, existing, definition.columns);
    assertCompatibleColumns(existing, definition.columns);
    console.log(`${definition.name} table already exists with a compatible schema.`);
  }

  const { indexes } = await tablesDB.listIndexes({ databaseId, tableId: definition.id });
  for (const [index, definitionIndex] of definition.indexes.entries()) {
    const attributes = Array.isArray(definitionIndex) ? definitionIndex : definitionIndex.attributes;
    const type = Array.isArray(definitionIndex) ? 'key' : definitionIndex.type;
    const found = indexes.some((item) => item.type === type && (item.attributes?.join(',') === attributes.join(',') || item.columns?.join(',') === attributes.join(',')));
    if (!found) {
      await tablesDB.createIndex({ databaseId, tableId: definition.id, key: `idx_${definition.id}_${index + 1}`, type, columns: attributes });
    }
  }
}

async function setup() {
  await createTransactionsTable();
  await createSettingsTable();
  for (const definition of friendsFeatureTables) await ensureFeatureTable({ ...definition, id: featureTableIds[definition.id] });
}

setup().catch((error) => {
  console.error(`Appwrite TablesDB setup failed: ${error.message}`);
  if (error.code) console.error(`Appwrite error code: ${error.code}`);
  process.exitCode = 1;
});
