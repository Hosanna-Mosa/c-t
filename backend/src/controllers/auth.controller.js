import { validationResult } from 'express-validator';
import User from '../models/User.js';
import Design from '../models/Design.js';
import { hashPassword, comparePassword, signToken } from '../services/auth.service.js';
import { generateVerificationCode, sendVerificationCode, sendPasswordResetSuccess } from '../services/email.service.js';
import { uploadDataUrl } from '../services/cloudinary.service.js';

export const signup = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, message: 'Validation error', details: errors.array() });
  try {
    const { name, email, password } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'Email already registered' });
    const hashed = await hashPassword(password);
    const user = await User.create({ name, email, password: hashed });
    const token = signToken({ id: user._id, role: user.role });
    const { password: _, ...profile } = user.toObject();
    res.status(201).json({ success: true, message: 'Signup successful', data: { token, user: profile } });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, message: 'Validation error', details: errors.array() });
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ success: false, message: 'Invalid email or password' });
  const match = await comparePassword(password, user.password);
  if (!match) return res.status(401).json({ success: false, message: 'Invalid email or password' });
  const token = signToken({ id: user._id, role: user.role });
  const { password: _, ...profile } = user.toObject();
  res.json({ success: true, message: 'Login successful', data: { token, user: profile } });
};

export const getProfile = async (req, res) => {
  res.json({ success: true, data: req.user });
};

export const updateProfile = async (req, res) => {
  const fields = ['name'];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) req.user[f] = req.body[f];
  });
  await req.user.save();
  res.json({ success: true, data: req.user });
};

// Save or update a design in the authenticated user's profile
export const saveDesign = async (req, res) => {
  try {
    const body = req.body || {};
    console.log('Saving design with data:', {
      name: body.name,
      hasFrontDesign: !!body.frontDesign,
      hasBackDesign: !!body.backDesign,
      frontPreviewImage: body.frontDesign?.previewImage ? 'Yes' : 'No',
      backPreviewImage: body.backDesign?.previewImage ? 'Yes' : 'No',
      frontLayers: body.frontDesign?.designLayers?.length || 0,
      backLayers: body.backDesign?.designLayers?.length || 0
    });
    
    let design;
    if (body._id) {
      design = await Design.findOneAndUpdate(
        { _id: body._id, user: req.user._id },
        { ...body },
        { new: true }
      );
      if (!design) return res.status(404).json({ success: false, message: 'Design not found' });
    } else {
      design = await Design.create({ ...body, user: req.user._id });
      // store only id reference in user
      req.user.designs.push(design._id);
      await req.user.save();
    }
    
    console.log('Design saved successfully:', {
      id: design._id,
      name: design.name,
      hasFrontDesign: !!design.frontDesign,
      hasBackDesign: !!design.backDesign,
      frontPreviewImage: design.frontDesign?.previewImage ? 'Yes' : 'No',
      backPreviewImage: design.backDesign?.previewImage ? 'Yes' : 'No'
    });
    
    res.status(201).json({ success: true, data: design });
  } catch (e) {
    console.error('Error saving design:', e);
    res.status(500).json({ success: false, message: 'Failed to save design' });
  }
};

// List designs for authenticated user
export const listDesigns = async (req, res) => {
  try {
    const designs = await Design.find({ user: req.user._id }).sort({ updatedAt: -1 });
    res.json({ success: true, data: designs });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to fetch designs' });
  }
};

export const getDesignById = async (req, res) => {
  try {
    const { id } = req.params;
    const design = await Design.findOne({ _id: id, user: req.user._id });
    if (!design) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: design });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to fetch design' });
  }
};

export const deleteDesign = async (req, res) => {
  try {
    const { id } = req.params;
    const design = await Design.findOneAndDelete({ _id: id, user: req.user._id });
    if (!design) return res.status(404).json({ success: false, message: 'Design not found' });
    
    // Remove design reference from user
    req.user.designs = req.user.designs.filter(designId => designId.toString() !== id);
    await req.user.save();
    
    res.json({ success: true, message: 'Design deleted successfully' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to delete design' });
  }
};

// Cart functionality
export const addToCart = async (req, res) => {
  try {
    const cartItem = req.body;
    if (!cartItem?.productId || !cartItem?.productName || !cartItem?.productSlug) {
      return res.status(400).json({ success: false, message: 'Missing product information for cart item' });
    }

    if (!cartItem.productModel) {
      cartItem.productModel =
        cartItem.productType === 'casual'
          ? 'CasualProduct'
          : cartItem.productType === 'dtf'
          ? 'DTFProduct'
          : 'Product';
    }

    if (!cartItem.productType) {
      cartItem.productType =
        cartItem.productModel === 'CasualProduct'
          ? 'casual'
          : cartItem.productModel === 'DTFProduct'
          ? 'dtf'
          : 'custom';
    }

    if (!cartItem.selectedColor) {
      cartItem.selectedColor = cartItem.productType === 'custom' ? 'Default' : '';
    }
    if (!cartItem.selectedSize) {
      cartItem.selectedSize = cartItem.productType === 'custom' ? 'Default' : '';
    }

    if (cartItem?.instruction) {
      cartItem.instruction = String(cartItem.instruction).trim();
      if (!cartItem.instruction) {
        delete cartItem.instruction;
      }
    }

    if (cartItem.productType === 'dtf') {
      if (!cartItem.dtfPrintFile) {
        return res.status(400).json({ success: false, message: 'Print ready file is required for DTF products' });
      }

      if (cartItem.dtfPrintFile?.dataUrl?.startsWith('data:image')) {
        try {
          const uploaded = await uploadDataUrl(cartItem.dtfPrintFile.dataUrl, 'customtees/dtf/print-ready');
          cartItem.dtfPrintFile = {
            url: uploaded.url,
            publicId: uploaded.public_id,
            preview: uploaded.url,
            fileName: cartItem.dtfPrintFile.fileName,
          };
        } catch (uploadErr) {
          console.error('[Cart] Failed to upload DTF print file:', uploadErr);
          return res.status(500).json({ success: false, message: 'Failed to upload print ready file' });
        }
      }

      if (!cartItem.dtfPrintFile?.url) {
        return res.status(400).json({ success: false, message: 'Invalid print ready file' });
      }
    }
    const dollar = (n) => `$${Number(n || 0).toFixed(2)}`;

    // Back-office logging for design metrics per requirement
    const logSide = (side, design) => {
      const metrics = design?.metrics || {};
      const layers = design?.designLayers || [];
      const wIn = typeof metrics.widthInches === 'number' ? metrics.widthInches.toFixed(2) : '0.00';
      const hIn = typeof metrics.heightInches === 'number' ? metrics.heightInches.toFixed(2) : '0.00';
      const wPx = typeof metrics.widthPixels === 'number' ? Math.round(metrics.widthPixels) : 0;
      const hPx = typeof metrics.heightPixels === 'number' ? Math.round(metrics.heightPixels) : 0;
      const areaIn = typeof metrics.areaInches === 'number' ? metrics.areaInches.toFixed(2) : '0.00';
      const totalPx = typeof metrics.totalPixels === 'number' ? Math.round(metrics.totalPixels) : 0;
      
      console.log(`\n[Cart] ${side.toUpperCase()} DESIGN`);
      console.log(`- Overall Design Width: ${wIn}\" (${wPx} px)`);
      console.log(`- Overall Design Height: ${hIn}\" (${hPx} px)`);
      console.log(`- Total Area: ${areaIn} in² (${totalPx} px²)`);
      console.log(`- Layers Count: ${layers.length}`);
      
      if (Array.isArray(metrics?.perLayer) && metrics.perLayer.length > 0) {
        console.log(`\n  Layer Details:`);
        metrics.perLayer.forEach((layer, idx) => {
          console.log(`  • Layer #${idx + 1} [${layer.type}] (ID: ${layer.id})`);
          console.log(`    - Width: ${layer.widthInches.toFixed(2)}\" (${Math.round(layer.widthPixels)} px)`);
          console.log(`    - Height: ${layer.heightInches.toFixed(2)}\" (${Math.round(layer.heightPixels)} px)`);
          console.log(`    - Area: ${layer.areaInches.toFixed(2)} in² (${Math.round(layer.areaPixels)} px²)`);
          console.log(`    - Cost: ${dollar(layer.cost)}`);
        });
      } else {
        console.log(`  - No design layers`);
      }
    };

    try {
      console.log(`\n[Cart] Adding product '${cartItem?.productName}' (${cartItem?.selectedColor || '—'}/${cartItem?.selectedSize || '—'})`);
      console.log(`- Type: ${cartItem?.productType}`);
      console.log(`- Base: ${dollar(cartItem?.basePrice)} | Front: ${dollar(cartItem?.frontCustomizationCost)} | Back: ${dollar(cartItem?.backCustomizationCost)} | Total: ${dollar(cartItem?.totalPrice)}`);
      if (cartItem?.productType === 'custom') {
        logSide('front', cartItem?.frontDesign);
        logSide('back', cartItem?.backDesign);
      }
    } catch (e) {
      console.warn('[Cart] Failed to log metrics:', e?.message);
    }
    
    // Add cart item to user's cart array
    req.user.cart.push(cartItem);
    await req.user.save();
    
    res.json({ success: true, message: 'Item added to cart', data: req.user.cart });
  } catch (e) {
    console.error('[Auth Controller] Add to cart error:', e);
    res.status(500).json({ success: false, message: 'Failed to add to cart' });
  }
};

export const getCart = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('cart.productId');
    res.json({ success: true, data: user.cart });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to fetch cart' });
  }
};

export const updateCartItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;
    
    const cartItem = req.user.cart.id(itemId);
    if (!cartItem) return res.status(404).json({ success: false, message: 'Cart item not found' });
    
    cartItem.quantity = quantity;
    await req.user.save();
    
    res.json({ success: true, message: 'Cart item updated', data: req.user.cart });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to update cart item' });
  }
};

export const removeFromCart = async (req, res) => {
  try {
    const { itemId } = req.params;
    
    const cartItem = req.user.cart.id(itemId);
    if (!cartItem) return res.status(404).json({ success: false, message: 'Cart item not found' });
    
    cartItem.deleteOne();
    await req.user.save();
    
    res.json({ success: true, message: 'Item removed from cart', data: req.user.cart });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to remove from cart' });
  }
};

export const clearCart = async (req, res) => {
  try {
    req.user.cart = [];
    await req.user.save();
    
    res.json({ success: true, message: 'Cart cleared' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to clear cart' });
  }
};

export const addAddress = async (req, res) => {
  const address = req.body;
  // Ensure country defaults to 'US' if not provided (for backward compatibility)
  if (!address.country) {
    address.country = 'US';
  }
  req.user.addresses.push(address);
  await req.user.save();
  res.status(201).json({ success: true, data: req.user.addresses });
};

export const updateAddress = async (req, res) => {
  const { id } = req.params;
  const addr = req.user.addresses.id(id);
  if (!addr) return res.status(404).json({ success: false, message: 'Address not found' });
  
  // Ensure country defaults to 'US' if not provided or empty (for backward compatibility)
  const updateData = { ...req.body };
  if (!updateData.country || updateData.country.trim() === '') {
    updateData.country = 'US';
  }
  
  Object.assign(addr, updateData);
  await req.user.save();
  res.json({ success: true, data: req.user.addresses });
};

export const deleteAddress = async (req, res) => {
  const { id } = req.params;
  const addr = req.user.addresses.id(id);
  if (!addr) return res.status(404).json({ success: false, message: 'Address not found' });
  addr.deleteOne();
  await req.user.save();
  res.json({ success: true, data: req.user.addresses });
};

// Forgot password - send verification code
export const forgotPassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, message: 'Validation error', details: errors.array() });
  
  try {
    const { email } = req.body;
    
    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Email not found' });
    }
    
    // Generate verification code
    const verificationCode = generateVerificationCode();
    
    // Set expiration time (10 minutes from now)
    const expirationTime = new Date(Date.now() + 10 * 60 * 1000);
    
    // Save verification code to user
    user.resetPasswordCode = verificationCode;
    user.resetPasswordExpires = expirationTime;
    await user.save();
    
    // Send verification code via email
    const emailResult = await sendVerificationCode(email, verificationCode);
    
    if (!emailResult.success) {
      return res.status(500).json({ success: false, message: 'Failed to send verification code' });
    }
    
    res.json({ success: true, message: 'Verification code sent to your email' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Verify code and reset password
export const resetPassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, message: 'Validation error', details: errors.array() });
  
  try {
    const { email, code, newPassword } = req.body;
    
    // Find user with valid verification code
    const user = await User.findOne({
      email,
      resetPasswordCode: code,
      resetPasswordExpires: { $gt: new Date() }
    });
    
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification code' });
    }
    
    // Hash new password
    const hashedPassword = await hashPassword(newPassword);
    
    // Update password and clear reset fields
    user.password = hashedPassword;
    user.resetPasswordCode = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    
    // Send success email
    await sendPasswordResetSuccess(email);
    
    res.json({ success: true, message: 'Password reset successful' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


