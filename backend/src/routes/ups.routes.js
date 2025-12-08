import { Router } from 'express';
import { handleUpsCallback } from '../controllers/ups.controller.js';

const router = Router();

router.post('/callback', handleUpsCallback);

export default router;
