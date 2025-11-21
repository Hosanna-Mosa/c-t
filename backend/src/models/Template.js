import mongoose from 'mongoose';

const templateSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    image: {
      url: { type: String, required: true },
      public_id: { type: String, required: true },
    },
  },
  { timestamps: true }
);

export default mongoose.model('Template', templateSchema);


