import { Router } from 'express';
import { getSettings, putSettings } from '../controllers/settingsController.js';

const router = Router();
router.get('/', getSettings);
router.put('/', putSettings);

export default router;
