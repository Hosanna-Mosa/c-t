import mongoose from 'mongoose';

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    public_id: { type: String, required: true },
  },
  { _id: false }
);

const settingSchema = new mongoose.Schema(
  {
    homeBackground: { type: imageSchema, required: false },
    homePoster: { type: imageSchema, required: false },
    designBackground: { type: imageSchema, required: false },
    newsItems: { type: [String], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model('Setting', settingSchema);


