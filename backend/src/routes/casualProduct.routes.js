import { Router } from 'express';
import { protect, verifyAdmin } from '../middlewares/auth.middleware.js';
import { upload } from '../middlewares/upload.middleware.js';
import {
  listCasualProducts,
  getCasualProductById,
  getCasualProductBySlug,
  createCasualProduct,
  updateCasualProduct,
  deleteCasualProduct,
} from '../controllers/casualProduct.controller.js';

const router = Router();

router.get('/', listCasualProducts);
router.get('/slug/:slug', getCasualProductBySlug);
router.get('/:id', getCasualProductById);

router.post(
  '/',
  protect,
  verifyAdmin,
  upload.array('images', 12),
  createCasualProduct
);

router.put(
  '/:id',
  protect,
  verifyAdmin,
  upload.array('images', 12),
  updateCasualProduct
);

router.delete('/:id', protect, verifyAdmin, deleteCasualProduct);

export default router;

