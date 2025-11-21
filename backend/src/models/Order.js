import mongoose from 'mongoose';

export const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'items.productModel',
      required: true,
    },
    productModel: {
      type: String,
      enum: ['Product', 'CasualProduct', 'DTFProduct'],
      default: 'Product',
    },
    productType: {
      type: String,
      enum: ['custom', 'casual', 'dtf'],
      default: 'custom',
    },
    productName: { type: String, required: true },
    productSlug: { type: String },
    productImage: { type: String },
    selectedColor: { type: String },
    selectedSize: { type: String },
    quantity: { type: Number, default: 1 },
    price: { type: Number, required: true }, // snapshot in cents
    customDesign: {
      frontDesign: {
        designData: { type: Object },
        designLayers: [{ type: Object }],
        metrics: {
          widthInches: Number,
          heightInches: Number,
          areaInches: Number,
          totalPixels: Number,
          // Accept either objects or strings (Mixed) to be tolerant of
          // different client payload shapes during order creation
          perLayer: [mongoose.Schema.Types.Mixed]
        },
        previewImage: { type: String },
      },
      backDesign: {
        designData: { type: Object },
        designLayers: [{ type: Object }],
        metrics: {
          widthInches: Number,
          heightInches: Number,
          areaInches: Number,
          totalPixels: Number,
          perLayer: [mongoose.Schema.Types.Mixed]
        },
        previewImage: { type: String },
      },
    },
    instruction: { type: String, trim: true },
    dtfPrintFile: {
      url: { type: String },
      publicId: { type: String },
      fileName: { type: String },
      preview: { type: String },
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: { type: [orderItemSchema], validate: v => v.length > 0 },
    total: { type: Number, required: true }, // in cents
    paymentMethod: { type: String, enum: ['cod', 'razorpay', 'square'], required: true },
    payment: {
      provider: { type: String, enum: ['cod', 'razorpay', 'square'], default: 'cod' },
      razorpayOrderId: String,
      razorpayPaymentId: String,
      razorpaySignature: String,
      squareCheckoutId: String,
      squareOrderId: String,
      squarePaymentId: String,
      checkoutUrl: String,
      failureReason: String,
      status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
    },
    shippingAddress: {
      fullName: String,
      phone: String,
      line1: String,
      line2: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },
    status: {
      type: String,
      enum: ['placed', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'placed',
    },
    coupon: {
      code: { type: String },
      discountAmount: { type: Number, default: 0 },
    },
    shippingCost: { type: Number, default: 0 }, // in cents
    trackingNumber: { type: String },
    labelUrl: { type: String },
    labelPublicId: { type: String },
    shipmentStatus: {
      type: String,
      enum: ['pending', 'label_generated', 'carrier_handoff', 'in_transit', 'delivered'],
      default: 'pending',
    },
    carrierHandoffAt: { type: Date },
    trackingHistory: [
      {
        status: String,
        description: String,
        code: String,
        location: String,
        date: Date,
      },
    ],
    trackingSummary: {
      status: String,
      description: String,
      code: String,
      estimatedDelivery: Date,
      lastLocation: String,
      updatedAt: Date,
    },
    lastTrackingSyncAt: { type: Date },
    trackingEmailSentAt: { type: Date },
    deliveryEmailSentAt: { type: Date },
    deliveredAt: { type: Date },
    lastTrackingStatusNotified: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model('Order', orderSchema);


