import * as FriendManagement from '../services/friendManagement.js';
import * as Db from '../models/friendManagementModel.js';

const text = (value, max, required = false) => typeof value === 'string' && value.trim().length <= max && (!required || Boolean(value.trim()));
function forwardWriteError(error, next) { if (!error.code && !error.status) error.status = 500; next(error); }

export async function getFriends(_req, res, next) {
  try { const ledger = await FriendManagement.listLedger(); res.json({ friends: ledger.friends.filter((friend) => !friend.archived), summary: ledger }); }
  catch (error) { next(error); }
}
export async function postFriend(req, res, next) {
  const { name, mobile = '', notes = '' } = req.body || {};
  if (!text(name, 120, true) || !text(mobile, 40) || !text(notes, 500)) return res.status(400).json({ message: 'Enter a name, a mobile number up to 40 characters, and notes up to 500 characters.' });
  try { res.status(201).json(await FriendManagement.addFriend({ name, mobile, notes })); } catch (error) { forwardWriteError(error, next); }
}
export async function getFriend(req, res, next) {
  try { res.json(await FriendManagement.friendDetail(req.params.id)); } catch (error) { next(error); }
}
export async function patchFriend(req, res, next) {
  const { name, mobile = '', notes = '' } = req.body || {};
  if (!text(name, 120, true) || !text(mobile, 40) || !text(notes, 500)) return res.status(400).json({ message: 'Enter a valid name, mobile number, and notes.' });
  try { res.json(await FriendManagement.editFriend(req.params.id, { name, mobile, notes })); } catch (error) { forwardWriteError(error, next); }
}
export async function removeFriend(req, res, next) {
  try { await FriendManagement.archiveFriend(req.params.id); res.json({ message: 'Friend removed from the active list.' }); } catch (error) { next(error); }
}

export async function getBills(_req, res, next) {
  try { res.json({ bills: await FriendManagement.listBillsWithSplits() }); } catch (error) { next(error); }
}
export async function getBill(req, res, next) {
  try { res.json(await FriendManagement.billDetail(req.params.id)); } catch (error) { next(error); }
}
function validBillBody(body) {
  return text(body.title, 160, true) && text(body.description || '', 500) && ['equal', 'custom'].includes(body.splitMethod) && typeof body.payerId === 'string' && Array.isArray(body.participantIds) && text(body.date, 10, true);
}
export async function postBill(req, res, next) {
  const body = req.body || {};
  if (!validBillBody(body)) return res.status(400).json({ message: 'Enter a title, date, payer, participants, and valid split method.' });
  try { res.status(201).json(await FriendManagement.addBill(body)); } catch (error) { forwardWriteError(error, next); }
}
export async function patchBill(req, res, next) {
  const body = req.body || {};
  if (!validBillBody(body)) return res.status(400).json({ message: 'Enter a title, date, payer, participants, and valid split method.' });
  try { res.json(await FriendManagement.editBill(req.params.id, body)); } catch (error) { forwardWriteError(error, next); }
}
export async function removeBill(req, res, next) {
  try { await FriendManagement.deleteBill(req.params.id); res.json({ message: 'Bill deleted and its personal expense reversed.' }); } catch (error) { next(error); }
}
export async function getLoans(_req, res, next) {
  try { res.json({ loans: await FriendManagement.listLoansForApi() }); } catch (error) { next(error); }
}
export async function postLoan(req, res, next) {
  const body = req.body || {};
  if (!['given', 'borrowed'].includes(body.direction) || typeof body.friendId !== 'string' || typeof body.amount !== 'string' && typeof body.amount !== 'number' || !text(body.date, 10, true) || !text(body.purpose, 255, true) || !text(body.paymentMethod, 100, true)) return res.status(400).json({ message: 'Enter a friend, amount, date, purpose, and payment method.' });
  try { res.status(201).json(await FriendManagement.addLoan(body)); } catch (error) { forwardWriteError(error, next); }
}
export async function getSettlements(_req, res, next) {
  try { res.json({ settlements: await FriendManagement.listSettlementsForApi() }); } catch (error) { next(error); }
}
export async function postSettlement(req, res, next) {
  const body = req.body || {};
  if (!['received', 'paid'].includes(body.direction) || typeof body.friendId !== 'string' || typeof body.relatedId !== 'string' || !['shared_bill', 'loan'].includes(body.relatedType) || typeof body.amount !== 'string' && typeof body.amount !== 'number' || !text(body.date, 10, true) || !text(body.paymentMethod, 100, true) || !/^[a-zA-Z0-9_-]{1,36}$/.test(body.requestId || '')) return res.status(400).json({ message: 'Enter a valid settlement direction, friend, amount, date, payment method, and request ID.' });
  try {
    const amountMinor = FriendManagement.amountToMinorUnits(body.amount);
    res.status(201).json(await Db.settleOutstanding({ ...body, amountMinor }));
  } catch (error) { forwardWriteError(error, next); }
}
export async function postTransfer(req, res, next) {
  const body = req.body || {};
  if (!['given', 'received'].includes(body.direction) || !['gift', 'other'].includes(body.kind) || typeof body.friendId !== 'string' || typeof body.amount !== 'string' && typeof body.amount !== 'number' || !text(body.date, 10, true) || !text(body.purpose, 255, true) || !text(body.paymentMethod, 100, true)) return res.status(400).json({ message: 'Enter valid transfer details.' });
  try { res.status(201).json(await FriendManagement.addTransfer(body)); } catch (error) { forwardWriteError(error, next); }
}
