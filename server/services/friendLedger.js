export const SELF_PARTICIPANT_ID = 'self';
export const MAX_MINOR_UNITS = 2_147_483_647;

const invalid = (message) => Object.assign(new Error(message), { status: 400 });

export function amountToMinorUnits(value, { allowZero = false } = {}) {
  const text = String(value ?? '').trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) throw invalid('Enter an amount with no more than two decimal places.');
  const whole = BigInt(match[1]);
  const fraction = BigInt((match[2] || '').padEnd(2, '0') || '0');
  const minor = whole * 100n + fraction;
  if ((allowZero ? minor < 0n : minor <= 0n) || minor > BigInt(MAX_MINOR_UNITS)) throw invalid(`Amount must fit within the supported range (maximum ${MAX_MINOR_UNITS} paise).`);
  return Number(minor);
}

export function splitEqually(totalMinor, participantIds) {
  if (!Number.isSafeInteger(totalMinor) || totalMinor <= 0 || totalMinor > MAX_MINOR_UNITS) throw invalid('Total must be a positive amount within the supported range.');
  if (!Array.isArray(participantIds) || participantIds.length === 0 || new Set(participantIds).size !== participantIds.length) {
    throw invalid('Choose at least one participant and remove duplicate participants.');
  }
  if (!participantIds.includes(SELF_PARTICIPANT_ID)) throw invalid('You must be included as a participant.');
  const base = Math.floor(totalMinor / participantIds.length);
  let remainder = totalMinor % participantIds.length;
  return participantIds.map((participantId) => ({
    participantId,
    shareMinor: base + (remainder-- > 0 ? 1 : 0),
  }));
}

export function validateCustomSplits(totalMinor, shares) {
  if (!Array.isArray(shares) || shares.length === 0) throw new Error('Add a share for every participant.');
  const seen = new Set();
  const validated = shares.map(({ participantId, amount }) => {
    if (typeof participantId !== 'string' || !participantId || seen.has(participantId)) {
      throw invalid('Each participant must appear exactly once in the split.');
    }
    seen.add(participantId);
    const shareMinor = amountToMinorUnits(amount, { allowZero: true });
    return { participantId, shareMinor };
  });
  if (!seen.has(SELF_PARTICIPANT_ID)) throw invalid('You must be included as a participant.');
  if (validated.reduce((sum, share) => sum + share.shareMinor, 0) !== totalMinor) {
    throw invalid('Participant shares must add up to the full bill amount.');
  }
  return validated;
}

export function repaymentStatus(originalMinor, repaidMinor) {
  if (repaidMinor >= originalMinor) return 'settled';
  return repaidMinor > 0 ? 'partially_paid' : 'pending';
}

export function calculateBillShares(shares, payerId) {
  const personalExpenseMinor = shares.find((share) => share.participantId === SELF_PARTICIPANT_ID)?.shareMinor || 0;
  return {
    personalExpenseMinor,
    splits: shares.map((share) => ({ ...share, outstandingMinor: share.participantId === payerId ? 0 : share.shareMinor })),
  };
}

export function applyRepayment(outstandingMinor, amountMinor) {
  if (!Number.isSafeInteger(outstandingMinor) || outstandingMinor < 0 || !Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new Error('Repayment amount is invalid.');
  if (amountMinor > outstandingMinor) throw Object.assign(new Error('Repayment cannot exceed the outstanding balance.'), { status: 409 });
  return { outstandingMinor: outstandingMinor - amountMinor, repaidMinor: amountMinor, status: outstandingMinor === amountMinor ? 'settled' : 'partially_paid' };
}

export function minorToAmount(minor) {
  if (!Number.isSafeInteger(Number(minor))) throw new Error('Stored amount is outside the supported range.');
  return Number(minor) / 100;
}
