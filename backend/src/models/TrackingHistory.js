import mongoose from 'mongoose';

const trackingEventSchema = new mongoose.Schema({
  status: String,
  description: String,
  code: String,
  location: String,
  date: Date,
}, { _id: false });

const trackingHistorySchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    trackingNumber: { type: String, required: true },
    events: [trackingEventSchema],
    lastSyncAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Index for quick lookup by order
// trackingHistorySchema.index({ order: 1 }); // Already indexed by unique: true
trackingHistorySchema.index({ trackingNumber: 1 });

export default mongoose.model('TrackingHistory', trackingHistorySchema);
