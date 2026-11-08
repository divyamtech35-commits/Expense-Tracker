import { Router } from 'express';
import { getSavings, postSavingsEntry, removeSavingsEntry } from '../controllers/savingsController.js';

const router = Router();
router.get('/', getSavings);
router.post('/', postSavingsEntry);
router.delete('/:id', removeSavingsEntry);

export default router;
