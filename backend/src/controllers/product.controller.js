import { validationResult } from 'express-validator';
import Product from '../models/Product.js';
import { uploadImage, destroyImage } from '../services/cloudinary.service.js';

/* ============================================================
 🧩 List All Products
============================================================ */
export const listProducts = async (req, res) => {
  const { sortBy = 'createdAt', limit } = req.query;
  
  let sortCriteria = { createdAt: -1 };
  if (sortBy === 'popular' || sortBy === 'soldCount') {
    sortCriteria = { soldCount: -1, createdAt: -1 }; // Sort by soldCount desc, then by createdAt
  }
  
  let query = Product.find().sort(sortCriteria);
  
  if (limit) {
    query = query.limit(parseInt(limit));
  }
  
  const products = await query;
  res.json({ success: true, data: products });
};

/* ============================================================
 🧩 Get Product by Slug
============================================================ */
export const getBySlug = async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug });
  if (!product)
    return res.status(404).json({ success: false, message: 'Product not found' });

  res.json({ success: true, data: product });
};

/* ============================================================
 🧩 Create Product (Supports Variants + Design Template)
============================================================ */
export const createProduct = async (req, res) => {
  console.log('🆕 Starting product creation');
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('❌ Validation errors:', errors.array());
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      details: errors.array(),
    });
  }

  try {
    const body = req.body;
    console.log('📦 Request body received:', body);
    console.log('📁 Files received:', req.files ? req.files.length : 0, 'files');

    // 🧠 Parse variant data (color + images)
    // Expecting something like:
    // variants: '[{"color":"Red","colorCode":"#FF0000"},{"color":"Black"}]'
    let variants = [];
    if (body.variants) {
      try {
        variants =
          typeof body.variants === 'string'
            ? JSON.parse(body.variants)
            : body.variants;
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: 'Invalid variants JSON format',
        });
      }
    }

    // 🧩 Upload images from req.files and map them to variants
    // Frontend should send file field names like: images_Red_0, images_Black_1, etc.
    if (req.files && Object.keys(req.files).length) {
      for (const key of Object.keys(req.files)) {
        const match = key.match(/^images_(.+)$/); // extract color name
        if (match) {
          const color = match[1];
          const uploadedImages = [];
          for (const file of req.files[key]) {
            const img = await uploadImage(file.path);
            uploadedImages.push(img);
          }

          // Assign uploaded images to corresponding variant
          const variant = variants.find(
            (v) => v.color.toLowerCase() === color.toLowerCase()
          );
          if (variant) variant.images = uploadedImages;
        }
      }
    }

    // Allow creating a product without variants/images.
    // Variants can be added later via the "Manage Variants" flow.
    if (!Array.isArray(variants)) {
      variants = [];
    }

    // 🧠 Handle design template if customization is enabled
    let designTemplate = null;
    if (body.customizable === 'true' || body.customizable === true) {
      if (body.designTemplate) {
        try {
          designTemplate =
            typeof body.designTemplate === 'string'
              ? JSON.parse(body.designTemplate)
              : body.designTemplate;
        } catch (err) {
          return res.status(400).json({
            success: false,
            message: 'Invalid designTemplate format',
          });
        }
      }
    }

    // 🏷️ Create the product
    console.log('💾 Saving new product to database...');
    const product = await Product.create({
      ...body,
      variants,
      designTemplate,
    });
    console.log('✅ Product created successfully:', product.name);

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product,
    });
  } catch (error) {
    console.error('❌ Create Product Error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ============================================================
 🧩 Update Product (Supports Variants + Design)
============================================================ */
export const updateProduct = async (req, res) => {
  const { id } = req.params;
  console.log('🔄 Starting product update for ID:', id);
  
  const product = await Product.findById(id);
  if (!product) {
    console.log('❌ Product not found with ID:', id);
    return res.status(404).json({ success: false, message: 'Product not found' });
  }
  
  console.log('✅ Product found:', product.name);

  try {
    const body = req.body;
    console.log('📦 Request body received:', body);
    console.log('📁 Files received:', req.files ? req.files.length : 0, 'files');

    // 🧠 Parse variants
    let variants = [];
    if (body.variants) {
      console.log('🔍 Parsing variants from body:', body.variants);
      variants =
        typeof body.variants === 'string'
          ? JSON.parse(body.variants)
          : body.variants;
      console.log('✅ Parsed variants:', variants);
    } else {
      console.log('ℹ️ No variants in request body');
    }

    // 🧩 Handle new image uploads mapped to colors
    if (req.files && req.files.length) {
      console.log('🖼️ Processing', req.files.length, 'uploaded files');
      for (const file of req.files) {
        console.log('📄 Processing file:', {
          fieldname: file.fieldname,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size
        });
        
        // Match patterns like: images_Red_front_0, images_Red_back_1, images_Blue_front_0
        const match = file.fieldname.match(/^images_(.+)_(front|back)_(\d+)$/);
        if (match) {
          console.log('🎯 Pattern matched:', {
            color: match[1],
            side: match[2],
            index: match[3],
            fullMatch: match[0]
          });
          
          const color = match[1];
          const side = match[2]; // front or back
          
          console.log('☁️ Uploading image to Cloudinary...');
          // Upload single file to Cloudinary
          let img;
          try {
            img = await uploadImage(file.path);
            console.log('✅ Image uploaded successfully:', {
              url: img.url,
              public_id: img.public_id
            });
          } catch (uploadError) {
            console.error('❌ Image upload failed:', {
              file: file.originalname,
              path: file.path,
              error: uploadError.message
            });
            throw uploadError; // Re-throw to be caught by outer try-catch
          }

          const variant = variants.find(
            (v) => v.color.toLowerCase() === color.toLowerCase()
          );
          
          if (variant) {
            console.log('🔍 Found matching variant:', variant.color);
            
            // Initialize side-specific image arrays if they don't exist
            if (!variant.images) {
              variant.images = [];
              console.log('📝 Initialized variant.images array');
            }
            if (!variant.frontImages) {
              variant.frontImages = [];
              console.log('📝 Initialized variant.frontImages array');
            }
            if (!variant.backImages) {
              variant.backImages = [];
              console.log('📝 Initialized variant.backImages array');
            }
            
            // Add image to the appropriate side
            if (side === 'front') {
              variant.frontImages.push(img);
              console.log('➕ Added image to frontImages. Total front images:', variant.frontImages.length);
            } else if (side === 'back') {
              variant.backImages.push(img);
              console.log('➕ Added image to backImages. Total back images:', variant.backImages.length);
            }
            
            // Also add to general images array for backward compatibility
            variant.images.push(img);
            console.log('➕ Added image to general images array. Total images:', variant.images.length);
            
            console.log('✅ Updated variant:', {
              color: variant.color,
              frontImages: variant.frontImages.length,
              backImages: variant.backImages.length,
              totalImages: variant.images.length
            });
          } else {
            console.log('⚠️ No matching variant found for color:', color);
          }
        } else {
          console.log('❌ File fieldname does not match expected pattern:', file.fieldname);
        }
      }
    } else {
      console.log('ℹ️ No files to process');
    }

    // 🧩 Merge updated variants with existing product variants
    if (variants.length > 0) {
      console.log('🔄 Merging', variants.length, 'variants with existing product variants');
      console.log('📊 Existing product variants before merge:', product.variants.length);
      
      for (const variant of variants) {
        console.log('🔍 Processing variant:', variant.color);
        
        const existing = product.variants.find(
          (v) => v.color.toLowerCase() === variant.color.toLowerCase()
        );
        
        if (existing) {
          console.log('✅ Found existing variant:', existing.color);
          console.log('📊 Existing variant stats:', {
            frontImages: existing.frontImages?.length || 0,
            backImages: existing.backImages?.length || 0,
            totalImages: existing.images?.length || 0
          });
          
          // Update existing variant
          existing.frontImages = [...(existing.frontImages || []), ...(variant.frontImages || [])];
          existing.backImages = [...(existing.backImages || []), ...(variant.backImages || [])];
          existing.images = [...(existing.images || []), ...(variant.images || [])];
          
          console.log('✅ Updated existing variant:', {
            color: existing.color,
            frontImages: existing.frontImages.length,
            backImages: existing.backImages.length,
            totalImages: existing.images.length
          });
        } else {
          console.log('➕ Adding new variant:', variant.color);
          product.variants.push(variant);
          console.log('✅ New variant added. Total variants:', product.variants.length);
        }
      }
      
      console.log('📊 Final product variants after merge:', product.variants.length);
      console.log('📋 All variant colors:', product.variants.map(v => v.color));
    } else {
      console.log('ℹ️ No variants to merge');
    }

    // 🧹 Handle removed image public IDs
    if (body.removePublicIds) {
      console.log('🗑️ Processing removed image IDs:', body.removePublicIds);
      const ids = Array.isArray(body.removePublicIds)
        ? body.removePublicIds
        : [body.removePublicIds];
      
      for (const variant of product.variants) {
        const beforeCount = variant.images?.length || 0;
        variant.images = variant.images.filter(
          (img) => !ids.includes(img.public_id)
        );
        const afterCount = variant.images?.length || 0;
        console.log(`📉 Variant ${variant.color}: ${beforeCount} → ${afterCount} images`);
      }
      
      for (const pid of ids) {
        console.log('☁️ Destroying image from Cloudinary:', pid);
        await destroyImage(pid);
      }
      console.log('✅ Removed images processed');
    } else {
      console.log('ℹ️ No images to remove');
    }

    // 🧠 Handle design template update
    if (body.designTemplate) {
      console.log('🎨 Processing design template update');
      try {
        product.designTemplate =
          typeof body.designTemplate === 'string'
            ? JSON.parse(body.designTemplate)
            : body.designTemplate;
        console.log('✅ Design template updated successfully');
      } catch (err) {
        console.log('❌ Design template parsing error:', err.message);
        return res
          .status(400)
          .json({ success: false, message: 'Invalid designTemplate format' });
      }
    } else {
      console.log('ℹ️ No design template to update');
    }

    // 🏷️ Merge other product fields
    console.log('🔄 Merging other product fields');
    const { variants: _, removePublicIds: __, designTemplate: ___, ...otherFields } = body;
    const fieldsToUpdate = {
      ...otherFields,
      // Don't overwrite variants here - they were already merged above
    };
    console.log('📝 Fields to update:', Object.keys(fieldsToUpdate));
    
    Object.assign(product, fieldsToUpdate);
    console.log('✅ Product fields merged');

    console.log('💾 Saving product to database...');
    await product.save();
    console.log('✅ Product saved successfully');

    console.log('📊 Final product state:', {
      name: product.name,
      variants: product.variants.length,
      totalImages: product.variants.reduce((sum, v) => sum + (v.images?.length || 0), 0)
    });

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: product,
    });
  } catch (error) {
    console.error('❌ Update Product Error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ============================================================
 🧩 Delete Product (Also remove Cloudinary images)
============================================================ */
export const deleteProduct = async (req, res) => {
  const { id } = req.params;
  const product = await Product.findById(id);
  if (!product)
    return res.status(404).json({ success: false, message: 'Product not found' });

  // 🧹 Delete all variant images
  for (const variant of product.variants) {
    for (const img of variant.images || []) {
      await destroyImage(img.public_id);
    }
  }

  await product.deleteOne();

  res.json({ success: true, message: 'Product deleted successfully' });
};
