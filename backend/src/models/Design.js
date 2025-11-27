import mongoose from 'mongoose';

const designSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: String,
    
    // ✅ Product reference (source of truth)
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    
    // ❌ Removed: productName, productSlug (get from Product via populate)
    // ❌ Removed: totalPrice (calculate on-demand)
    
    // ✅ User selections (keep - these are user choices)
    selectedColor: String,
    selectedSize: String,
    
    // ✅ Design data (source of truth)
    frontDesign: {
      designData: Object,
      designLayers: [Object],
      previewImage: String,
      metrics: {
        widthInches: Number,
        heightInches: Number,
        areaInches: Number,
        totalPixels: Number,
        perLayer: [mongoose.Schema.Types.Mixed]
      }
    },
    backDesign: {
      designData: Object,
      designLayers: [Object],
      previewImage: String,
      metrics: {
        widthInches: Number,
        heightInches: Number,
        areaInches: Number,
        totalPixels: Number,
        perLayer: [mongoose.Schema.Types.Mixed]
      }
    },
    
    // ✅ Snapshot metadata (for order snapshots)
    isOrderSnapshot: { type: Boolean, default: false },
    sourceDesignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Design' },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    
    // ✅ Pricing snapshot (optional, for historical record)
    pricingSnapshot: {
      basePrice: Number,
      frontCost: Number,
      backCost: Number,
      totalPrice: Number,
      calculatedAt: Date
    }
  },
  { timestamps: true }
);

// Index for efficient queries
designSchema.index({ user: 1, isOrderSnapshot: 1 });
designSchema.index({ orderId: 1 });

// Virtual for total price (calculate on-demand)
designSchema.virtual('totalPrice').get(function() {
  if (this.pricingSnapshot?.totalPrice) {
    return this.pricingSnapshot.totalPrice;
  }
  return null;
});

// Method to create order snapshot
designSchema.methods.createOrderSnapshot = async function(orderId) {
  const Design = mongoose.model('Design');
  
  const snapshot = await Design.create({
    user: this.user,
    name: `Order Snapshot - ${orderId}`,
    productId: this.productId,
    selectedColor: this.selectedColor,
    selectedSize: this.selectedSize,
    frontDesign: this.frontDesign,
    backDesign: this.backDesign,
    isOrderSnapshot: true,
    sourceDesignId: this._id,
    orderId: orderId,
    pricingSnapshot: this.pricingSnapshot
  });
  
  return snapshot;
};

export default mongoose.model('Design', designSchema);


