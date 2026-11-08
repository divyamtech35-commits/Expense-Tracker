export const transactionColumns = [
  { key: 'type', type: 'string', format: 'enum', elements: ['income', 'expense'], required: true },
  { key: 'amount', type: 'double', required: true },
  { key: 'category', type: 'varchar', size: 100, required: true },
  { key: 'note', type: 'varchar', size: 255, required: false },
  { key: 'date', type: 'varchar', size: 10, required: true },
  { key: 'paymentMethod', type: 'varchar', size: 100, required: true },
  { key: 'sourceType', type: 'varchar', size: 32, required: false },
  { key: 'sourceId', type: 'varchar', size: 36, required: false },
];

export const settingsColumns = [
  { key: 'expenseCategories', type: 'varchar', size: 100, array: true, required: true },
  { key: 'incomeCategories', type: 'varchar', size: 100, array: true, required: true },
  { key: 'paymentMethods', type: 'varchar', size: 100, array: true, required: true },
  { key: 'dailyBudget', type: 'double', required: true },
  { key: 'currency', type: 'varchar', size: 3, required: true },
];

const col = (key, type, size = undefined, required = true) => ({ key, type, ...(size ? { size } : {}), required });
export const friendsFeatureTables = [
  { id: 'friends', name: 'Friends', columns: [col('name', 'varchar', 120), col('mobile', 'varchar', 40, false), col('notes', 'varchar', 500, false), col('archived', 'boolean')], indexes: [['name']] },
  { id: 'shared_bills', name: 'Shared bills', columns: [col('title', 'varchar', 160), col('description', 'varchar', 500, false), col('totalMinor', 'integer'), col('date', 'varchar', 10), col('payerId', 'varchar', 36), col('splitMethod', 'varchar', 12), col('category', 'varchar', 100, false), col('paymentMethod', 'varchar', 100, false), col('expenseTransactionId', 'varchar', 36, false)], indexes: [['date'], ['payerId'], ['expenseTransactionId']] },
  { id: 'bill_splits', name: 'Bill splits', columns: [col('billId', 'varchar', 36), col('participantId', 'varchar', 36), col('shareMinor', 'integer'), col('outstandingMinor', 'integer')], indexes: [['billId'], ['participantId']] },
  { id: 'friend_loans', name: 'Friend loans', columns: [col('friendId', 'varchar', 36), col('direction', 'varchar', 8), col('originalMinor', 'integer'), col('repaidMinor', 'integer'), col('outstandingMinor', 'integer'), col('date', 'varchar', 10), col('dueDate', 'varchar', 10, false), col('purpose', 'varchar', 255), col('paymentMethod', 'varchar', 100), col('status', 'varchar', 16)], indexes: [['friendId'], ['date'], ['status']] },
  { id: 'friend_settlements', name: 'Friend settlements', columns: [col('friendId', 'varchar', 36), col('direction', 'varchar', 8), col('amountMinor', 'integer'), col('date', 'varchar', 10), col('paymentMethod', 'varchar', 100), col('relatedType', 'varchar', 12), col('relatedId', 'varchar', 36), col('requestId', 'varchar', 36)], indexes: [['friendId'], ['date'], ['relatedId'], { attributes: ['requestId'], type: 'unique' }] },
  { id: 'friend_transfers', name: 'Friend transfers', columns: [col('friendId', 'varchar', 36), col('direction', 'varchar', 8), col('amountMinor', 'integer'), col('date', 'varchar', 10), col('purpose', 'varchar', 255), col('paymentMethod', 'varchar', 100), col('kind', 'varchar', 12), col('transactionId', 'varchar', 36, false)], indexes: [['friendId'], ['date']] },
  { id: 'savings_entries', name: 'Savings entries', columns: [col('type', 'varchar', 12), col('amountMinor', 'integer'), col('date', 'varchar', 10), col('description', 'varchar', 255), col('paymentMethod', 'varchar', 100, false)], indexes: [['date'], ['type']] },
  { id: 'savings_accounts', name: 'Savings accounts', columns: [col('balanceMinor', 'integer'), col('totalAddedMinor', 'integer'), col('totalSpentMinor', 'integer')] },
];

export const defaultSettings = {
  expenseCategories: ['Food & dining', 'Transport', 'Shopping', 'Bills & utilities', 'Health', 'Entertainment', 'Other'],
  incomeCategories: ['Salary', 'Freelance', 'Cashback', 'Gift', 'Other'],
  paymentMethods: ['Cash', 'Card', 'Bank transfer', 'UPI'],
  dailyBudget: 0,
  currency: 'INR',
};

export function assertCompatibleColumns(table, expectedColumns) {
  const actualColumns = new Map((table.columns || []).map((column) => [column.key, column]));
  const incompatible = expectedColumns.filter((expected) => {
    const actual = actualColumns.get(expected.key);
    if (!actual) return true;

    const expectedTypes = expected.type === 'varchar' ? ['varchar', 'string']
      : expected.type === 'double' ? ['double', 'float']
      : expected.format === 'enum' ? ['string', 'enum']
        : [expected.type];
    if (!expectedTypes.includes(actual.type)) return true;
    if (Boolean(actual.array) !== Boolean(expected.array)) return true;
    if (expected.format && actual.format !== expected.format && actual.type !== 'enum') return true;
    if (expected.elements && expected.elements.some((element) => !actual.elements?.includes(element))) return true;
    if (expected.size && (!Number.isFinite(Number(actual.size)) || Number(actual.size) < expected.size)) return true;
    return false;
  });

  if (incompatible.length) {
    const descriptions = incompatible.map(({ key, type }) => `${key} (${type})`);
    throw new Error(`Appwrite table "${table.$id}" has missing or incompatible columns: ${descriptions.join(', ')}. Update the table schema to match the application.`);
  }
}
