import DTFProduct from '../models/DTFProduct.js';
import { uploadImage, destroyImage } from '../services/cloudinary.service.js';

export const listDTFProducts = async (_req, res) => {
  const products = await DTFProduct.find({ isActive: true }).sort({ createdAt: -1 });
  res.json({ success: true, data: products });
};

export const getDTFProductById = async (req, res) => {
  const product = await DTFProduct.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'DTF product not found' });
  }
  res.json({ success: true, data: product });
};

export const getDTFProductBySlug = async (req, res) => {
  const product = await DTFProduct.findOne({ slug: req.params.slug, isActive: true });
  if (!product) {
    return res.status(404).json({ success: false, message: 'DTF product not found' });
  }
  res.json({ success: true, data: product });
};

export const createDTFProduct = async (req, res) => {
  try {
    const { title, description, cost, slug } = req.body;
    if (!title || !cost) {
      return res.status(400).json({ success: false, message: 'Title and cost are required' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Image is required' });
    }

    const costValue = Number(cost);
    if (Number.isNaN(costValue)) {
      return res.status(400).json({ success: false, message: 'Cost must be a valid number' });
    }

    const uploadedImage = await uploadImage(req.file.path, 'customtees/dtf-products');

    const product = await DTFProduct.create({
      title: String(title).trim(),
      slug: slug?.trim() || undefined,
      description: description?.trim(),
      cost: costValue,
      image: uploadedImage,
    });

    res.status(201).json({ success: true, message: 'DTF product created', data: product });
  } catch (error) {
    console.error('[DTFProduct] Create error:', error);
    res.status(500).json({ success: false, message: 'Failed to create DTF product' });
  }
};

export const updateDTFProduct = async (req, res) => {
  try {
    const product = await DTFProduct.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'DTF product not found' });
    }

    if (req.body.title !== undefined) product.title = String(req.body.title).trim();
    if (req.body.slug !== undefined) {
      product.slug =
        req.body.slug
          ?.toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || product.slug;
    }
    if (req.body.description !== undefined) product.description = req.body.description?.trim() || '';
    if (req.body.cost !== undefined) {
      const costValue = Number(req.body.cost);
      if (Number.isNaN(costValue)) {
        return res.status(400).json({ success: false, message: 'Cost must be a valid number' });
      }
      product.cost = costValue;
    }
    if (req.body.isActive !== undefined) {
      product.isActive = req.body.isActive === 'true' || req.body.isActive === true;
    }

    if (req.file) {
      if (product.image?.public_id) {
        await destroyImage(product.image.public_id).catch(() => {});
      }
      const uploadedImage = await uploadImage(req.file.path, 'customtees/dtf-products');
      product.image = uploadedImage;
    }

    await product.save();
    res.json({ success: true, message: 'DTF product updated', data: product });
  } catch (error) {
    console.error('[DTFProduct] Update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update DTF product' });
  }
};

export const deleteDTFProduct = async (req, res) => {
  try {
    const product = await DTFProduct.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'DTF product not found' });
    }

    if (product.image?.public_id) {
      await destroyImage(product.image.public_id).catch(() => {});
    }

    await product.deleteOne();
    res.json({ success: true, message: 'DTF product deleted' });
  } catch (error) {
    console.error('[DTFProduct] Delete error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete DTF product' });
  }
};


