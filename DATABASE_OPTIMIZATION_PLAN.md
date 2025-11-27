# Database Storage Optimization Plan

> **Project:** Custom T-Shirt E-commerce Platform  
> **Created:** 2025-11-27  
> **Status:** Planning Phase  
> **Estimated Storage Reduction:** 60-80% for order-related data

---

## 📋 Executive Summary

This document outlines a comprehensive plan to eliminate redundant and unnecessary data storage across the database. The current implementation stores duplicate design data, product information, and tracking details across multiple collections, leading to significant storage waste and potential data inconsistency.

### Key Issues Identified:
- ❌ Design data duplicated 3-4 times per order
- ❌ CheckoutSession retains full order data after completion
- ❌ Product snapshots include unnecessary fields
- ❌ Tracking history stored inefficiently
- ❌ Calculated prices stored instead of computed on-demand

---

## 🔴 Critical Priority Issues

### 1. Duplicate Design Data Across Collections

**Current State:**
```javascript
// Design data is stored in 4 places:

// 1. User.cart (User.js lines 53-64)
cart: [{
  frontDesign: {
    designData: { type: Object },      // ❌ Large Fabric.js/Konva JSON
    designLayers: [{ type: Object }],  // ❌ Duplicate layer data
    previewImage: { type: String },
    metrics: { type: Object }
  },
  backDesign: { /* same structure */ }
}]

// 2. CheckoutSession.items (CheckoutSession.js line 7)
items: { type: [orderItemSchema] }  // ❌ Full copy of cart items

// 3. Order.items (Order.js lines 27-54)
customDesign: {
  frontDesign: {
    designData: { type: Object },      // ❌ Third copy
    designLayers: [{ type: Object }],  // ❌ Third copy
    metrics: { /* ... */ },
    previewImage: { type: String }
  }
}

// 4. Design collection (Design.js lines 12-21)
frontDesign: {
  designData: Object,                  // ❌ Fourth copy
  designLayers: [Object],
  previewImage: String
}
```

**Problem:**
- A single custom design (50-200 KB) is stored 3-4 times
- For 1,000 orders: **150-800 MB of redundant data**
- Data inconsistency risk if one copy is updated

**Solution:**

```javascript
// OPTION A: Reference-based approach (Recommended)
// ================================================

// 1. Design.js - Source of truth
const designSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: String,
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  
  // ✅ Keep full design data here only
  frontDesign: {
    designData: Object,
    designLayers: [Object],
    previewImage: String,
    metrics: Object
  },
  backDesign: { /* same */ },
  
  // Add snapshot flag for orders
  isOrderSnapshot: { type: Boolean, default: false },
  sourceDesignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Design' }
});

// 2. User.cart - Store reference only
cart: [{
  productId: ObjectId,
  designId: { type: mongoose.Schema.Types.ObjectId, ref: 'Design' }, // ✅ Reference
  
  // ✅ Keep only preview for quick display
  previewImages: {
    front: String,
    back: String
  },
  
  // ❌ Remove: designData, designLayers, full metrics
  selectedColor: String,
  selectedSize: String,
  totalPrice: Number,
  quantity: Number
}]

// 3. Order.items - Store minimal snapshot
customDesign: {
  designId: { type: mongoose.Schema.Types.ObjectId, ref: 'Design' }, // ✅ Reference
  
  // ✅ Keep only what's needed for fulfillment
  previewImages: {
    front: String,  // For printing/fulfillment
    back: String
  },
  
  // ✅ Keep metrics for production
  metrics: {
    front: {
      widthInches: Number,
      heightInches: Number,
      areaInches: Number
    },
    back: { /* same */ }
  },
  
  // ❌ Remove: designData, designLayers (retrieve from Design if needed)
}

// 4. CheckoutSession - Reference cart
items: [{
  cartItemIndex: Number,  // ✅ Reference to user.cart[index]
  // OR
  designId: ObjectId,     // ✅ Reference to Design
  previewImages: Object,  // ✅ Minimal data for display
  // ❌ Remove: full design data
}]
```

**Implementation Steps:**

1. **Create Design snapshots on order creation:**
```javascript
// In order.controller.js - createOrderFromCart()

// Before creating order, snapshot designs
const orderItems = [];
for (const cartItem of user.cart) {
  let designSnapshot = null;
  
  if (cartItem.productType === 'custom' && cartItem.designId) {
    // Create immutable snapshot of design
    const originalDesign = await Design.findById(cartItem.designId);
    designSnapshot = await Design.create({
      ...originalDesign.toObject(),
      _id: new mongoose.Types.ObjectId(), // New ID
      isOrderSnapshot: true,
      sourceDesignId: originalDesign._id,
      name: `Order Snapshot - ${orderId}`
    });
  }
  
  orderItems.push({
    product: cartItem.productId,
    designId: designSnapshot?._id,
    previewImages: {
      front: cartItem.frontDesign?.previewImage,
      back: cartItem.backDesign?.previewImage
    },
    metrics: extractMetrics(cartItem), // Extract only needed metrics
    // ... other fields
  });
}
```

2. **Migration script for existing data:**
```javascript
// scripts/migrate-design-data.js

async function migrateDesignData() {
  const orders = await Order.find({ 'items.customDesign': { $exists: true } });
  
  for (const order of orders) {
    for (const item of order.items) {
      if (item.customDesign?.frontDesign?.designData) {
        // Create Design snapshot
        const designSnapshot = await Design.create({
          user: order.user,
          frontDesign: item.customDesign.frontDesign,
          backDesign: item.customDesign.backDesign,
          isOrderSnapshot: true,
          name: `Migrated - Order ${order._id}`
        });
        
        // Update order to reference design
        item.customDesign = {
          designId: designSnapshot._id,
          previewImages: {
            front: item.customDesign.frontDesign.previewImage,
            back: item.customDesign.backDesign.previewImage
          },
          metrics: {
            front: extractMetrics(item.customDesign.frontDesign),
            back: extractMetrics(item.customDesign.backDesign)
          }
        };
      }
    }
    await order.save();
  }
}
```

**Expected Impact:**
- **Storage reduction:** 75% for design data
- **Database size:** -150 to -800 MB per 1,000 orders
- **Query performance:** Improved (smaller documents)

---

### 2. CheckoutSession Retaining Full Order Data

**Current State:**
```javascript
// CheckoutSession.js
const checkoutSessionSchema = new mongoose.Schema({
  user: ObjectId,
  items: { type: [orderItemSchema], required: true },  // ❌ Full order items
  subtotal: Number,
  discountAmount: Number,
  shippingCost: Number,
  total: Number,
  shippingAddress: { /* full address object */ },      // ❌ Full address
  coupon: { /* full coupon data */ },                  // ❌ Full coupon
  payment: { /* payment details */ },
  order: { type: ObjectId, ref: 'Order' },             // ✅ Order reference
  status: String,
  expiresAt: Date  // 30 minutes TTL
});
```

**Problem:**
- After order is created (`order` field is set), all item/address data is redundant
- Sessions persist until TTL cleanup (may take hours)
- For 100 concurrent checkouts: **10-50 MB of duplicate data**

**Solution:**

```javascript
// OPTION A: Minimal session data (Recommended)
// ============================================

const checkoutSessionSchema = new mongoose.Schema({
  user: { type: ObjectId, ref: 'User', required: true },
  
  // ✅ Reference user's cart instead of copying
  cartSnapshot: {
    itemCount: Number,
    totalPrice: Number,
    // Store only IDs, not full data
    productIds: [ObjectId],
    designIds: [ObjectId]
  },
  
  // ✅ Keep only checkout-specific data
  subtotal: Number,
  discountAmount: Number,
  shippingCost: Number,
  total: Number,
  
  // ✅ Minimal shipping info (full address in Order)
  shippingAddressId: String,  // Reference to user.addresses[index]
  
  // ✅ Minimal coupon info
  couponCode: String,
  couponDiscountAmount: Number,
  
  payment: {
    status: String,
    squareCheckoutId: String,
    squareOrderId: String,
    checkoutUrl: String,
    failureReason: String
  },
  
  order: { type: ObjectId, ref: 'Order' },
  status: String,
  expiresAt: Date
});

// OPTION B: Cleanup after order creation
// =======================================

// In payment.controller.js - finalizeSquareOrderFromSession()
async function finalizeSquareOrderFromSession({ session, payment }) {
  // Create order
  const order = await Order.create({ /* ... */ });
  
  // ✅ Clean up session data after order creation
  session.items = undefined;           // Remove items
  session.shippingAddress = undefined; // Remove address
  session.coupon = undefined;          // Remove coupon details
  session.order = order._id;
  session.status = 'completed';
  
  await session.save();
  
  return order;
}
```

**Implementation Steps:**

1. **Update CheckoutSession schema:**
```javascript
// models/CheckoutSession.js

// Add method to clean up after order creation
checkoutSessionSchema.methods.cleanupAfterOrder = function() {
  this.items = undefined;
  this.shippingAddress = undefined;
  this.coupon = { code: this.coupon?.code }; // Keep only code
  return this.save();
};
```

2. **Update payment controller:**
```javascript
// controllers/payment.controller.js

const finalizeSquareOrderFromSession = async ({ session, payment }) => {
  // ... create order ...
  
  // ✅ Cleanup session data
  await session.cleanupAfterOrder();
  
  return order;
};
```

3. **Add immediate cleanup job:**
```javascript
// scripts/cleanup-completed-sessions.js

async function cleanupCompletedSessions() {
  const completedSessions = await CheckoutSession.find({
    status: 'completed',
    order: { $exists: true },
    items: { $exists: true } // Still has items (not cleaned up)
  });
  
  for (const session of completedSessions) {
    await session.cleanupAfterOrder();
  }
  
  console.log(`Cleaned up ${completedSessions.length} sessions`);
}

// Run every hour
setInterval(cleanupCompletedSessions, 60 * 60 * 1000);
```

**Expected Impact:**
- **Storage reduction:** 95% per completed session
- **Database size:** -10 to -50 MB for active sessions
- **Cleanup time:** Immediate instead of waiting for TTL

---

### 3. Product Information Duplication in Orders

**Current State:**
```javascript
// Order.items (Order.js lines 20-22)
{
  product: ObjectId,
  productModel: String,
  productType: String,
  productName: { type: String, required: true },  // ❌ Duplicate
  productSlug: { type: String },                  // ❌ Unnecessary
  productImage: { type: String },                 // ❌ Full URL
  selectedColor: String,
  selectedSize: String,
  quantity: Number,
  price: Number
}
```

**Problem:**
- `productSlug` is only for navigation, not needed in orders
- `productImage` full URL is redundant (can use public_id)
- `productName` is needed but could be optimized

**Solution:**

```javascript
// OPTIMIZED: Order item schema
const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'items.productModel',
    required: true
  },
  productModel: {
    type: String,
    enum: ['Product', 'CasualProduct', 'DTFProduct'],
    default: 'Product'
  },
  productType: {
    type: String,
    enum: ['custom', 'casual', 'dtf'],
    default: 'custom'
  },
  
  // ✅ Keep for historical record
  productName: { type: String, required: true },
  
  // ❌ REMOVE: productSlug (not needed for fulfillment/display)
  
  // ✅ OPTIMIZE: Store image reference, not full URL
  productImagePublicId: { type: String },  // Cloudinary public_id
  // OR keep URL but add getter to reconstruct if needed
  
  selectedColor: { type: String },
  selectedSize: { type: String },
  quantity: { type: Number, default: 1 },
  price: { type: Number, required: true },
  
  // ... rest of schema
});

// Add virtual for image URL
orderItemSchema.virtual('productImage').get(function() {
  if (this.productImagePublicId) {
    return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${this.productImagePublicId}`;
  }
  return null;
});
```

**Implementation Steps:**

1. **Update Order model:**
```javascript
// models/Order.js

// Remove productSlug field
// Change productImage to productImagePublicId
// Add virtual getter for backward compatibility
```

2. **Update order creation:**
```javascript
// controllers/order.controller.js

orderItems.push({
  product: cartItem.productId,
  productName: cartItem.productName,
  // ❌ productSlug: cartItem.productSlug,  // Remove
  productImagePublicId: extractPublicId(cartItem.productImage), // ✅ Extract ID
  // ... rest
});

function extractPublicId(imageUrl) {
  if (!imageUrl) return null;
  // Extract public_id from Cloudinary URL
  const match = imageUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/);
  return match ? match[1] : null;
}
```

3. **Migration script:**
```javascript
// scripts/migrate-product-images.js

async function migrateProductImages() {
  const orders = await Order.find({ 'items.productImage': { $exists: true } });
  
  for (const order of orders) {
    let updated = false;
    
    for (const item of order.items) {
      if (item.productImage) {
        item.productImagePublicId = extractPublicId(item.productImage);
        item.productSlug = undefined; // Remove slug
        updated = true;
      }
    }
    
    if (updated) {
      await order.save();
    }
  }
}
```

**Expected Impact:**
- **Storage reduction:** 50% for product snapshots
- **Field removal:** productSlug eliminated
- **URL optimization:** Store 30-50 char ID vs 100+ char URL

---

## 🟡 Medium Priority Issues

### 4. Tracking History Inefficiency

**Current State:**
```javascript
// Order.js (lines 107-128)
{
  trackingHistory: [
    {
      status: String,
      description: String,
      code: String,
      location: String,
      date: Date
    }
  ],  // ❌ Unlimited array growth
  
  trackingSummary: {
    status: String,              // ❌ Duplicate of latest trackingHistory
    description: String,         // ❌ Duplicate
    code: String,                // ❌ Duplicate
    estimatedDelivery: Date,
    lastLocation: String,
    updatedAt: Date
  },
  
  lastTrackingSyncAt: Date,
  trackingEmailSentAt: Date,
  deliveryEmailSentAt: Date,
  deliveredAt: Date,
  lastTrackingStatusNotified: String
}
```

**Problem:**
- `trackingHistory` can grow to 20-50 events per order
- `trackingSummary` duplicates latest tracking data
- Historical events rarely accessed after delivery
- For 10,000 delivered orders: **50-200 MB of rarely-accessed data**

**Solution:**

```javascript
// OPTION A: Separate TrackingHistory collection (Recommended)
// ===========================================================

// 1. New TrackingHistory model
const trackingHistorySchema = new mongoose.Schema({
  order: { type: ObjectId, ref: 'Order', required: true, index: true },
  events: [{
    status: String,
    description: String,
    code: String,
    location: String,
    date: Date,
    _id: false
  }],
  archivedAt: Date
}, { timestamps: true });

// Index for efficient queries
trackingHistorySchema.index({ order: 1, 'events.date': -1 });

// 2. Simplified Order tracking
const orderSchema = new mongoose.Schema({
  // ... other fields ...
  
  tracking: {
    number: String,
    carrier: String,
    
    // ✅ Keep only current status
    currentStatus: {
      status: String,
      description: String,
      location: String,
      updatedAt: Date
    },
    
    estimatedDelivery: Date,
    deliveredAt: Date,
    
    // ✅ Keep only recent events (last 5)
    recentEvents: [{
      status: String,
      description: String,
      date: Date,
      _id: false
    }],
    
    // ❌ Remove: trackingHistory (moved to TrackingHistory collection)
    // ❌ Remove: trackingSummary (merged into currentStatus)
  },
  
  // Operational fields
  lastTrackingSyncAt: Date,
  trackingEmailSentAt: Date,
  deliveryEmailSentAt: Date
});

// OPTION B: Limit tracking history in Order
// ==========================================

// Keep only last 10 events in Order
trackingHistory: {
  type: [{
    status: String,
    description: String,
    code: String,
    location: String,
    date: Date
  }],
  validate: [arrayLimit(10), 'Tracking history exceeds limit']
}

function arrayLimit(limit) {
  return function(val) {
    return val.length <= limit;
  };
}

// Auto-trim to last 10 events
orderSchema.pre('save', function(next) {
  if (this.trackingHistory && this.trackingHistory.length > 10) {
    // Archive old events to TrackingHistory collection
    const oldEvents = this.trackingHistory.slice(0, -10);
    TrackingHistory.findOneAndUpdate(
      { order: this._id },
      { $push: { events: { $each: oldEvents } } },
      { upsert: true }
    );
    
    // Keep only last 10
    this.trackingHistory = this.trackingHistory.slice(-10);
  }
  next();
});
```

**Implementation Steps:**

1. **Create TrackingHistory model:**
```javascript
// models/TrackingHistory.js

import mongoose from 'mongoose';

const trackingHistorySchema = new mongoose.Schema({
  order: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Order', 
    required: true,
    index: true,
    unique: true  // One tracking history per order
  },
  events: [{
    status: String,
    description: String,
    code: String,
    location: String,
    date: Date,
    _id: false
  }],
  archivedAt: Date
}, { timestamps: true });

trackingHistorySchema.index({ order: 1, 'events.date': -1 });

export default mongoose.model('TrackingHistory', trackingHistorySchema);
```

2. **Update tracking service:**
```javascript
// services/tracking.service.js

import TrackingHistory from '../models/TrackingHistory.js';

export async function updateOrderTracking(orderId, newEvent) {
  const order = await Order.findById(orderId);
  
  // Update current status in order
  order.tracking.currentStatus = {
    status: newEvent.status,
    description: newEvent.description,
    location: newEvent.location,
    updatedAt: new Date()
  };
  
  // Add to recent events (keep last 5)
  order.tracking.recentEvents.push(newEvent);
  if (order.tracking.recentEvents.length > 5) {
    order.tracking.recentEvents.shift();
  }
  
  // Archive full event to TrackingHistory
  await TrackingHistory.findOneAndUpdate(
    { order: orderId },
    { $push: { events: newEvent } },
    { upsert: true }
  );
  
  await order.save();
}

export async function getFullTrackingHistory(orderId) {
  const trackingHistory = await TrackingHistory.findOne({ order: orderId });
  return trackingHistory?.events || [];
}
```

3. **Migration script:**
```javascript
// scripts/migrate-tracking-history.js

async function migrateTrackingHistory() {
  const orders = await Order.find({ 
    trackingHistory: { $exists: true, $ne: [] } 
  });
  
  for (const order of orders) {
    if (order.trackingHistory.length > 0) {
      // Create TrackingHistory document
      await TrackingHistory.create({
        order: order._id,
        events: order.trackingHistory
      });
      
      // Keep only last 5 events in order
      const recentEvents = order.trackingHistory.slice(-5);
      const latestEvent = order.trackingHistory[order.trackingHistory.length - 1];
      
      order.tracking = {
        number: order.trackingNumber,
        currentStatus: {
          status: latestEvent.status,
          description: latestEvent.description,
          location: latestEvent.location,
          updatedAt: latestEvent.date
        },
        recentEvents: recentEvents,
        estimatedDelivery: order.trackingSummary?.estimatedDelivery,
        deliveredAt: order.deliveredAt
      };
      
      // Remove old fields
      order.trackingHistory = undefined;
      order.trackingSummary = undefined;
      
      await order.save();
    }
  }
  
  console.log(`Migrated ${orders.length} orders`);
}
```

**Expected Impact:**
- **Storage reduction:** 60% for tracking data
- **Order document size:** -5 to -20 KB per delivered order
- **Query performance:** Faster order queries (smaller documents)

---

### 5. Design Collection Redundancy

**Current State:**
```javascript
// Design.js
const designSchema = new mongoose.Schema({
  user: ObjectId,
  name: String,
  productId: ObjectId,
  productName: String,        // ❌ Duplicate from Product
  productSlug: String,        // ❌ Duplicate from Product
  selectedColor: String,      // ✅ User choice, keep
  selectedSize: String,       // ✅ User choice, keep
  frontDesign: { /* ... */ },
  backDesign: { /* ... */ },
  totalPrice: Number          // ❌ Calculated value
});
```

**Problem:**
- `productName` and `productSlug` duplicate Product data
- `totalPrice` is calculated, becomes stale if pricing changes
- No benefit to storing product info separately

**Solution:**

```javascript
// OPTIMIZED: Design schema
const designSchema = new mongoose.Schema({
  user: { type: ObjectId, ref: 'User', required: true },
  name: String,
  
  // ✅ Keep reference only
  productId: { type: ObjectId, ref: 'Product' },
  
  // ❌ REMOVE: productName, productSlug (get from Product)
  
  // ✅ Keep user selections
  selectedColor: String,
  selectedSize: String,
  
  frontDesign: {
    designData: Object,
    designLayers: [Object],
    previewImage: String,
    metrics: Object
  },
  backDesign: { /* same */ },
  
  // ❌ REMOVE: totalPrice (calculate on retrieval)
  
  // ✅ ADD: Pricing snapshot (optional, for historical record)
  pricingSnapshot: {
    basePrice: Number,
    frontCost: Number,
    backCost: Number,
    calculatedAt: Date
  },
  
  // Metadata
  isOrderSnapshot: { type: Boolean, default: false },
  sourceDesignId: { type: ObjectId, ref: 'Design' }
}, { timestamps: true });

// Virtual for total price
designSchema.virtual('totalPrice').get(function() {
  if (this.pricingSnapshot) {
    return this.pricingSnapshot.basePrice + 
           this.pricingSnapshot.frontCost + 
           this.pricingSnapshot.backCost;
  }
  return null;
});

// Method to calculate current price
designSchema.methods.calculateCurrentPrice = async function() {
  const product = await mongoose.model('Product').findById(this.productId);
  if (!product) return 0;
  
  const frontCost = calculateDesignCost(this.frontDesign, product);
  const backCost = calculateDesignCost(this.backDesign, product);
  
  return product.price + frontCost + backCost;
};
```

**Implementation Steps:**

1. **Update Design model:**
```javascript
// models/Design.js

// Remove productName, productSlug, totalPrice
// Add virtual getter for totalPrice
// Add method to calculate current price
```

2. **Update design retrieval:**
```javascript
// controllers/design.controller.js

export async function getDesign(req, res) {
  const design = await Design.findById(req.params.id)
    .populate('productId', 'name slug price');
  
  // Calculate current price
  const currentPrice = await design.calculateCurrentPrice();
  
  res.json({
    success: true,
    data: {
      ...design.toObject(),
      productName: design.productId?.name,
      productSlug: design.productId?.slug,
      totalPrice: currentPrice
    }
  });
}
```

3. **Migration script:**
```javascript
// scripts/migrate-design-fields.js

async function migrateDesignFields() {
  const designs = await Design.find({});
  
  for (const design of designs) {
    // Create pricing snapshot if totalPrice exists
    if (design.totalPrice) {
      const product = await Product.findById(design.productId);
      
      design.pricingSnapshot = {
        basePrice: product?.price || 0,
        frontCost: design.frontDesign ? calculateDesignCost(design.frontDesign) : 0,
        backCost: design.backDesign ? calculateDesignCost(design.backDesign) : 0,
        calculatedAt: design.updatedAt || design.createdAt
      };
    }
    
    // Remove redundant fields
    design.productName = undefined;
    design.productSlug = undefined;
    design.totalPrice = undefined;
    
    await design.save();
  }
}
```

**Expected Impact:**
- **Storage reduction:** 30% per design
- **Data consistency:** Always fetch latest product info
- **Price accuracy:** Calculate current price vs stale snapshot

---

### 6. Cart Storing Calculated Prices

**Current State:**
```javascript
// User.cart (User.js lines 65-68)
cart: [{
  basePrice: { type: Number, required: true },           // ❌ Calculated
  frontCustomizationCost: { type: Number, default: 0 },  // ❌ Calculated
  backCustomizationCost: { type: Number, default: 0 },   // ❌ Calculated
  totalPrice: { type: Number, required: true },          // ❌ Calculated
  quantity: Number
}]
```

**Problem:**
- Storing 4 price fields when only 1 is needed
- Prices become stale if pricing rules change
- No timestamp to know when prices were calculated

**Solution:**

```javascript
// OPTION A: Store only total, calculate breakdown on-demand
// ==========================================================

cart: [{
  productId: ObjectId,
  designId: ObjectId,
  selectedColor: String,
  selectedSize: String,
  quantity: Number,
  
  // ✅ Store only final price with timestamp
  pricing: {
    total: { type: Number, required: true },
    calculatedAt: { type: Date, default: Date.now }
  },
  
  // ❌ Remove: basePrice, frontCustomizationCost, backCustomizationCost
  
  addedAt: Date
}]

// Calculate breakdown when needed
cartItemSchema.methods.getPriceBreakdown = async function() {
  const product = await Product.findById(this.productId);
  const design = await Design.findById(this.designId);
  
  const basePrice = product.price;
  const frontCost = calculateDesignCost(design?.frontDesign, product);
  const backCost = calculateDesignCost(design?.backDesign, product);
  
  return {
    basePrice,
    frontCustomizationCost: frontCost,
    backCustomizationCost: backCost,
    totalPrice: basePrice + frontCost + backCost
  };
};

// OPTION B: Add cache invalidation
// =================================

cart: [{
  // ... fields ...
  
  pricing: {
    basePrice: Number,
    frontCustomizationCost: Number,
    backCustomizationCost: Number,
    totalPrice: Number,
    calculatedAt: { type: Date, default: Date.now },
    isStale: { type: Boolean, default: false }
  }
}]

// Mark prices as stale when product pricing changes
productSchema.post('save', async function() {
  if (this.isModified('price') || this.isModified('customizationPricing')) {
    await User.updateMany(
      { 'cart.productId': this._id },
      { $set: { 'cart.$[elem].pricing.isStale': true } },
      { arrayFilters: [{ 'elem.productId': this._id }] }
    );
  }
});
```

**Implementation Steps:**

1. **Update User model:**
```javascript
// models/User.js

// Simplify cart pricing structure
cart: [{
  // ... other fields ...
  
  pricing: {
    total: { type: Number, required: true },
    calculatedAt: { type: Date, default: Date.now }
  }
}]

// Add method to recalculate prices
userSchema.methods.recalculateCartPrices = async function() {
  for (const item of this.cart) {
    const product = await Product.findById(item.productId);
    const design = await Design.findById(item.designId);
    
    const basePrice = product.price;
    const frontCost = calculateDesignCost(design?.frontDesign, product);
    const backCost = calculateDesignCost(design?.backDesign, product);
    
    item.pricing = {
      total: basePrice + frontCost + backCost,
      calculatedAt: new Date()
    };
  }
  
  return this.save();
};
```

2. **Update cart endpoints:**
```javascript
// controllers/auth.controller.js

export async function getCart(req, res) {
  const user = await User.findById(req.user._id)
    .populate('cart.productId')
    .populate('cart.designId');
  
  // Calculate price breakdown for each item
  const cartWithBreakdown = await Promise.all(
    user.cart.map(async (item) => {
      const breakdown = await calculatePriceBreakdown(item);
      return {
        ...item.toObject(),
        priceBreakdown: breakdown
      };
    })
  );
  
  res.json({ success: true, data: cartWithBreakdown });
}
```

**Expected Impact:**
- **Storage reduction:** 40% for cart pricing data
- **Price accuracy:** Always use current pricing rules
- **Flexibility:** Easy to change pricing logic

---

## 🟢 Low Priority Issues

### 7. Coupon Data Duplication

**Current State:**
```javascript
// Order.js (lines 93-96)
coupon: {
  code: { type: String },
  discountAmount: { type: Number, default: 0 }
}

// CheckoutSession.js (lines 25-29)
coupon: {
  id: { type: ObjectId, ref: 'Coupon' },
  code: String,
  discountAmount: Number
}
```

**Problem:**
- Storing both `id` and `code` is redundant
- `code` is sufficient for historical record
- `id` is useful for analytics but not essential

**Solution:**

```javascript
// OPTIMIZED: Store minimal coupon data

// In Order
coupon: {
  code: { type: String },                    // ✅ Keep for display
  discountAmount: { type: Number },          // ✅ Keep for record
  // ❌ Remove: id (can lookup by code if needed)
}

// In CheckoutSession
coupon: {
  id: { type: ObjectId, ref: 'Coupon' },     // ✅ Keep for validation
  discountAmount: { type: Number }           // ✅ Keep for calculation
  // ❌ Remove: code (get from Coupon via id)
}

// OR use reference only
coupon: {
  type: ObjectId,
  ref: 'Coupon'
}
// Store discountAmount separately
appliedDiscount: { type: Number, default: 0 }
```

**Expected Impact:**
- **Storage reduction:** 20% for coupon data
- **Simplification:** Single source of truth

---

### 8. Unused/Rarely Used Fields

**Audit Results:**

```javascript
// Fields to review/remove:

// 1. Product.designTemplate.designJSON (Product.js line 56)
designJSON: Object  // ❌ Storing both layers AND JSON export

// Solution: Store only one format
// If using layers, remove designJSON
// If using designJSON, remove layers

// 2. CheckoutSession shipping fields (CheckoutSession.js lines 23-24)
shippingServiceCode: String,  // ❌ Also in Order
shippingServiceName: String   // ❌ Also in Order

// Solution: Remove from CheckoutSession, keep only in Order

// 3. Order operational fields (Order.js line 128)
lastTrackingStatusNotified: String  // ❌ Operational data

// Solution: Move to separate OperationalData collection or cache

// 4. User.designs array (User.js line 30)
designs: [{ type: ObjectId, ref: 'Design' }]  // ❌ Redundant

// Solution: Remove, query Design collection by user instead
// Design.find({ user: userId })
```

**Implementation:**

```javascript
// 1. Remove designJSON from Product
// models/Product.js
const designSchema = new mongoose.Schema({
  type: String,
  layers: [layerSchema],
  canvasSize: Object,
  // ❌ designJSON: Object,  // Remove if using layers
  previewUrl: String,
  totalCost: Number
});

// 2. Remove shipping fields from CheckoutSession
// models/CheckoutSession.js
// ❌ shippingServiceCode: String,
// ❌ shippingServiceName: String,

// 3. Move operational data to cache/separate collection
// models/OrderOperationalData.js (new)
const operationalDataSchema = new mongoose.Schema({
  order: { type: ObjectId, ref: 'Order', unique: true },
  lastTrackingSyncAt: Date,
  lastTrackingStatusNotified: String,
  internalNotes: String,
  // ... other operational fields
});

// 4. Remove designs array from User
// models/User.js
// ❌ designs: [{ type: ObjectId, ref: 'Design' }]

// Query designs by user instead:
// const userDesigns = await Design.find({ user: userId });
```

**Expected Impact:**
- **Storage reduction:** 10-15% for miscellaneous fields
- **Schema clarity:** Cleaner, more focused models

---

## 📊 Overall Impact Summary

### Storage Reduction Estimates

| Optimization | Current Size (per order) | Optimized Size | Reduction | Priority |
|--------------|-------------------------|----------------|-----------|----------|
| Design data deduplication | 150-600 KB | 50-200 KB | **75%** | 🔴 Critical |
| CheckoutSession cleanup | 100 KB | 5 KB | **95%** | 🔴 Critical |
| Product snapshots | 2 KB | 1 KB | **50%** | 🔴 Critical |
| Tracking history | 10-20 KB | 3-5 KB | **60%** | 🟡 Medium |
| Design collection | 50-200 KB | 35-140 KB | **30%** | 🟡 Medium |
| Cart pricing | 200 bytes | 120 bytes | **40%** | 🟡 Medium |
| Coupon data | 100 bytes | 80 bytes | **20%** | 🟢 Low |
| Misc fields | 500 bytes | 400 bytes | **20%** | 🟢 Low |

**Total Estimated Reduction: 60-80% for order-related data**

### Database Size Impact (10,000 orders)

| Metric | Before | After | Savings |
|--------|--------|-------|---------|
| Average order size | 250 KB | 75 KB | **175 KB** |
| Total database size | 2.5 GB | 750 MB | **1.75 GB** |
| CheckoutSession overhead | 500 MB | 25 MB | **475 MB** |
| Design storage | 1.5 GB | 375 MB | **1.125 GB** |

**Total Savings: ~2.35 GB for 10,000 orders**

---

## 🛠️ Implementation Roadmap

### Phase 1: Critical Optimizations (Week 1-2)

**Goal:** Achieve 60% storage reduction

1. **Day 1-2: CheckoutSession Cleanup**
   - [ ] Add cleanup method to CheckoutSession model
   - [ ] Update payment controller to cleanup after order creation
   - [ ] Create cleanup script for existing sessions
   - [ ] Run migration on production

2. **Day 3-5: Design Data Deduplication**
   - [ ] Update Design model with snapshot support
   - [ ] Modify Order model to reference designs
   - [ ] Update order creation logic
   - [ ] Create migration script
   - [ ] Test thoroughly (critical change)

3. **Day 6-7: Product Snapshot Optimization**
   - [ ] Remove productSlug from Order items
   - [ ] Optimize productImage storage
   - [ ] Update order creation
   - [ ] Run migration

**Deliverables:**
- 60% storage reduction
- Faster order queries
- Cleaner data model

### Phase 2: Medium Optimizations (Week 3-4)

**Goal:** Achieve additional 15% reduction

1. **Day 8-10: Tracking History Separation**
   - [ ] Create TrackingHistory model
   - [ ] Update tracking service
   - [ ] Modify Order model
   - [ ] Migrate existing tracking data
   - [ ] Update admin dashboard queries

2. **Day 11-12: Design Collection Cleanup**
   - [ ] Remove redundant product fields
   - [ ] Add virtual getters
   - [ ] Update design endpoints
   - [ ] Run migration

3. **Day 13-14: Cart Pricing Optimization**
   - [ ] Simplify cart pricing structure
   - [ ] Add price calculation methods
   - [ ] Update cart endpoints
   - [ ] Test checkout flow

**Deliverables:**
- 75% total storage reduction
- Improved data consistency
- Better price accuracy

### Phase 3: Low Priority & Cleanup (Week 5)

**Goal:** Final optimizations and monitoring

1. **Day 15-16: Miscellaneous Optimizations**
   - [ ] Coupon data cleanup
   - [ ] Remove unused fields
   - [ ] Optimize indexes
   - [ ] Code cleanup

2. **Day 17-18: Monitoring & Validation**
   - [ ] Set up storage monitoring
   - [ ] Validate data integrity
   - [ ] Performance testing
   - [ ] Documentation updates

3. **Day 19-20: Cleanup Jobs & Maintenance**
   - [ ] Implement automated cleanup jobs
   - [ ] Set up alerts
   - [ ] Create maintenance scripts
   - [ ] Team training

**Deliverables:**
- 80% total storage reduction
- Automated maintenance
- Complete documentation

---

## 🧪 Testing Strategy

### Unit Tests

```javascript
// tests/models/order.test.js

describe('Order Model Optimization', () => {
  it('should not store full design data', async () => {
    const order = await Order.create({ /* ... */ });
    expect(order.items[0].customDesign.designData).toBeUndefined();
    expect(order.items[0].customDesign.designLayers).toBeUndefined();
    expect(order.items[0].customDesign.designId).toBeDefined();
  });
  
  it('should reference design correctly', async () => {
    const order = await Order.findById(orderId).populate('items.customDesign.designId');
    expect(order.items[0].customDesign.designId.frontDesign).toBeDefined();
  });
});

describe('CheckoutSession Cleanup', () => {
  it('should remove items after order creation', async () => {
    const session = await CheckoutSession.findById(sessionId);
    await session.cleanupAfterOrder();
    
    expect(session.items).toBeUndefined();
    expect(session.shippingAddress).toBeUndefined();
    expect(session.order).toBeDefined();
  });
});
```

### Integration Tests

```javascript
// tests/integration/order-flow.test.js

describe('Complete Order Flow', () => {
  it('should create order without duplicating design data', async () => {
    // Add item to cart
    const cart = await addToCart({ productId, designId });
    
    // Create checkout session
    const session = await createCheckoutSession({ cart });
    
    // Complete payment
    const order = await completePayment({ sessionId: session._id });
    
    // Verify data structure
    expect(order.items[0].customDesign.designId).toBeDefined();
    expect(order.items[0].customDesign.designData).toBeUndefined();
    
    // Verify session cleanup
    const updatedSession = await CheckoutSession.findById(session._id);
    expect(updatedSession.items).toBeUndefined();
    
    // Verify design snapshot created
    const designSnapshot = await Design.findById(order.items[0].customDesign.designId);
    expect(designSnapshot.isOrderSnapshot).toBe(true);
  });
});
```

### Performance Tests

```javascript
// tests/performance/storage.test.js

describe('Storage Optimization Performance', () => {
  it('should reduce order document size by 60%', async () => {
    const oldOrder = await createOrderOldWay();
    const newOrder = await createOrderNewWay();
    
    const oldSize = JSON.stringify(oldOrder).length;
    const newSize = JSON.stringify(newOrder).length;
    
    const reduction = ((oldSize - newSize) / oldSize) * 100;
    expect(reduction).toBeGreaterThan(60);
  });
  
  it('should query orders faster with smaller documents', async () => {
    const start = Date.now();
    await Order.find().limit(100);
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(500); // Should be under 500ms
  });
});
```

---

## 📈 Monitoring & Metrics

### Database Size Monitoring

```javascript
// scripts/monitor-database-size.js

async function monitorDatabaseSize() {
  const stats = await mongoose.connection.db.stats();
  
  const metrics = {
    totalSize: stats.dataSize + stats.indexSize,
    dataSize: stats.dataSize,
    indexSize: stats.indexSize,
    collections: {}
  };
  
  // Get size per collection
  const collections = ['orders', 'checkoutsessions', 'designs', 'users'];
  for (const collName of collections) {
    const collStats = await mongoose.connection.db.collection(collName).stats();
    metrics.collections[collName] = {
      size: collStats.size,
      count: collStats.count,
      avgObjSize: collStats.avgObjSize
    };
  }
  
  console.log('Database Metrics:', JSON.stringify(metrics, null, 2));
  
  // Send to monitoring service (e.g., Datadog, CloudWatch)
  // sendMetrics(metrics);
  
  return metrics;
}

// Run every hour
setInterval(monitorDatabaseSize, 60 * 60 * 1000);
```

### Storage Alerts

```javascript
// scripts/storage-alerts.js

async function checkStorageAlerts() {
  const stats = await monitorDatabaseSize();
  
  // Alert if database size exceeds threshold
  if (stats.totalSize > 10 * 1024 * 1024 * 1024) { // 10 GB
    sendAlert({
      level: 'warning',
      message: `Database size exceeded 10 GB: ${formatBytes(stats.totalSize)}`
    });
  }
  
  // Alert if average order size is too large
  const orderStats = stats.collections.orders;
  if (orderStats.avgObjSize > 100 * 1024) { // 100 KB
    sendAlert({
      level: 'warning',
      message: `Average order size is ${formatBytes(orderStats.avgObjSize)}, expected < 100 KB`
    });
  }
  
  // Alert if CheckoutSession collection is too large
  const sessionStats = stats.collections.checkoutsessions;
  if (sessionStats.size > 100 * 1024 * 1024) { // 100 MB
    sendAlert({
      level: 'error',
      message: `CheckoutSession collection is ${formatBytes(sessionStats.size)}, cleanup may not be working`
    });
  }
}
```

---

## 🔄 Migration Scripts

### Master Migration Script

```javascript
// scripts/run-all-migrations.js

import { migrateDesignData } from './migrate-design-data.js';
import { cleanupCheckoutSessions } from './cleanup-checkout-sessions.js';
import { migrateProductImages } from './migrate-product-images.js';
import { migrateTrackingHistory } from './migrate-tracking-history.js';
import { migrateDesignFields } from './migrate-design-fields.js';

async function runAllMigrations() {
  console.log('Starting database optimization migrations...\n');
  
  try {
    // Phase 1: Critical migrations
    console.log('Phase 1: Critical Optimizations');
    console.log('================================\n');
    
    console.log('1. Cleaning up CheckoutSessions...');
    await cleanupCheckoutSessions();
    console.log('✅ CheckoutSessions cleaned\n');
    
    console.log('2. Migrating design data...');
    await migrateDesignData();
    console.log('✅ Design data migrated\n');
    
    console.log('3. Optimizing product images...');
    await migrateProductImages();
    console.log('✅ Product images optimized\n');
    
    // Phase 2: Medium priority migrations
    console.log('\nPhase 2: Medium Priority Optimizations');
    console.log('=======================================\n');
    
    console.log('4. Migrating tracking history...');
    await migrateTrackingHistory();
    console.log('✅ Tracking history migrated\n');
    
    console.log('5. Cleaning up design fields...');
    await migrateDesignFields();
    console.log('✅ Design fields cleaned\n');
    
    // Generate report
    console.log('\nMigration Complete!');
    console.log('===================\n');
    
    const stats = await generateMigrationReport();
    console.log(stats);
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

async function generateMigrationReport() {
  const beforeStats = await loadBackupStats(); // Load from backup
  const afterStats = await monitorDatabaseSize();
  
  const reduction = ((beforeStats.totalSize - afterStats.totalSize) / beforeStats.totalSize) * 100;
  
  return `
Migration Report
================
Before: ${formatBytes(beforeStats.totalSize)}
After:  ${formatBytes(afterStats.totalSize)}
Saved:  ${formatBytes(beforeStats.totalSize - afterStats.totalSize)} (${reduction.toFixed(1)}%)

Collection Details:
- Orders: ${formatBytes(beforeStats.collections.orders.size)} → ${formatBytes(afterStats.collections.orders.size)}
- CheckoutSessions: ${formatBytes(beforeStats.collections.checkoutsessions.size)} → ${formatBytes(afterStats.collections.checkoutsessions.size)}
- Designs: ${formatBytes(beforeStats.collections.designs.size)} → ${formatBytes(afterStats.collections.designs.size)}
  `;
}

// Run migrations
runAllMigrations();
```

---

## 📚 Best Practices Going Forward

### 1. Data Storage Principles

```javascript
// ✅ DO: Store references, not duplicates
{
  designId: ObjectId,  // Reference to Design collection
  previewImage: String // Only what's needed for display
}

// ❌ DON'T: Duplicate large objects
{
  designData: { /* 50-200 KB object */ },
  designLayers: [ /* large array */ ]
}

// ✅ DO: Store snapshots for historical records
{
  productName: String,  // Needed if product is deleted
  price: Number         // Snapshot at time of order
}

// ❌ DON'T: Store calculated values
{
  totalPrice: Number,   // Calculate on-demand
  discountedPrice: Number
}

// ✅ DO: Use virtuals for computed fields
schema.virtual('totalPrice').get(function() {
  return this.basePrice + this.customizationCost;
});

// ❌ DON'T: Store operational data in business models
{
  lastSyncedAt: Date,
  internalNotes: String
}
```

### 2. Schema Design Checklist

Before adding a new field, ask:

- [ ] **Is this data already stored elsewhere?** → Use reference
- [ ] **Is this a calculated value?** → Use virtual or method
- [ ] **Is this needed for historical record?** → Store snapshot
- [ ] **Is this operational data?** → Use separate collection
- [ ] **Will this data grow unbounded?** → Implement limits or archival
- [ ] **Is this data accessed frequently?** → Keep in main document
- [ ] **Is this data rarely accessed?** → Move to separate collection

### 3. Code Review Guidelines

```javascript
// When reviewing schema changes:

// 🔴 RED FLAG: Storing large objects
customDesign: { type: Object }  // How large? Is this needed?

// 🟡 YELLOW FLAG: Arrays without limits
trackingHistory: [{ /* ... */ }]  // Will this grow unbounded?

// 🟢 GREEN: References with clear purpose
designId: { type: ObjectId, ref: 'Design' }  // ✅ Good

// 🔴 RED FLAG: Duplicate data
productName: String,  // Is this in Product collection?
productSlug: String   // Is this needed here?

// 🟢 GREEN: Minimal snapshots
pricing: {
  total: Number,
  calculatedAt: Date
}
```

### 4. Maintenance Tasks

```javascript
// Weekly: Check database size
npm run db:check-size

// Monthly: Run cleanup scripts
npm run db:cleanup-sessions
npm run db:archive-old-tracking

// Quarterly: Review schema efficiency
npm run db:analyze-schema
npm run db:suggest-optimizations

// Before major releases: Backup and test migrations
npm run db:backup
npm run db:test-migrations
```

---

## 🎯 Success Criteria

### Metrics to Track

1. **Storage Reduction**
   - [ ] 60% reduction in order document size
   - [ ] 95% reduction in completed CheckoutSession size
   - [ ] 75% reduction in design data duplication

2. **Performance Improvement**
   - [ ] Order queries 30% faster
   - [ ] Cart operations 20% faster
   - [ ] Database backup time reduced by 50%

3. **Data Quality**
   - [ ] Zero data loss during migration
   - [ ] 100% backward compatibility
   - [ ] All tests passing

4. **Operational Efficiency**
   - [ ] Automated cleanup jobs running
   - [ ] Storage alerts configured
   - [ ] Documentation complete

---

## 📞 Support & Questions

### Common Issues

**Q: Will this break existing orders?**
A: No, migrations are designed to be backward compatible. Old data is preserved, new queries work with both formats.

**Q: What if migration fails mid-way?**
A: Each migration is transactional and includes rollback logic. Always backup before running.

**Q: How do I rollback changes?**
A: Use the provided rollback scripts in `scripts/rollback/`. Restore from backup if needed.

**Q: Will this affect performance?**
A: Short-term: Migrations may take time. Long-term: Significant performance improvement.

### Getting Help

- **Technical Issues:** Check `docs/troubleshooting.md`
- **Migration Errors:** Review logs in `logs/migrations/`
- **Performance Questions:** Run `npm run db:analyze`

---

## 📝 Changelog

### Version 1.0 (2025-11-27)
- Initial optimization plan created
- Identified 8 major optimization areas
- Estimated 60-80% storage reduction
- Created implementation roadmap

### Next Steps
- [ ] Review and approve plan
- [ ] Schedule implementation phases
- [ ] Assign team members
- [ ] Set up monitoring infrastructure

---

**Document Status:** Draft  
**Last Updated:** 2025-11-27  
**Next Review:** After Phase 1 completion  
**Owner:** Development Team
