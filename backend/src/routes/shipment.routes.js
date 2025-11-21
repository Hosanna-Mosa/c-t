import { Router } from 'express';
import Order from '../models/Order.js';
import { protect, verifyAdmin } from '../middlewares/auth.middleware.js';
import { createUpsShipment } from '../services/ups.service.js';
import { sendTrackingNotificationEmail } from '../services/email.service.js';

const router = Router();

const validatePackageInfo = (payload = {}) => {
  const requiredFields = ['weight', 'length', 'width', 'height'];
  const missing = requiredFields.filter(
    (field) => payload[field] === undefined || payload[field] === null || payload[field] === ''
  );
  if (missing.length) {
    return `Missing package fields: ${missing.join(', ')}`;
  }

  const invalid = requiredFields.filter((field) => Number(payload[field]) <= 0 || Number.isNaN(Number(payload[field])));
  if (invalid.length) {
    return `Invalid package values for: ${invalid.join(', ')}`;
  }

  return null;
};

router.post('/create-label/:orderId', protect, verifyAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    console.log('[ShipmentRoute] Incoming label request', {
      orderId,
      payload: req.body,
      userId: req.user?._id?.toString(),
    });
    const validationError = validatePackageInfo(req.body);
    if (validationError) {
      console.warn('[ShipmentRoute] Validation failed', { orderId, validationError });
      return res.status(400).json({ success: false, message: validationError });
    }

    const order = await Order.findById(orderId).populate('user', 'name email phone');
    if (!order) {
      console.warn('[ShipmentRoute] Order not found', { orderId });
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (!order.shippingAddress) {
      console.warn('[ShipmentRoute] Missing shipping address', { orderId });
      return res.status(400).json({ success: false, message: 'Order is missing a shipping address' });
    }

    if (
      order.trackingNumber &&
      order.labelUrl &&
      (order.shipmentStatus === 'label_generated' || order.status === 'shipped') &&
      !req.query.force
    ) {
      console.log('[ShipmentRoute] Order already has label, returning existing data', {
        orderId,
        trackingNumber: order.trackingNumber,
        labelUrl: order.labelUrl,
      });
      return res.json({
        success: true,
        trackingNumber: order.trackingNumber,
        labelUrl: order.labelUrl,
        status: order.status,
        shipmentStatus: order.shipmentStatus,
        reused: true,
      });
    }

    console.log('[ShipmentRoute] Calling createUpsShipment', {
      orderId,
      shippingAddress: order.shippingAddress,
    });
    const shipmentResult = await createUpsShipment(order, req.body);
    console.log('[ShipmentRoute] UPS shipment success', {
      orderId,
      trackingNumber: shipmentResult.trackingNumber,
      labelUrl: shipmentResult.labelUrl,
      labelPublicId: shipmentResult.labelPublicId,
    });

    order.trackingNumber = shipmentResult.trackingNumber;
    order.labelUrl = shipmentResult.labelUrl;
    order.labelPublicId = shipmentResult.labelPublicId;
    order.shipmentStatus = 'label_generated';
    order.status = 'shipped';
    let savedOrder = await order.save();
    console.log('[ShipmentRoute] Order updated after label generation', {
      orderId,
      trackingNumber: savedOrder.trackingNumber,
      labelUrl: savedOrder.labelUrl,
      shipmentStatus: savedOrder.shipmentStatus,
      status: savedOrder.status,
    });

    if (!savedOrder.trackingEmailSentAt && savedOrder.user?.email) {
      await sendTrackingNotificationEmail({
        email: savedOrder.user.email,
        name: savedOrder.user.name,
        trackingNumber: savedOrder.trackingNumber,
        orderId: savedOrder._id.toString(),
      });
      savedOrder.trackingEmailSentAt = new Date();
      savedOrder = await savedOrder.save();
    }

    return res.json({
      success: true,
      trackingNumber: order.trackingNumber,
      labelUrl: order.labelUrl,
      labelPublicId: order.labelPublicId,
      status: order.status,
      shipmentStatus: order.shipmentStatus,
    });
  } catch (error) {
    console.error('[Shipment] Failed to create UPS label:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Unable to generate UPS shipping label',
    });
  }
});

router.post('/handoff/:orderId', protect, verifyAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId).populate('user', 'name email');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    if (!order.trackingNumber) {
      return res.status(400).json({ success: false, message: 'Tracking number missing for this order' });
    }

    order.shipmentStatus = 'carrier_handoff';
    order.status = order.status === 'placed' ? 'shipped' : order.status;
    order.carrierHandoffAt = new Date();

    const saved = await order.save();

    if (!saved.trackingEmailSentAt && saved.user?.email) {
      await sendTrackingNotificationEmail({
        email: saved.user.email,
        name: saved.user.name,
        trackingNumber: saved.trackingNumber,
        orderId: saved._id.toString(),
      });
      saved.trackingEmailSentAt = new Date();
      await saved.save();
    }

    return res.json({ success: true, data: saved });
  } catch (error) {
    console.error('[Shipment] Failed to mark handoff:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Unable to update shipment handoff',
    });
  }
});

export default router;

