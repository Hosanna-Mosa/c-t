/**
 * Design Snapshot Service
 * 
 * Manages creation and retrieval of design snapshots for orders.
 * Design snapshots are immutable copies of designs that preserve
 * the exact state at the time of order creation.
 */

import Design from '../models/Design.js';
import mongoose from 'mongoose';

/**
 * Create a design snapshot from cart item data
 * Used when creating orders from cart items that have inline design data
 * 
 * @param {Object} cartItem - Cart item with design data
 * @param {String} orderId - Order ID for reference
 * @param {String} userId - User ID
 * @returns {Promise<Object>} Created design snapshot
 */
export async function createDesignSnapshotFromCartItem(cartItem, orderId, userId) {
  try {
    const hasDesign = cartItem.frontDesign || cartItem.backDesign;
    if (!hasDesign) {
      return null;
    }
    
    // Extract metrics in simplified format
    const extractMetrics = (design) => {
      if (!design?.metrics) return null;
      return {
        widthInches: design.metrics.widthInches,
        heightInches: design.metrics.heightInches,
        areaInches: design.metrics.areaInches,
        totalPixels: design.metrics.totalPixels,
        perLayer: design.metrics.perLayer
      };
    };
    
    const snapshot = await Design.create({
      user: userId,
      name: `Order ${orderId} - ${cartItem.productName}`,
      productId: cartItem.productId,
      selectedColor: cartItem.selectedColor,
      selectedSize: cartItem.selectedSize,
      
      frontDesign: cartItem.frontDesign ? {
        designData: cartItem.frontDesign.designData,
        designLayers: cartItem.frontDesign.designLayers,
        previewImage: cartItem.frontDesign.previewImage,
        metrics: extractMetrics(cartItem.frontDesign)
      } : undefined,
      
      backDesign: cartItem.backDesign ? {
        designData: cartItem.backDesign.designData,
        designLayers: cartItem.backDesign.designLayers,
        previewImage: cartItem.backDesign.previewImage,
        metrics: extractMetrics(cartItem.backDesign)
      } : undefined,
      
      isOrderSnapshot: true,
      orderId: orderId,
      
      pricingSnapshot: {
        basePrice: cartItem.basePrice,
        frontCost: cartItem.frontCustomizationCost || 0,
        backCost: cartItem.backCustomizationCost || 0,
        totalPrice: cartItem.totalPrice,
        calculatedAt: new Date()
      }
    });
    
    console.log('[DesignSnapshot] Created snapshot for order', { 
      snapshotId: snapshot._id, 
      orderId 
    });
    
    return snapshot;
  } catch (error) {
    console.error('[DesignSnapshot] Failed to create snapshot:', error);
    throw error;
  }
}

/**
 * Create optimized order item data using design snapshot
 * 
 * @param {Object} cartItem - Cart item data
 * @param {Object} designSnapshot - Created design snapshot
 * @returns {Object} Optimized custom design data for order
 */
export function createOptimizedCustomDesign(cartItem, designSnapshot) {
  if (!designSnapshot) {
    return undefined;
  }
  
  return {
    // ✅ Reference to design snapshot
    designSnapshotId: designSnapshot._id,
    
    // ✅ Preview images for quick display
    previewImages: {
      front: cartItem.frontDesign?.previewImage || designSnapshot.frontDesign?.previewImage,
      back: cartItem.backDesign?.previewImage || designSnapshot.backDesign?.previewImage
    },
    
    // ✅ Simplified metrics for production
    metrics: {
      front: cartItem.frontDesign?.metrics ? {
        widthInches: cartItem.frontDesign.metrics.widthInches,
        heightInches: cartItem.frontDesign.metrics.heightInches,
        areaInches: cartItem.frontDesign.metrics.areaInches
      } : null,
      back: cartItem.backDesign?.metrics ? {
        widthInches: cartItem.backDesign.metrics.widthInches,
        heightInches: cartItem.backDesign.metrics.heightInches,
        areaInches: cartItem.backDesign.metrics.areaInches
      } : null
    }
    
    // ❌ NOT storing: designData, designLayers (in Design snapshot)
  };
}

/**
 * Get full design data from order item
 * Handles both old format (inline data) and new format (snapshot reference)
 * 
 * @param {Object} orderItem - Order item
 * @returns {Promise<Object>} Full design data
 */
export async function getDesignDataFromOrderItem(orderItem) {
  // New format: has designSnapshotId
  if (orderItem.customDesign?.designSnapshotId) {
    const snapshot = await Design.findById(orderItem.customDesign.designSnapshotId);
    if (snapshot) {
      return {
        frontDesign: snapshot.frontDesign,
        backDesign: snapshot.backDesign,
        source: 'snapshot'
      };
    }
  }
  
  // Old format: has inline design data
  if (orderItem.customDesign?.frontDesign || orderItem.customDesign?.backDesign) {
    return {
      frontDesign: orderItem.customDesign.frontDesign,
      backDesign: orderItem.customDesign.backDesign,
      source: 'inline'
    };
  }
  
  return null;
}

/**
 * Populate design snapshots for order items
 * 
 * @param {Object} order - Order document
 * @returns {Promise<Object>} Order with populated design snapshots
 */
export async function populateDesignSnapshots(order) {
  if (!order.items) return order;
  
  for (const item of order.items) {
    if (item.customDesign?.designSnapshotId) {
      const snapshot = await Design.findById(item.customDesign.designSnapshotId);
      if (snapshot) {
        item.customDesign.designSnapshot = snapshot;
      }
    }
  }
  
  return order;
}

/**
 * Check if order uses new optimized format
 * 
 * @param {Object} order - Order document
 * @returns {Boolean} True if using optimized format
 */
export function isOptimizedOrder(order) {
  if (!order.items || order.items.length === 0) return false;
  
  const customItem = order.items.find(item => item.customDesign);
  if (!customItem) return false;
  
  return !!customItem.customDesign.designSnapshotId;
}

/**
 * Calculate storage savings for optimized order
 * 
 * @param {Object} order - Order document
 * @returns {Object} Storage metrics
 */
export function calculateStorageSavings(order) {
  let oldSize = 0;
  let newSize = 0;
  
  for (const item of order.items || []) {
    if (item.customDesign) {
      // Old format size (with inline design data)
      if (item.customDesign.frontDesign?.designData) {
        oldSize += JSON.stringify(item.customDesign.frontDesign).length;
      }
      if (item.customDesign.backDesign?.designData) {
        oldSize += JSON.stringify(item.customDesign.backDesign).length;
      }
      
      // New format size (just references and minimal data)
      if (item.customDesign.designSnapshotId) {
        newSize += 24; // ObjectId size
        newSize += JSON.stringify(item.customDesign.previewImages || {}).length;
        newSize += JSON.stringify(item.customDesign.metrics || {}).length;
      }
    }
  }
  
  return {
    oldSize,
    newSize,
    saved: oldSize - newSize,
    reduction: oldSize > 0 ? ((oldSize - newSize) / oldSize * 100).toFixed(1) + '%' : '0%'
  };
}

export default {
  createDesignSnapshotFromCartItem,
  createOptimizedCustomDesign,
  getDesignDataFromOrderItem,
  populateDesignSnapshots,
  isOptimizedOrder,
  calculateStorageSavings
};
