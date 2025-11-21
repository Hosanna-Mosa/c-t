import { validationResult } from 'express-validator';
import Coupon from '../models/Coupon.js';

const buildValidationMessage = (errors) => {
  if (!errors || errors.length === 0) {
    return 'Validation error';
  }
  
  const details = errors
    .map((err) => {
      const fieldName = err.param || err.path || 'field';
      const message = err.msg || 'Invalid value';
      // Capitalize first letter and add space before capital letters
      const formattedField = fieldName
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (str) => str.toUpperCase())
        .trim();
      return `${formattedField}: ${message}`;
    })
    .join(', ');
  return `Validation error - ${details}`;
};

// Get all coupons (Admin)
export const listCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json({ success: true, data: coupons });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch coupons' });
  }
};

// Get single coupon (Admin)
export const getCouponById = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }
    res.json({ success: true, data: coupon });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch coupon' });
  }
};

// Create coupon (Admin)
export const createCoupon = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res
      .status(400)
      .json({
        success: false,
        message: buildValidationMessage(errors.array()),
        details: errors.array(),
      });
  }

  try {
    const {
      code,
      discountType,
      discountValue,
      minPurchase,
      maxDiscount,
      validFrom,
      validTo,
      isActive,
      usageLimit,
      description,
    } = req.body;

    // Check if code already exists
    const existing = await Coupon.findOne({ code: code.toUpperCase().trim() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Coupon code already exists' });
    }

    // Normalize optional fields: convert empty strings, 0, or undefined to null
    const normalizedMaxDiscount = 
      maxDiscount === '' || maxDiscount === undefined || maxDiscount === 0 || maxDiscount === null 
        ? null 
        : Number(maxDiscount);
    const normalizedUsageLimit = 
      usageLimit === '' || usageLimit === undefined || usageLimit === 0 || usageLimit === null 
        ? null 
        : Number(usageLimit);

    const coupon = await Coupon.create({
      code: code.toUpperCase().trim(),
      discountType,
      discountValue: Number(discountValue),
      minPurchase: minPurchase ? Number(minPurchase) : 0,
      maxDiscount: normalizedMaxDiscount,
      validFrom: validFrom ? new Date(validFrom) : new Date(),
      validTo: new Date(validTo),
      isActive: isActive !== undefined ? isActive : true,
      usageLimit: normalizedUsageLimit,
      description: description || '',
    });

    res.status(201).json({ success: true, message: 'Coupon created successfully', data: coupon });
  } catch (error) {
    console.error('Create coupon error:', error);
    res.status(500).json({ success: false, message: 'Failed to create coupon' });
  }
};

// Update coupon (Admin)
export const updateCoupon = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res
      .status(400)
      .json({
        success: false,
        message: buildValidationMessage(errors.array()),
        details: errors.array(),
      });
  }

  try {
    const { id } = req.params;
    const {
      code,
      discountType,
      discountValue,
      minPurchase,
      maxDiscount,
      validFrom,
      validTo,
      isActive,
      usageLimit,
      description,
    } = req.body;

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    // Check if code is being changed and if new code already exists
    if (code && code.toUpperCase().trim() !== coupon.code) {
      const existing = await Coupon.findOne({ code: code.toUpperCase().trim() });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Coupon code already exists' });
      }
      coupon.code = code.toUpperCase().trim();
    }

    if (discountType !== undefined) coupon.discountType = discountType;
    if (discountValue !== undefined) coupon.discountValue = Number(discountValue);
    if (minPurchase !== undefined) coupon.minPurchase = minPurchase ? Number(minPurchase) : 0;
    
    // Normalize optional fields: convert empty strings, 0, or undefined to null
    if (maxDiscount !== undefined) {
      coupon.maxDiscount = 
        maxDiscount === '' || maxDiscount === 0 || maxDiscount === null 
          ? null 
          : Number(maxDiscount);
    }
    if (validFrom !== undefined) coupon.validFrom = new Date(validFrom);
    if (validTo !== undefined) coupon.validTo = new Date(validTo);
    if (isActive !== undefined) coupon.isActive = isActive;
    if (usageLimit !== undefined) {
      coupon.usageLimit = 
        usageLimit === '' || usageLimit === 0 || usageLimit === null 
          ? null 
          : Number(usageLimit);
    }
    if (description !== undefined) coupon.description = description;

    await coupon.save();
    res.json({ success: true, message: 'Coupon updated successfully', data: coupon });
  } catch (error) {
    console.error('Update coupon error:', error);
    res.status(500).json({ success: false, message: 'Failed to update coupon' });
  }
};

// Delete coupon (Admin)
export const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findByIdAndDelete(id);
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }
    res.json({ success: true, message: 'Coupon deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete coupon' });
  }
};

// Apply coupon (Public - for checkout)
export const applyCoupon = async (req, res) => {
  try {
    const { code, totalAmount } = req.body;

    if (!code || !totalAmount) {
      return res.status(400).json({ success: false, message: 'Coupon code and total amount are required' });
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase().trim(), isActive: true });
    
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Invalid or inactive coupon code' });
    }

    // Check validity dates
    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validTo) {
      return res.status(400).json({ success: false, message: 'Coupon code has expired or is not yet valid' });
    }

    // Check minimum purchase
    if (totalAmount < coupon.minPurchase) {
      return res.status(400).json({
        success: false,
        message: `Minimum purchase of $${coupon.minPurchase} required for this coupon`,
      });
    }

    // Check usage limit
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({ success: false, message: 'Coupon usage limit has been reached' });
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
      discountAmount = (totalAmount * coupon.discountValue) / 100;
      // Apply max discount limit if set
      if (coupon.maxDiscount !== null && discountAmount > coupon.maxDiscount) {
        discountAmount = coupon.maxDiscount;
      }
    } else {
      // Fixed discount
      discountAmount = coupon.discountValue;
      // Don't allow discount to exceed total amount
      if (discountAmount > totalAmount) {
        discountAmount = totalAmount;
      }
    }

    const finalAmount = Math.max(0, totalAmount - discountAmount);

    res.json({
      success: true,
      data: {
        coupon: {
          code: coupon.code,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          description: coupon.description,
        },
        discountAmount: Math.round(discountAmount * 100) / 100,
        finalAmount: Math.round(finalAmount * 100) / 100,
      },
    });
  } catch (error) {
    console.error('Apply coupon error:', error);
    res.status(500).json({ success: false, message: 'Failed to apply coupon' });
  }
};

// Get active coupons (Public - for checkout display)
export const getActiveCoupons = async (req, res) => {
  try {
    const now = new Date();
    const coupons = await Coupon.find({
      isActive: true,
      validFrom: { $lte: now },
      validTo: { $gte: now },
    })
      .select('code discountType discountValue minPurchase maxDiscount description validTo usageLimit usedCount')
      .sort({ createdAt: -1 });

    // Filter out coupons that have reached usage limit
    const availableCoupons = coupons.filter(
      (coupon) => coupon.usageLimit === null || coupon.usedCount < coupon.usageLimit
    );

    res.json({ success: true, data: availableCoupons });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch coupons' });
  }
};

