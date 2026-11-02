import { Router } from 'express';
import { getTransactions, getPaymentMethodBalances, postTransaction, removeTransaction } from '../controllers/transactionController.js';

const router = Router();
router.get('/', getTransactions);
router.get('/balances', getPaymentMethodBalances);
router.post('/', postTransaction);
router.delete('/:id', removeTransaction);

export default router;
