import CasualProduct from '../models/CasualProduct.js';
import { uploadImage, destroyImage } from '../services/cloudinary.service.js';

const parseArrayField = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
};

export const listCasualProducts = async (_req, res) => {
  const products = await CasualProduct.find({ isActive: true }).sort({ createdAt: -1 });
  res.json({ success: true, data: products });
};

export const getCasualProductById = async (req, res) => {
  const product = await CasualProduct.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }
  res.json({ success: true, data: product });
};

export const getCasualProductBySlug = async (req, res) => {
  const product = await CasualProduct.findOne({ slug: req.params.slug, isActive: true });
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }
  res.json({ success: true, data: product });
};

export const createCasualProduct = async (req, res) => {
  try {
    const { name, slug, category, price } = req.body;
    if (!name || !category || !price) {
      return res.status(400).json({
        success: false,
        message: 'Name, category and price are required',
      });
    }

    const priceValue = Number(price);
    if (Number.isNaN(priceValue)) {
      return res.status(400).json({
        success: false,
        message: 'Price must be a valid number',
      });
    }

    const productData = {
      name: String(name).trim(),
      slug: slug?.trim() || undefined,
      category: String(category).trim(),
      description: req.body.description?.trim(),
      price: priceValue,
      colors: parseArrayField(req.body.colors),
      sizes: parseArrayField(req.body.sizes),
      metadata: {
        material: req.body.material?.trim(),
        fit: req.body.fit?.trim(),
        careInstructions: req.body.careInstructions?.trim(),
      },
    };

    const uploadedImages = [];
    if (Array.isArray(req.files) && req.files.length) {
      for (const file of req.files) {
        const uploaded = await uploadImage(file.path, 'customtees/casual-products');
        uploadedImages.push(uploaded);
      }
    }
    productData.images = uploadedImages;

    const product = await CasualProduct.create(productData);
    res.status(201).json({ success: true, message: 'Product created successfully', data: product });
  } catch (error) {
    console.error('[CasualProduct] Create error:', error);
    res.status(500).json({ success: false, message: 'Failed to create product' });
  }
};

export const updateCasualProduct = async (req, res) => {
  try {
    const product = await CasualProduct.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (req.body.name) product.name = String(req.body.name).trim();
    if (req.body.slug !== undefined) {
      product.slug = String(req.body.slug || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || product.slug;
    }
    if (req.body.category) product.category = String(req.body.category).trim();
    if (req.body.description !== undefined) product.description = req.body.description?.trim() || '';
    if (req.body.price !== undefined) {
      const priceValue = Number(req.body.price);
      if (Number.isNaN(priceValue)) {
        return res.status(400).json({ success: false, message: 'Price must be a valid number' });
      }
      product.price = priceValue;
    }
    if (req.body.isActive !== undefined) product.isActive = req.body.isActive === 'true' || req.body.isActive === true;

    if (req.body.colors !== undefined) product.colors = parseArrayField(req.body.colors);
    if (req.body.sizes !== undefined) product.sizes = parseArrayField(req.body.sizes);

    const metadata = {
      material: product.metadata?.material ?? '',
      fit: product.metadata?.fit ?? '',
      careInstructions: product.metadata?.careInstructions ?? '',
    };
    if (req.body.material !== undefined) {
      metadata.material = req.body.material?.trim() || '';
    }
    if (req.body.fit !== undefined) {
      metadata.fit = req.body.fit?.trim() || '';
    }
    if (req.body.careInstructions !== undefined) {
      metadata.careInstructions = req.body.careInstructions?.trim() || '';
    }
    product.metadata = metadata;

    // Remove images if requested
    let removeImageIds = req.body.removeImageIds;
    if (typeof removeImageIds === 'string') {
      try {
        removeImageIds = JSON.parse(removeImageIds);
      } catch (error) {
        removeImageIds = removeImageIds.split(',').map((id) => id.trim());
      }
    }
    if (Array.isArray(removeImageIds) && removeImageIds.length) {
      product.images = product.images.filter((img) => {
        if (removeImageIds.includes(img.public_id)) {
          destroyImage(img.public_id).catch(() => {});
          return false;
        }
        return true;
      });
    }

    // Upload new images
    if (Array.isArray(req.files) && req.files.length) {
      for (const file of req.files) {
        const uploaded = await uploadImage(file.path, 'customtees/casual-products');
        product.images.push(uploaded);
      }
    }

    await product.save();
    res.json({ success: true, message: 'Product updated successfully', data: product });
  } catch (error) {
    console.error('[CasualProduct] Update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update product' });
  }
};

export const deleteCasualProduct = async (req, res) => {
  try {
    const product = await CasualProduct.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    for (const image of product.images) {
      await destroyImage(image.public_id);
    }

    await product.deleteOne();
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    console.error('[CasualProduct] Delete error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete product' });
  }
};

