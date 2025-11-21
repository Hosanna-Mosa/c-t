import { Router } from 'express';
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from '../controllers/template.controller.js';
import { protect, verifyAdmin } from '../middlewares/auth.middleware.js';
import { upload } from '../middlewares/upload.middleware.js';

const router = Router();

router.get('/', listTemplates);
router.post('/', protect, verifyAdmin, upload.single('image'), createTemplate);
router.put('/:id', protect, verifyAdmin, upload.single('image'), updateTemplate);
router.delete('/:id', protect, verifyAdmin, deleteTemplate);

export default router;


