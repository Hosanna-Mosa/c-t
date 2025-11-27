import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const STORE_NAME = process.env.STORE_NAME || 'CustomTees';
const FRONTEND_BASE_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
const SUPPORT_EMAIL = process.env.EMAIL_FROM || process.env.EMAIL_USER;
const TRACKING_STATUS_COPY = {
  label_created: {
    subject: `${STORE_NAME} order label created`,
    headline: 'Label created',
    message: 'We generated your UPS shipping label. Next stop: UPS pickup.',
  },
  origin_scan: {
    subject: 'UPS scanned your package',
    headline: 'UPS has your order',
    message: 'UPS scanned your package at their origin facility and it will start moving shortly.',
  },
  departed_facility: {
    subject: 'Your package departed a UPS facility',
    headline: 'Left the UPS facility',
    message: 'UPS has moved your order to the next sorting facility.',
  },
  in_transit: {
    subject: 'Your package is in transit',
    headline: 'In transit',
    message: 'UPS is currently transporting your package to the next stop.',
  },
  out_for_delivery: {
    subject: 'Your package is out for delivery',
    headline: 'Out for delivery',
    message: 'UPS placed your order on a local truck for final delivery today.',
  },
  fallback: {
    subject: `${STORE_NAME} tracking update`,
    headline: 'Tracking update',
    message: 'We have a new UPS update for your order.',
  },
};

const buildTrackingLink = (trackingNumber) => `${FRONTEND_BASE_URL}/track/${trackingNumber}`;

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

const sendEmail = async (mailOptions) => {
  console.log(`[EmailService] Attempting to send email to: ${mailOptions.to}, Subject: ${mailOptions.subject}`);
  try {
    const transporter = createTransporter();
    const result = await transporter.sendMail({
      from: SUPPORT_EMAIL,
      ...mailOptions,
    });
    console.log(`[EmailService] Email sent successfully to: ${mailOptions.to}, MessageID: ${result.messageId}`);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('[EmailService] Email sending failed:', error);
    return { success: false, error: error.message };
  }
};

// Generate verification code
export const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send verification code email
export const sendVerificationCode = async (email, code) => {
  console.log(`[EmailService] Sending verification code to ${email}`);
  try {
    const mailOptions = {
      to: email,
      subject: 'Password Reset Verification Code - CustomTees',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>You have requested to reset your password for your CustomTees account.</p>
          <p>Your verification code is:</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #007bff; font-size: 32px; margin: 0; letter-spacing: 5px;">${code}</h1>
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this password reset, please ignore this email.</p>
          <hr style="margin: 30px 0;">
          <p style="color: #666; font-size: 12px;">© 2025 CustomTees. All rights reserved.</p>
        </div>
      `,
    };

    return await sendEmail(mailOptions);
  } catch (error) {
    console.error('Email sending error:', error);
    return { success: false, error: error.message };
  }
};

// Send password reset success email
export const sendPasswordResetSuccess = async (email) => {
  console.log(`[EmailService] Sending password reset success to ${email}`);
  try {
    const mailOptions = {
      to: email,
      subject: 'Password Reset Successful - CustomTees',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #28a745;">Password Reset Successful</h2>
          <p>Your password has been successfully reset for your CustomTees account.</p>
          <p>If you didn't make this change, please contact our support team immediately.</p>
          <hr style="margin: 30px 0;">
          <p style="color: #666; font-size: 12px;">© 2025 CustomTees. All rights reserved.</p>
        </div>
      `,
    };

    return await sendEmail(mailOptions);
  } catch (error) {
    console.error('Email sending error:', error);
    return { success: false, error: error.message };
  }
};

export const sendTrackingStatusUpdateEmail = async ({
  email,
  name,
  trackingNumber,
  orderId,
  milestone = 'fallback',
  statusText,
  description,
  location,
  estimatedDelivery,
}) => {
  console.log(`[EmailService] Sending tracking status update (${milestone}) to ${email}`);
  if (!email || !trackingNumber) {
    return { success: false, error: 'Missing email or tracking number' };
  }

  const copy = TRACKING_STATUS_COPY[milestone] || TRACKING_STATUS_COPY.fallback;
  const trackingUrl = buildTrackingLink(trackingNumber);
  const friendlyName = name || 'there';
  const eta = estimatedDelivery ? new Date(estimatedDelivery).toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' }) : null;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #111;">
      <p style="margin:0 0 4px 0;">Hi ${friendlyName},</p>
      <h2 style="margin: 0 0 8px 0; color:#111;">${copy.headline}</h2>
      <p style="margin:0 0 12px 0;">${copy.message}</p>
      <div style="background:#f5f5f5;border-radius:12px;padding:16px;margin:20px 0;">
        <div style="font-size:12px;text-transform:uppercase;color:#666;">Latest UPS scan</div>
        <div style="font-size:18px;font-weight:700;margin:4px 0;">${statusText || description || 'Status update'}</div>
        ${location ? `<div style="font-size:13px;color:#555;display:flex;gap:6px;align-items:center;margin-bottom:8px;">
          <span style="font-size:14px;">📍</span> ${location}
        </div>` : ''}
        ${eta ? `<div style="font-size:13px;color:#333;">Estimated delivery: <strong>${eta}</strong></div>` : ''}
        <a href="${trackingUrl}" style="display:inline-block;margin-top:12px;padding:10px 18px;background:#111;color:#fff;text-decoration:none;border-radius:8px;">
          View tracking timeline
        </a>
      </div>
      <p style="font-size:12px;color:#666;">Order ${orderId ? `#${orderId.slice(-6)}` : ''} · Tracking ${trackingNumber}</p>
      <p style="margin-top:24px;font-size:12px;color:#666;">Reply to this email if you need help.</p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: copy.subject,
    html,
  });
};

export const sendTrackingNotificationEmail = async ({ email, name, trackingNumber, orderId, estimatedDelivery }) => {
  console.log(`[EmailService] Sending tracking notification to ${email}`);
  if (!email || !trackingNumber) {
    return { success: false, error: 'Missing email or tracking number' };
  }

  const trackingUrl = buildTrackingLink(trackingNumber);
  const friendlyName = name || 'there';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #111;">
      <h2 style="color: #111; margin-bottom: 8px;">Your ${STORE_NAME} order is on the way!</h2>
      <p>Hi ${friendlyName},</p>
      <p>We've generated a UPS label for your order ${orderId ? `#${orderId.slice(-6)}` : ''}. Use the tracking number below to follow your package.</p>
      <div style="background:#f5f5f5;border-radius:12px;padding:16px;margin:20px 0;">
        <div style="font-size:13px;text-transform:uppercase;color:#666;">Tracking Number</div>
        <div style="font-size:22px;font-weight:700;letter-spacing:1px;margin:8px 0;">${trackingNumber}</div>
        ${estimatedDelivery ? `<div style="font-size:14px;color:#333;">Estimated delivery: <strong>${estimatedDelivery}</strong></div>` : ''}
        <a href="${trackingUrl}" style="display:inline-block;margin-top:12px;padding:10px 18px;background:#111;color:#fff;text-decoration:none;border-radius:8px;">
          Track Package
        </a>
      </div>
      <p>We'll keep you posted as UPS scans your shipment.</p>
      <p style="margin-top:32px;font-size:12px;color:#666;">Need help? Reply to this email and our team will assist you.</p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: `${STORE_NAME} order is ready to ship`,
    html,
  });
};

export const sendDeliveryNotificationEmail = async ({ email, name, trackingNumber, orderId }) => {
  console.log(`[EmailService] Sending delivery notification to ${email}`);
  if (!email) {
    return { success: false, error: 'Missing email' };
  }

  const trackingUrl = buildTrackingLink(trackingNumber);
  const friendlyName = name || 'there';
  const hasTracking = trackingNumber && trackingNumber !== 'N/A';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #111;">
      <h2 style="color: #111; margin-bottom: 8px;">Delivered: Your ${STORE_NAME} order</h2>
      <p>Hi ${friendlyName},</p>
      <p>${hasTracking ? 'UPS has confirmed delivery' : 'Your order has been delivered'} for order ${orderId ? `#${orderId.slice(-6)}` : ''}. We hope you love your new custom gear!</p>
      <div style="background:#f5f5f5;border-radius:12px;padding:16px;margin:20px 0;">
        ${hasTracking ? `
          <div style="font-size:13px;text-transform:uppercase;color:#666;">Tracking Number</div>
          <div style="font-size:20px;font-weight:600;letter-spacing:0.5px;margin:8px 0;">${trackingNumber}</div>
          <a href="${trackingUrl}" style="display:inline-block;margin-top:12px;padding:10px 18px;background:#111;color:#fff;text-decoration:none;border-radius:8px;">
            View Delivery Details
          </a>
        ` : `
          <div style="font-size:18px;font-weight:600;margin:8px 0;">Order Delivered</div>
          <div style="font-size:14px;color:#666;">Your order has been successfully delivered.</div>
        `}
      </div>
      <p>If something doesn't look right, reply to this email and we'll make it right.</p>
      <p style="margin-top:32px;font-size:12px;color:#666;">Thank you for choosing ${STORE_NAME}.</p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: `${STORE_NAME} order delivered`,
    html,
  });
};

export const sendOrderConfirmationEmail = async ({ email, name, orderId, total, items }) => {
  console.log(`[EmailService] Sending order confirmation to ${email}`);
  if (!email) return { success: false, error: 'Missing email' };

  const friendlyName = name || 'there';
  const formattedTotal = (total / 100).toFixed(2);

  const itemsHtml = items.map(item => `
    <div style="border-bottom:1px solid #eee;padding:12px 0;">
      <div style="font-weight:bold;">${item.productName}</div>
      <div style="color:#666;font-size:14px;">Qty: ${item.quantity}</div>
    </div>
  `).join('');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #111;">
      <h2 style="color: #111; margin-bottom: 8px;">Order Confirmed!</h2>
      <p>Hi ${friendlyName},</p>
      <p>Thanks for your order! We've received it and are getting started on it.</p>
      
      <div style="background:#f9f9f9;border-radius:12px;padding:20px;margin:20px 0;">
        <div style="font-size:14px;color:#666;margin-bottom:12px;">Order #${orderId.slice(-6)}</div>
        ${itemsHtml}
        <div style="border-top:2px solid #eee;margin-top:12px;padding-top:12px;font-weight:bold;font-size:18px;text-align:right;">
          Total: $${formattedTotal}
        </div>
      </div>

      <p>We'll send you another email when your order ships.</p>
      <p style="margin-top:32px;font-size:12px;color:#666;">Need help? Reply to this email.</p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: `${STORE_NAME} Order Confirmation #${orderId.slice(-6)}`,
    html,
  });
};
