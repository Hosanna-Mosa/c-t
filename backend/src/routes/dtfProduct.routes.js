import { Router } from 'express';
import { protect, verifyAdmin } from '../middlewares/auth.middleware.js';
import { upload } from '../middlewares/upload.middleware.js';
import {
  listDTFProducts,
  getDTFProductById,
  getDTFProductBySlug,
  createDTFProduct,
  updateDTFProduct,
  deleteDTFProduct,
} from '../controllers/dtfProduct.controller.js';

const router = Router();

router.get('/', listDTFProducts);
router.get('/slug/:slug', getDTFProductBySlug);
router.get('/:id', getDTFProductById);

router.post('/', protect, verifyAdmin, upload.single('image'), createDTFProduct);
router.put('/:id', protect, verifyAdmin, upload.single('image'), updateDTFProduct);
router.delete('/:id', protect, verifyAdmin, deleteDTFProduct);

export default router;


