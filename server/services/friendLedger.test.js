import test from 'node:test';
import assert from 'node:assert/strict';
import { amountToMinorUnits, applyRepayment, calculateBillShares, MAX_MINOR_UNITS, repaymentStatus, splitEqually, validateCustomSplits } from './friendLedger.js';

test('shared bill equal split accounts for every paisa and the payer share', () => {
  const total = amountToMinorUnits('1200.01');
  const shares = splitEqually(total, ['self', 'rahul', 'aman', 'karan']);
  assert.deepEqual(shares.map(({ shareMinor }) => shareMinor), [30001, 30000, 30000, 30000]);
  const ledger = calculateBillShares(shares, 'self');
  assert.equal(ledger.personalExpenseMinor, 30001);
  assert.equal(ledger.splits.reduce((sum, split) => sum + split.outstandingMinor, 0), 90000);
});

test('custom shared bill splits accept zero shares but reject totals that do not match', () => {
  const shares = validateCustomSplits(12500, [
    { participantId: 'self', amount: '100' },
    { participantId: 'friend', amount: '25' },
    { participantId: 'friend-two', amount: '0' },
  ]);
  assert.deepEqual(shares.map(({ shareMinor }) => shareMinor), [10000, 2500, 0]);
  assert.throws(() => validateCustomSplits(12500, [{ participantId: 'self', amount: '100' }, { participantId: 'friend', amount: '20' }]));
});

test('loan repayment tracks partial and full amounts without floating point math', () => {
  const original = amountToMinorUnits('1000');
  const partial = applyRepayment(original, amountToMinorUnits('400'));
  assert.deepEqual(partial, { outstandingMinor: 60000, repaidMinor: 40000, status: 'partially_paid' });
  const full = applyRepayment(partial.outstandingMinor, amountToMinorUnits('600'));
  assert.deepEqual(full, { outstandingMinor: 0, repaidMinor: 60000, status: 'settled' });
  assert.equal(repaymentStatus(original, original), 'settled');
});

test('settlements reject overpayment and preserve unpaid balance', () => {
  assert.throws(() => applyRepayment(2500, 2501), { status: 409 });
  assert.deepEqual(applyRepayment(2500, 1000), { outstandingMinor: 1500, repaidMinor: 1000, status: 'partially_paid' });
});

test('paise conversion rejects fractional paise and negative values', () => {
  assert.equal(amountToMinorUnits('19.99'), 1999);
  assert.throws(() => amountToMinorUnits('10.001'));
  assert.throws(() => amountToMinorUnits('-1'));
});

test('paise amount validation matches Appwrite signed integer storage limits', () => {
  assert.equal(amountToMinorUnits('21474836.47'), MAX_MINOR_UNITS);
  assert.throws(() => amountToMinorUnits('21474836.48'), { status: 400 });
});
