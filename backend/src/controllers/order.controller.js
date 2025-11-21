import Order from '../models/Order.js';
import Product from '../models/Product.js';
import CasualProduct from '../models/CasualProduct.js';
import DTFProduct from '../models/DTFProduct.js';
import User from '../models/User.js';
import Coupon from '../models/Coupon.js';
import CheckoutSession from '../models/CheckoutSession.js';
import { uploadDataUrl } from '../services/cloudinary.service.js';
import { createSquareCheckoutSession, isSquareConfigured } from '../services/square.service.js';

export const createOrder = async (req, res) => {
  const { productId, quantity = 1, paymentMethod, shippingAddress } = req.body;
  let product = await Product.findById(productId);
  let productModel = 'Product';
  if (!product) {
    product = await CasualProduct.findById(productId);
    productModel = 'CasualProduct';
  }
  if (!product) {
    product = await DTFProduct.findById(productId);
    productModel = 'DTFProduct';
  }
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
  const unitPrice = product.price ?? product.cost;
  const item = {
    product: product._id,
    productModel,
    productType:
      productModel === 'Product'
        ? 'custom'
        : productModel === 'CasualProduct'
        ? 'casual'
        : 'dtf',
    productName: product.name || product.title,
    productSlug: product.slug,
    productImage: product.images?.[0]?.url || product.image?.url,
    quantity,
    price: unitPrice,
  };
  const total = unitPrice * quantity;
  const order = await Order.create({
    user: req.user._id,
    items: [item],
    total,
    paymentMethod,
    shippingAddress,
  });
  res.status(201).json({ success: true, data: order });
};

const incrementCouponUsage = async (couponDoc) => {
  if (!couponDoc) return;
  couponDoc.usedCount += 1;
  await couponDoc.save();
};

export const createOrderFromCart = async (req, res) => {
  try {
    const {
      paymentMethod,
      shippingAddress,
      couponCode,
      discountAmount,
      shippingCost,
      shippingServiceCode,
      shippingServiceName,
    } = req.body;
    
    // Get user with cart
    const user = await User.findById(req.user._id);
    if (!user || !user.cart.length) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }
    
    // Normalize a side (front/back) design: upload preview if it's a data URL
    const normalizeSideDesign = async (design) => {
      if (!design) return undefined;
      let previewImage = design.previewImage;
      try {
        if (typeof previewImage === 'string' && previewImage.startsWith('data:image')) {
          const uploaded = await uploadDataUrl(previewImage, 'customtees/previews');
          previewImage = uploaded.url;
        }
      } catch (e) {
        // If upload fails, keep original so order still goes through
        console.warn('[Orders] Preview upload failed, keeping data URL:', e?.message);
      }

      // Coerce metrics.perLayer to array of objects (not strings)
      let metrics = design.metrics || undefined;
      if (metrics) {
        // If entire perLayer is a JSON string, parse it
        if (typeof metrics.perLayer === 'string') {
          try {
            const parsed = JSON.parse(metrics.perLayer);
            metrics.perLayer = Array.isArray(parsed) ? parsed : [];
          } catch (_) {
            metrics.perLayer = [];
          }
        }
        if (Array.isArray(metrics.perLayer)) {
          metrics.perLayer = metrics.perLayer.map((entry) => {
            if (entry && typeof entry === 'string') {
              try {
                const parsed = JSON.parse(entry);
                return parsed && typeof parsed === 'object' ? parsed : undefined;
              } catch (_) {
                return undefined;
              }
            }
            return entry && typeof entry === 'object' ? entry : undefined;
          }).filter(Boolean);
        }
      }

      return { ...design, previewImage, metrics };
    };
    
    // Convert cart items to order items (with normalized previews)
    const orderItems = [];
    for (const cartItem of user.cart) {
      const isCustom = cartItem.productType === 'custom';
      const frontDesign = isCustom ? await normalizeSideDesign(cartItem.frontDesign) : undefined;
      const backDesign = isCustom ? await normalizeSideDesign(cartItem.backDesign) : undefined;

      const productModelName =
        cartItem.productModel ||
        (cartItem.productType === 'casual'
          ? 'CasualProduct'
          : cartItem.productType === 'dtf'
          ? 'DTFProduct'
          : 'Product');

      const productTypeName =
        cartItem.productType ||
        (productModelName === 'CasualProduct'
          ? 'casual'
          : productModelName === 'DTFProduct'
          ? 'dtf'
          : 'custom');

      orderItems.push({
        product: cartItem.productId,
        productModel: productModelName,
        productType: productTypeName,
        productName: cartItem.productName,
        productSlug: cartItem.productSlug,
        productImage: cartItem.productImage,
        selectedColor: cartItem.selectedColor,
        selectedSize: cartItem.selectedSize,
        quantity: cartItem.quantity,
        price: cartItem.totalPrice,
        instruction: cartItem.instruction,
        dtfPrintFile: productTypeName === 'dtf' ? cartItem.dtfPrintFile : undefined,
        customDesign: isCustom
          ? {
              frontDesign,
              backDesign,
              selectedColor: cartItem.selectedColor,
              selectedSize: cartItem.selectedSize,
            }
          : undefined,
      });
    }
    
    // Calculate subtotal
    const subtotal = user.cart.reduce((sum, item) => sum + (item.totalPrice * item.quantity), 0);
    
    // Handle coupon if provided
    let finalDiscountAmount = 0;
    let couponData = null;
    let couponDoc = null;
    
    if (couponCode && discountAmount) {
      // Validate coupon one more time before creating order
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase().trim(), isActive: true });
      
      if (coupon) {
        const now = new Date();
        if (now >= coupon.validFrom && now <= coupon.validTo) {
          if (subtotal >= coupon.minPurchase) {
            if (coupon.usageLimit === null || coupon.usedCount < coupon.usageLimit) {
              // Apply discount
              finalDiscountAmount = Math.min(discountAmount, subtotal); // Ensure discount doesn't exceed subtotal
              couponData = {
                code: coupon.code,
                discountAmount: finalDiscountAmount,
              };
              couponDoc = coupon;
            }
          }
        }
      }
    }
    
    // Calculate shipping cost (convert to cents if needed, or use as-is if already in cents)
    const shippingCostInCents = shippingCost ? (shippingCost < 100 ? Math.round(shippingCost * 100) : shippingCost) : 0;
    
    // Calculate final total (subtotal - discount + shipping)
    const total = Math.max(0, subtotal - finalDiscountAmount + shippingCostInCents);
    
    // Prepare shared order data
    const baseOrderData = {
      user: req.user._id,
      items: orderItems,
      total,
      paymentMethod,
      shippingAddress,
      coupon: couponData,
      shippingCost: shippingCostInCents,
    };

    if (paymentMethod === 'square') {
      if (!isSquareConfigured()) {
        return res.status(500).json({ success: false, message: 'Square payments are not configured' });
      }

      const checkoutSession = await CheckoutSession.create({
        user: req.user._id,
        items: orderItems,
        subtotal,
        discountAmount: finalDiscountAmount,
        shippingCost: shippingCostInCents,
        total,
        paymentMethod: 'square',
        shippingAddress,
        shippingServiceCode: shippingServiceCode || null,
        shippingServiceName: shippingServiceName || null,
        coupon: couponData
          ? {
              id: couponDoc?._id,
              code: couponData.code,
              discountAmount: couponData.discountAmount,
            }
          : undefined,
      });

      const redirectBase = process.env.CLIENT_BASE_URL || 'http://localhost:8080';
      const redirectUrl = `${redirectBase.replace(/\/$/, '')}/payments/square-result?sessionId=${checkoutSession._id}`;

      try {
        const session = await createSquareCheckoutSession({
          order: { ...baseOrderData, _id: checkoutSession._id },
          user,
          shippingAddress,
          redirectUrl,
        });

        checkoutSession.payment = {
          status: 'pending',
          squareCheckoutId: session.checkoutId,
          squareOrderId: session.squareOrderId,
          checkoutUrl: session.checkoutUrl,
        };
        await checkoutSession.save();

        return res.status(201).json({
          success: true,
          data: {
            sessionId: checkoutSession._id,
            checkoutUrl: session.checkoutUrl,
          },
          squareSession: session,
        });
      } catch (squareErr) {
        console.error('[Orders] Square checkout creation failed:', squareErr);
        await checkoutSession.deleteOne();
        return res.status(502).json({
          success: false,
          message: squareErr?.message || 'Failed to initialize Square checkout',
        });
      }
    }

    // Cash on delivery flow - create order immediately
    const order = await Order.create({
      ...baseOrderData,
      payment: {
        provider: 'cod',
        status: 'pending',
      },
    });

    await incrementCouponUsage(couponDoc);

    // Clear user's cart after successful order for COD
    user.cart = [];
    await user.save();
    
    res.status(201).json({ success: true, data: order });
  } catch (error) {
    console.error('[Orders] createOrderFromCart failed:', error);
    res.status(500).json({ success: false, message: 'Failed to create order' });
  }
};

export const myOrders = async (req, res) => {
  const orders = await Order.find({ user: req.user._id })
    .populate('items.product')
    .sort({ createdAt: -1 });
  console.log('Orders being returned:', JSON.stringify(orders, null, 2));
  res.json({ success: true, data: orders });
};

export const listOrders = async (_req, res) => {
  const orders = await Order.find().populate('user', 'name email').populate('items.product').sort({ createdAt: -1 });
  res.json({ success: true, data: orders });
};

export const getOrderById = async (req, res) => {
  const { id } = req.params;
  const order = await Order.findById(id)
    .populate('user', 'name email phone')
    .populate('items.product', 'name slug price variants');
  
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  
  res.json({ success: true, data: order });
};

export const updateStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const order = await Order.findById(id);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  order.status = status || order.status;
  await order.save();
  res.json({ success: true, data: order });
};


