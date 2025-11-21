import mongoose from 'mongoose';

const dtfImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    public_id: { type: String, required: true },
  },
  { _id: false }
);

const dtfProductSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true },
    cost: { type: Number, required: true, min: 0 },
    image: { type: dtfImageSchema, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

dtfProductSchema.pre('validate', function ensureSlug(next) {
  if ((!this.slug || !this.slug.trim()) && this.title) {
    this.slug = this.title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  next();
});

export default mongoose.model('DTFProduct', dtfProductSchema);


