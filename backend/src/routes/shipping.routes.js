import { Router } from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import { getShippingRate, getTransitTime, getAllShippingOptionsController } from '../controllers/shipping.controller.js';

const router = Router();

// Get shipping rate (requires authentication)
router.post('/rate', protect, getShippingRate);

// Get time in transit for all services (requires authentication)
router.post('/transit', protect, getTransitTime);

// Get all available shipping options with rates and transit info (requires authentication)
router.post('/options', protect, getAllShippingOptionsController);

export default router;




