import { Client, Databases } from 'node-appwrite';

const requiredEnv = ['APPWRITE_ENDPOINT', 'APPWRITE_PROJECT_ID', 'APPWRITE_API_KEY', 'APPWRITE_DATABASE_ID', 'APPWRITE_TRANSACTIONS_COLLECTION_ID'];
const missingConfig = requiredEnv.filter((key) => !process.env[key]);

export const appwriteConfigured = missingConfig.length === 0;
export const missingAppwriteConfig = missingConfig;

const client = new Client();
if (appwriteConfigured) {
  client.setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);
}

export const databases = appwriteConfigured ? new Databases(client) : null;
export const databaseId = process.env.APPWRITE_DATABASE_ID;
export const transactionsCollectionId = process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID;
