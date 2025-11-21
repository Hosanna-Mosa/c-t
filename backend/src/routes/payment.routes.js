import { Router } from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import { verifySquarePayment } from '../controllers/payment.controller.js';

const router = Router();

router.post('/square/verify', protect, verifySquarePayment);

export default router;


