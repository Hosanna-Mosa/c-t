import mongoose from 'mongoose';

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    public_id: { type: String, required: true },
    width: Number,
    height: Number,
    format: String,
  },
  { _id: false }
);

const casualProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    category: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    colors: [{ type: String, trim: true }],
    sizes: [{ type: String, trim: true }],
    images: { type: [imageSchema], default: [] },
    isActive: { type: Boolean, default: true },
    metadata: {
      material: { type: String, trim: true },
      fit: { type: String, trim: true },
      careInstructions: { type: String, trim: true },
    },
  },
  { timestamps: true }
);

casualProductSchema.index({ category: 1, isActive: 1 });
casualProductSchema.index({ name: 'text', description: 'text' });

casualProductSchema.pre('validate', function ensureSlug(next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  next();
});

export default mongoose.model('CasualProduct', casualProductSchema);

