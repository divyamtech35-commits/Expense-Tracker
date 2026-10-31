export const transactionColumns = [
  { key: 'type', type: 'string', format: 'enum', elements: ['income', 'expense'], required: true },
  { key: 'amount', type: 'double', required: true },
  { key: 'category', type: 'varchar', size: 100, required: true },
  { key: 'note', type: 'varchar', size: 255, required: false },
  { key: 'date', type: 'varchar', size: 10, required: true },
  { key: 'paymentMethod', type: 'varchar', size: 100, required: true },
];

export const settingsColumns = [
  { key: 'expenseCategories', type: 'varchar', size: 100, array: true, required: true },
  { key: 'incomeCategories', type: 'varchar', size: 100, array: true, required: true },
  { key: 'paymentMethods', type: 'varchar', size: 100, array: true, required: true },
  { key: 'dailyBudget', type: 'double', required: true },
  { key: 'currency', type: 'varchar', size: 3, required: true },
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

    const expectedTypes = expected.type === 'double' ? ['double', 'float']
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
