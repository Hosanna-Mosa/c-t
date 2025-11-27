import mongoose from 'mongoose';

//
// 📸 Image schema
//
const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    public_id: { type: String, required: true },
  },
  { _id: false }
);

//
// 🎨 Layer schema — for predefined or user-created design elements
//
const layerSchema = new mongoose.Schema(
  {
    layerType: { type: String, enum: ['text', 'image'], required: true },
    position: {
      x: { type: Number, required: true },
      y: { type: Number, required: true },
    },
    rotation: { type: Number, default: 0 },
    scale: { type: Number, default: 1 },
    zIndex: { type: Number, default: 0 },
    properties: {
      // For text layers
      content: String,
      fontFamily: String,
      fontSize: Number,
      fontWeight: String,
      color: String,
      textAlign: String,

      // For image layers
      imageUrl: String,
      opacity: Number,
      cost: { type: Number, default: 0 },
    },
  },
  { _id: false }
);

//
// 🧩 Design schema — represents a saved layout or template (Fabric.js/Konva JSON export)
//
const designSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['predefined', 'user'], default: 'predefined' },
    layers: [layerSchema],
    canvasSize: {
      width: { type: Number, default: 500 },
      height: { type: Number, default: 500 },
    },
    designJSON: Object, // optional Fabric.js/Konva JSON export
    previewUrl: String, // snapshot of full design
    totalCost: { type: Number, default: 0 },
  },
  { _id: false }
);

//
// 🧤 Variant schema — maps colors directly to image sets
//
const variantSchema = new mongoose.Schema(
  {
    color: { type: String, required: true }, // example: "Red"
    colorCode: { type: String },             // example: "#FF0000" (for UI color picker)
    images: { type: [imageSchema], default: [] }, // mockups for that color
    frontImages: { type: [imageSchema], default: [] }, // front-specific images
    backImages: { type: [imageSchema], default: [] },   // back-specific images
  },
  { _id: false }
);

//
// 🏷️ Main Product schema
//
const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: String,
    price: { type: Number, required: true },
    sizes: [{ type: String }],

    // 👇 Replaces old colors/images with color-image mapping
    variants: [variantSchema],

    stock: { type: Number, default: 0 },
    soldCount: { type: Number, default: 0 }, // Track total units sold

    // 👇 Customization fields
    customizable: { type: Boolean, default: false }, // enable/disable customization
    customizationType: {
      type: String,
      enum: ['predefined', 'own', 'both'],
      default: 'both',
    },

    // Base template (used for predefined designs)
    designTemplate: designSchema,

    // Optional future extension — customization pricing rules
    customizationPricing: {
      perTextLayer: { type: Number, default: 10 },
      perImageLayer: { type: Number, default: 20 },
      sizeMultiplier: { type: Number, default: 0.1 },
    },
  },
  { timestamps: true }
);

export default mongoose.model('Product', productSchema);
