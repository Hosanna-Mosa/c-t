import { Router } from 'express';
import { protect, verifyAdmin } from '../middlewares/auth.middleware.js';
import { getTrackingByNumber, getTrackingForOrder, triggerTrackingSync } from '../controllers/tracking.controller.js';

const router = Router();

router.get('/order/:orderId', protect, getTrackingForOrder);
router.post('/sync', protect, verifyAdmin, triggerTrackingSync);
router.get('/:trackingNumber', getTrackingByNumber);

export default router;


