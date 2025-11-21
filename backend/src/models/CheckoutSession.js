import mongoose from 'mongoose';
import { orderItemSchema } from './Order.js';

const checkoutSessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true }, // dollars
    discountAmount: { type: Number, default: 0 }, // dollars
    shippingCost: { type: Number, default: 0 }, // cents
    total: { type: Number, required: true }, // cents
    paymentMethod: { type: String, enum: ['square'], required: true },
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
    shippingServiceCode: { type: String },
    shippingServiceName: { type: String },
    coupon: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' },
      code: String,
      discountAmount: Number,
    },
    payment: {
      status: { type: String, enum: ['pending', 'paid', 'failed', 'cancelled'], default: 'pending' },
      squareCheckoutId: String,
      squareOrderId: String,
      squarePaymentId: String,
      checkoutUrl: String,
      failureReason: String,
    },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    status: { type: String, enum: ['pending', 'completed', 'failed', 'expired'], default: 'pending' },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 1000 * 60 * 30), // 30 minutes
    },
  },
  { timestamps: true }
);

checkoutSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('CheckoutSession', checkoutSessionSchema);






