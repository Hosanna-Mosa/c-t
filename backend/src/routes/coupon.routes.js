import { Router } from 'express';
import { body } from 'express-validator';
import {
  listCoupons,
  getCouponById,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  applyCoupon,
  getActiveCoupons,
} from '../controllers/coupon.controller.js';
import { protect, verifyAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

// Public routes
router.get('/active', getActiveCoupons);
router.post('/apply', applyCoupon);

// Admin routes
router.get('/', protect, verifyAdmin, listCoupons);
router.get('/:id', protect, verifyAdmin, getCouponById);
router.post(
  '/',
  protect,
  verifyAdmin,
  [
    body('code').notEmpty().trim().withMessage('Coupon code is required'),
    body('discountType').isIn(['percentage', 'fixed']).withMessage('Invalid discount type'),
    body('discountValue')
      .isNumeric().withMessage('Discount value must be a number')
      .isFloat({ min: 0 }).withMessage('Discount value must be positive'),
    body('validTo').notEmpty().withMessage('Valid to date is required'),
    body('minPurchase')
      .optional({ values: 'falsy' })
      .isNumeric().withMessage('Minimum purchase must be a number')
      .isFloat({ min: 0 }).withMessage('Minimum purchase must be positive'),
    body('maxDiscount')
      .optional({ values: 'falsy' })
      .custom((value) => {
        if (value === '' || value === null || value === undefined) return true;
        return !isNaN(value) && parseFloat(value) >= 0;
      })
      .withMessage('Max discount must be a positive number'),
    body('usageLimit')
      .optional({ values: 'falsy' })
      .custom((value) => {
        if (value === '' || value === null || value === undefined) return true;
        return !isNaN(value) && parseInt(value) >= 0;
      })
      .withMessage('Usage limit must be a positive integer'),
  ],
  createCoupon
);
router.put(
  '/:id',
  protect,
  verifyAdmin,
  [
    body('code').optional({ values: 'falsy' }).notEmpty().trim().withMessage('Coupon code cannot be empty'),
    body('discountType').optional({ values: 'falsy' }).isIn(['percentage', 'fixed']).withMessage('Invalid discount type'),
    body('discountValue')
      .optional({ values: 'falsy' })
      .isNumeric().withMessage('Discount value must be a number')
      .isFloat({ min: 0 }).withMessage('Discount value must be positive'),
    body('minPurchase')
      .optional({ values: 'falsy' })
      .isNumeric().withMessage('Minimum purchase must be a number')
      .isFloat({ min: 0 }).withMessage('Minimum purchase must be positive'),
    body('maxDiscount')
      .optional({ values: 'falsy' })
      .custom((value) => {
        if (value === '' || value === null || value === undefined) return true;
        return !isNaN(value) && parseFloat(value) >= 0;
      })
      .withMessage('Max discount must be a positive number'),
    body('usageLimit')
      .optional({ values: 'falsy' })
      .custom((value) => {
        if (value === '' || value === null || value === undefined) return true;
        return !isNaN(value) && parseInt(value) >= 0;
      })
      .withMessage('Usage limit must be a positive integer'),
  ],
  updateCoupon
);
router.delete('/:id', protect, verifyAdmin, deleteCoupon);

export default router;



