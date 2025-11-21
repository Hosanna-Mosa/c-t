import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      match: /[^@ \t\r\n]+@[^@ \t\r\n]+\.[^@ \t\r\n]+/,
    },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    addresses: [
      {
        fullName: { type: String, required: true },
        phone: { type: String, required: true },
        line1: { type: String, required: true },
        line2: { type: String },
        city: { type: String, required: true },
        state: { type: String, required: true },
        postalCode: { type: String, required: true },
        country: { type: String, required: true },
        isDefault: { type: Boolean, default: false },
      },
    ],
    resetPasswordCode: { type: String },
    resetPasswordExpires: { type: Date },
    designs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Design' }],
    cart: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          refPath: 'productModel',
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
        productSlug: { type: String, required: true },
        productImage: { type: String },
        selectedColor: { type: String },
        selectedSize: { type: String },
        frontDesign: {
          designData: { type: Object },
          designLayers: [{ type: Object }],
          previewImage: { type: String },
          metrics: { type: Object }, // <-- store design metrics
        },
        backDesign: {
          designData: { type: Object },
          designLayers: [{ type: Object }],
          previewImage: { type: String },
          metrics: { type: Object }, // <-- store design metrics
        },
        basePrice: { type: Number, required: true },
        frontCustomizationCost: { type: Number, default: 0 },
        backCustomizationCost: { type: Number, default: 0 },
        totalPrice: { type: Number, required: true },
        quantity: { type: Number, default: 1 },
        instruction: { type: String },
        dtfPrintFile: {
          url: { type: String },
          publicId: { type: String },
          fileName: { type: String },
          preview: { type: String },
        },
        addedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);


