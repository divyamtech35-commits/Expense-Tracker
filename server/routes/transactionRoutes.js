import { Router } from 'express';
import { getTransactions, postTransaction, removeTransaction } from '../controllers/transactionController.js';

const router = Router();
router.get('/', getTransactions);
router.post('/', postTransaction);
router.delete('/:id', removeTransaction);

export default router;
