import { Client, TablesDB } from 'node-appwrite';

const requiredEnv = [
  'APPWRITE_ENDPOINT',
  'APPWRITE_PROJECT_ID',
  'APPWRITE_API_KEY',
  'APPWRITE_DATABASE_ID',
];

export const missingAppwriteConfig = [
  ...requiredEnv.filter((key) => !process.env[key]),
  ...(!process.env.APPWRITE_TRANSACTIONS_TABLE_ID && !process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID
    ? ['APPWRITE_TRANSACTIONS_TABLE_ID']
    : []),
];
export const appwriteConfigured = missingAppwriteConfig.length === 0;

const client = new Client();
if (appwriteConfigured) {
  client.setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);
}

export const tablesDB = appwriteConfigured ? new TablesDB(client) : null;
export const databaseId = process.env.APPWRITE_DATABASE_ID;
export const transactionsTableId = process.env.APPWRITE_TRANSACTIONS_TABLE_ID || process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID;
export const friendsTableIds = {
  friends: process.env.APPWRITE_FRIENDS_TABLE_ID || 'friends',
  bills: process.env.APPWRITE_SHARED_BILLS_TABLE_ID || 'shared_bills',
  splits: process.env.APPWRITE_BILL_SPLITS_TABLE_ID || 'bill_splits',
  loans: process.env.APPWRITE_FRIEND_LOANS_TABLE_ID || 'friend_loans',
  settlements: process.env.APPWRITE_FRIEND_SETTLEMENTS_TABLE_ID || 'friend_settlements',
  transfers: process.env.APPWRITE_FRIEND_TRANSFERS_TABLE_ID || 'friend_transfers',
};
