import Order from '../models/Order.js';
import { fetchTrackingDetails, persistTrackingOnOrder, syncOpenShipments } from '../services/tracking.service.js';

const canViewOrder = (order, user) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return order.user && order.user._id.toString() === user._id.toString();
};

export const getTrackingByNumber = async (req, res) => {
  try {
    const { trackingNumber } = req.params;
    if (!trackingNumber) {
      return res.status(400).json({ success: false, message: 'Tracking number is required' });
    }
    const trackingData = await fetchTrackingDetails(trackingNumber);
    return res.json({ success: true, data: trackingData });
  } catch (error) {
    console.error('[Tracking] Failed to fetch tracking number', error.message);
    return res.status(500).json({ success: false, message: error.message || 'Unable to fetch tracking info' });
  }
};

export const getTrackingForOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId).populate('user', 'name email');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    if (!order.trackingNumber) {
      return res.status(400).json({ success: false, message: 'Order does not have tracking yet' });
    }
    if (!canViewOrder(order, req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this tracking info' });
    }

    const trackingData = await fetchTrackingDetails(order.trackingNumber);
    await persistTrackingOnOrder(order, trackingData, { skipDeliveryEmail: true });

    return res.json({ success: true, data: trackingData });
  } catch (error) {
    console.error('[Tracking] Failed to fetch order tracking', error.message);
    return res.status(500).json({ success: false, message: error.message || 'Unable to fetch tracking info' });
  }
};

export const triggerTrackingSync = async (_req, res) => {
  try {
    const result = await syncOpenShipments();
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('[Tracking] Manual sync failed', error.message);
    return res.status(500).json({ success: false, message: 'Failed to trigger tracking sync' });
  }
};


