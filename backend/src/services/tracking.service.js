import fetch from 'node-fetch';
import cron from 'node-cron';
import Order from '../models/Order.js';
import { getUpsToken } from './ups.service.js';
import { sendDeliveryNotificationEmail, sendTrackingStatusUpdateEmail } from './email.service.js';

const UPS_USE_SANDBOX = process.env.UPS_USE_SANDBOX !== 'false';
const UPS_TRACKING_URL = UPS_USE_SANDBOX
  ? 'https://wwwcie.ups.com/api/track/v1/details'
  : 'https://onlinetools.ups.com/api/track/v1/details';

const MAX_ORDERS_PER_SYNC = parseInt(process.env.TRACKING_SYNC_BATCH_SIZE || '25', 10);
const TRACKING_SYNC_CRON = (process.env.TRACKING_SYNC_CRON || '0 10 * * *,0 18 * * *')
  .split(',')
  .map((expr) => expr.trim())
  .filter(Boolean);
const TRACKING_SYNC_TIMEZONE = process.env.TRACKING_SYNC_TIMEZONE || process.env.TZ || 'UTC';

const UPS_STATUS_MAPPINGS = [
  { keywords: ['label created'], stage: 'pending', milestone: 'label_created' },
  { keywords: ['origin scan', 'pickup scan'], stage: 'label_generated', milestone: 'origin_scan' },
  { keywords: ['departed ups facility', 'departure scan'], stage: 'carrier_handoff', milestone: 'departed_facility' },
  { keywords: ['out for delivery'], stage: 'in_transit', milestone: 'out_for_delivery' },
  { keywords: ['in transit'], stage: 'in_transit', milestone: 'in_transit' },
  { keywords: ['arrival scan'], stage: 'in_transit', milestone: 'in_transit' },
  { keywords: ['delivered'], stage: 'delivered', milestone: 'delivered' },
];

const parseUpsDateTime = (dateStr, timeStr) => {
  if (!dateStr) return null;
  const cleanDate = dateStr.replace(/[^0-9]/g, '');
  const cleanTime = (timeStr || '').replace(/[^0-9]/g, '');

  const year = cleanDate.slice(0, 4);
  const month = cleanDate.slice(4, 6) || '01';
  const day = cleanDate.slice(6, 8) || '01';

  let hours = cleanTime.slice(0, 2) || '00';
  let minutes = cleanTime.slice(2, 4) || '00';
  let seconds = cleanTime.slice(4, 6) || '00';

  if (hours.length === 1) hours = `0${hours}`;
  if (minutes.length === 1) minutes = `0${minutes}`;
  if (seconds.length === 1) seconds = `0${seconds}`;

  const iso = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeActivity = (activity) => {
  if (!activity) return null;
  const status =
    activity.status?.description ||
    activity.Status?.Description ||
    activity.description ||
    activity.ActivityType?.Description ||
    'Activity';
  const code = activity.status?.code || activity.Status?.Code || activity.code || activity.ActivityType?.Code;
  const description =
    activity.description ||
    activity.Status?.Description ||
    activity.status?.description ||
    activity.ActivityType?.Description ||
    status;
  const date = parseUpsDateTime(activity.date || activity.Date, activity.time || activity.Time);
  const locationParts = [
    activity.location?.address?.city || activity.Location?.Address?.City,
    activity.location?.address?.stateProvince || activity.Location?.Address?.StateProvinceCode,
    activity.location?.address?.country || activity.Location?.Address?.CountryCode,
  ].filter(Boolean);
  const location = locationParts.join(', ');

  return {
    status,
    code,
    description,
    location,
    date,
    raw: activity,
  };
};

const extractActivities = (data) => {
  const shipments = data?.trackResponse?.shipment || data?.Shipment || data?.shipments || [];
  const shipment = Array.isArray(shipments) ? shipments[0] : shipments;
  const packages = shipment?.package || shipment?.Package || [];
  const pkg = Array.isArray(packages) ? packages[0] : packages;
  const activities = pkg?.activity || pkg?.Activity || [];
  const activityList = Array.isArray(activities) ? activities : activities ? [activities] : [];
  return activityList
    .map(normalizeActivity)
    .filter(Boolean)
    .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
};

const extractEstimatedDelivery = (data) => {
  const shipments = data?.trackResponse?.shipment || data?.Shipment || [];
  const shipment = Array.isArray(shipments) ? shipments[0] : shipments;
  const packages = shipment?.package || shipment?.Package || [];
  const pkg = Array.isArray(packages) ? packages[0] : packages;
  const delivery = pkg?.deliveryDate || pkg?.DeliveryDate || pkg?.ScheduledDeliveryDate;
  if (!delivery) return null;
  const estimate = delivery?.date || delivery?.Date || delivery;
  const parsed = parseUpsDateTime(estimate, delivery?.time || delivery?.Time);
  return parsed;
};

const mapUpsEventToMilestone = (latestEvent) => {
  if (!latestEvent) return { stage: null, milestone: null };
  const code = (latestEvent.code || '').toUpperCase();
  const haystack = `${latestEvent.status || ''} ${latestEvent.description || ''}`.toLowerCase();

  for (const mapping of UPS_STATUS_MAPPINGS) {
    if (mapping.keywords.some((keyword) => haystack.includes(keyword))) {
      return { stage: mapping.stage, milestone: mapping.milestone };
    }
  }

  if (code === 'D') {
    return { stage: 'delivered', milestone: 'delivered' };
  }
  if (code === 'I') {
    return { stage: 'in_transit', milestone: 'in_transit' };
  }

  return { stage: null, milestone: null };
};

const deriveShipmentStatus = (latestEvent) => {
  const { stage } = mapUpsEventToMilestone(latestEvent);
  return stage;
};

export const fetchTrackingDetails = async (trackingNumber) => {
  if (!trackingNumber) {
    throw new Error('Tracking number is required');
  }

  const token = await getUpsToken();
  const payload = {
    locale: 'en_US',
    trackRequest: {
      TrackingNumber: [trackingNumber],
    },
  };

  const response = await fetch(UPS_TRACKING_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      transId: Date.now().toString(),
      transactionSrc: 'CustomTeesTrack',
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  let data;
  try {
    data = JSON.parse(responseText);
  } catch (error) {
    throw new Error(`UPS tracking API returned invalid JSON: ${error.message}`);
  }

  if (!response.ok) {
    const errorMsg =
      data?.response?.errors?.[0]?.message ||
      data?.response?.errors?.[0]?.message ||
      data?.Fault?.faultstring ||
      data?.message ||
      `Failed to fetch UPS tracking info (${response.status})`;
    throw new Error(errorMsg);
  }

  const events = extractActivities(data);
  const estimatedDelivery = extractEstimatedDelivery(data);
  const latestEvent = events[0] || null;
  const { stage: shipmentStatus, milestone } = mapUpsEventToMilestone(latestEvent);

  return {
    trackingNumber,
    shipmentStatus: shipmentStatus || 'label_generated',
    milestoneKey: milestone,
    latestEvent,
    estimatedDelivery,
    events,
    raw: data,
  };
};

export const persistTrackingOnOrder = async (order, trackingData, { skipDeliveryEmail = false } = {}) => {
  if (!order || !trackingData) return order;
  const previousNotified = order.lastTrackingStatusNotified;

  const updates = {
    lastTrackingSyncAt: new Date(),
  };

  if (Array.isArray(trackingData.events) && trackingData.events.length) {
    updates.trackingHistory = trackingData.events.slice(0, 50).map((event) => ({
      status: event.status,
      code: event.code,
      description: event.description,
      location: event.location,
      date: event.date,
    }));
  }

  updates.trackingSummary = {
    status: trackingData.latestEvent?.status || order.trackingSummary?.status,
    description: trackingData.latestEvent?.description || order.trackingSummary?.description,
    code: trackingData.latestEvent?.code || order.trackingSummary?.code,
    estimatedDelivery: trackingData.estimatedDelivery || order.trackingSummary?.estimatedDelivery,
    lastLocation: trackingData.latestEvent?.location || order.trackingSummary?.lastLocation,
    updatedAt: new Date(),
  };

  if (trackingData.shipmentStatus && trackingData.shipmentStatus !== order.shipmentStatus) {
    updates.shipmentStatus = trackingData.shipmentStatus;
  }

  if (trackingData.shipmentStatus === 'delivered') {
    updates.status = 'delivered';
    updates.deliveredAt = trackingData.latestEvent?.date || new Date();
  }

  order.set(updates);
  const saved = await order.save();
  const latestStatusText = updates.trackingSummary.status;
  const milestoneKey = trackingData.milestoneKey;
  const shouldSendStatusEmail =
    !skipDeliveryEmail &&
    milestoneKey &&
    milestoneKey !== 'delivered' &&
    latestStatusText &&
    latestStatusText !== previousNotified &&
    order.user?.email;

  if (
    trackingData.shipmentStatus === 'delivered' &&
    !order.deliveryEmailSentAt &&
    !skipDeliveryEmail
  ) {
    if (order.user?.email) {
      await sendDeliveryNotificationEmail({
        email: order.user.email,
        name: order.user.name,
        trackingNumber: order.trackingNumber,
        orderId: order._id.toString(),
      });
      saved.lastTrackingStatusNotified = latestStatusText || 'Delivered';
    }
    saved.deliveryEmailSentAt = new Date();
    await saved.save();
    return saved;
  }

  if (shouldSendStatusEmail) {
    await sendTrackingStatusUpdateEmail({
      email: order.user.email,
      name: order.user.name,
      trackingNumber: order.trackingNumber,
      orderId: order._id.toString(),
      milestone: milestoneKey,
      statusText: trackingData.latestEvent?.status || updates.trackingSummary.status,
      description: updates.trackingSummary.description,
      location: updates.trackingSummary.lastLocation,
      estimatedDelivery: updates.trackingSummary.estimatedDelivery,
    });
    saved.lastTrackingStatusNotified = latestStatusText;
    await saved.save();
  }

  return saved;
};

export const syncOpenShipments = async () => {
  const query = {
    trackingNumber: { $ne: null },
    shipmentStatus: { $ne: 'delivered' },
  };

  const orders = await Order.find(query)
    .populate('user', 'name email')
    .sort({ updatedAt: -1 })
    .limit(MAX_ORDERS_PER_SYNC);

  if (!orders.length) {
    return { synced: 0 };
  }

  let synced = 0;
  for (const order of orders) {
    try {
      const trackingData = await fetchTrackingDetails(order.trackingNumber);
      await persistTrackingOnOrder(order, trackingData);
      synced += 1;
    } catch (error) {
      console.error('[Tracking] Failed to sync order', order._id.toString(), error.message);
    }
  }

  return { synced };
};

let trackingCronTasks = [];

export const startTrackingSyncJob = () => {
  if (trackingCronTasks.length) return;

  const tick = async () => {
    try {
      await syncOpenShipments();
    } catch (error) {
      console.error('[Tracking] Background sync failed:', error.message);
    }
  };

  tick();

  trackingCronTasks = (TRACKING_SYNC_CRON.length ? TRACKING_SYNC_CRON : ['0 10 * * *', '0 18 * * *']).map((expression) => {
    return cron.schedule(
      expression,
      () => {
        tick();
      },
      {
        timezone: TRACKING_SYNC_TIMEZONE,
      }
    );
  });
};


