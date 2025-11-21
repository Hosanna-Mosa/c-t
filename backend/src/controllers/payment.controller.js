import Order from '../models/Order.js';
import CheckoutSession from '../models/CheckoutSession.js';
import Coupon from '../models/Coupon.js';
import User from '../models/User.js';
import { isSquareConfigured, retrieveSquarePayment, retrievePaymentLink, searchPaymentsByOrder } from '../services/square.service.js';

const incrementCouponUsage = async (couponDoc) => {
  if (!couponDoc) return;
  couponDoc.usedCount += 1;
  await couponDoc.save();
};

const sleep = (ms = 1000) => new Promise((resolve) => setTimeout(resolve, ms));

const finalizeSquareOrderFromSession = async ({ session, payment, squareOrderIdOverride }) => {
  const order = await Order.create({
    user: session.user,
    items: session.items,
    total: session.total,
    paymentMethod: 'square',
    payment: {
      provider: 'square',
      status: 'pending',
      squareCheckoutId: session.payment?.squareCheckoutId,
      squareOrderId: squareOrderIdOverride || session.payment?.squareOrderId,
      checkoutUrl: session.payment?.checkoutUrl,
    },
    shippingAddress: session.shippingAddress,
    coupon: session.coupon
      ? {
          code: session.coupon.code,
          discountAmount: session.coupon.discountAmount,
        }
      : undefined,
    shippingCost: session.shippingCost,
  });

  order.payment.status = 'paid';
  order.payment.squarePaymentId = payment?.id || payment?.squarePaymentId;
  order.payment.squareOrderId = payment?.orderId || squareOrderIdOverride || order.payment.squareOrderId;
  order.payment.failureReason = undefined;
  order.status = 'processing';
  await order.save();

  if (session.coupon?.id) {
    const couponDoc = await Coupon.findById(session.coupon.id);
    await incrementCouponUsage(couponDoc);
  }

  const user = await User.findById(session.user);
  if (user) {
    user.cart = [];
    await user.save();
  }

  session.status = 'completed';
  session.payment = {
    ...(session.payment || {}),
    status: 'paid',
    squarePaymentId: payment?.id || payment?.squarePaymentId || session.payment?.squareCheckoutId,
    squareOrderId: order.payment.squareOrderId,
    failureReason: undefined,
  };
  session.order = order._id;
  await session.save();

  return order;
};

export const verifySquarePayment = async (req, res) => {
  try {
    if (!isSquareConfigured()) {
      return res.status(500).json({ success: false, message: 'Square payments are not configured' });
    }

    const { sessionId, orderId, transactionId, squareOrderId, status } = req.body;

    if (sessionId) {
      console.log('[Payments] /square/verify (session path) payload:', {
        sessionId,
        transactionId,
        squareOrderId,
        status,
      });

      const session = await CheckoutSession.findById(sessionId);

      if (!session) {
        return res.status(404).json({ success: false, message: 'Checkout session not found' });
      }

      if (String(session.user) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'Access denied for this session' });
      }

      if (session.status === 'completed' && session.order) {
        const existingOrder = await Order.findById(session.order);
        if (existingOrder) {
          return res.json({
            success: true,
            data: {
              order: existingOrder,
              paymentStatus: 'paid',
              squareStatus: 'COMPLETED',
            },
          });
        }
      }

      let payment = null;
      let squareStatus = null;

      // If no transactionId provided, try to find payment from Payment Link status
      if (!transactionId) {
        const checkoutId = session.payment?.squareCheckoutId;
        const orderIdToCheck = squareOrderId || session.payment?.squareOrderId;
        
        console.log('[Payments] No transactionId provided, checking payment link:', checkoutId, {
          fallbackOrderId: orderIdToCheck,
        });
        
        // First, try to retrieve payment link status (most reliable for sandbox)
        if (checkoutId) {
          try {
            let paymentLink = null;

            const maxAttempts = 5;
            for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
              paymentLink = await retrievePaymentLink(checkoutId);

              if (!paymentLink) {
                break;
              }

              const linkStatus = paymentLink.status;
              const relatedPayments = paymentLink.relatedResources?.payments || [];
              const hasCompletedPayment = relatedPayments.some((p) => p?.status === 'COMPLETED');

              if (linkStatus === 'COMPLETED' || hasCompletedPayment) {
                break;
              }

              if (attempt < maxAttempts - 1) {
                console.log(
                  `[Payments] Payment link status ${linkStatus || 'unknown'}; waiting before retry (${attempt + 1}/${maxAttempts})`
                );
                await sleep(1500);
              }
            }

            if (paymentLink) {
              const linkStatus = paymentLink.status;
            
              console.log('[Payments] Payment link status:', linkStatus);
              
              // In sandbox, if payment link is COMPLETED, we can trust it
              // Payment details might not be immediately available but link status is reliable
              if (linkStatus === 'COMPLETED') {
                // Try to find payment details first
                if (paymentLink.relatedResources?.payments) {
                  const payments = paymentLink.relatedResources.payments || [];
                  const completedPayment = payments.find(p => p?.status === 'COMPLETED');
                  if (completedPayment) {
                    payment = completedPayment;
                    squareStatus = payment.status;
                    console.log('[Payments] Found completed payment from payment link:', payment.id);
                  } else if (payments.length > 0) {
                    payment = payments[0];
                    squareStatus = payment.status;
                    console.log('[Payments] Found payment from payment link:', payment.id, 'status:', squareStatus);
                  }
                }
                
                // If no payment object but link is COMPLETED, search by order ID
                if (!payment && (paymentLink.orderId || orderIdToCheck)) {
                  const orderId = paymentLink.orderId || orderIdToCheck;
                  console.log('[Payments] Payment link completed, searching payments by order:', orderId);
                  
                  try {
                    const payments = await searchPaymentsByOrder(orderId);
                    if (payments && payments.length > 0) {
                      const completedPayment = payments.find(p => p?.status === 'COMPLETED');
                      if (completedPayment) {
                        payment = completedPayment;
                        squareStatus = payment.status;
                        console.log('[Payments] Found payment from order search:', payment.id);
                      } else {
                        payment = payments[0];
                        squareStatus = payment.status;
                        console.log('[Payments] Using first payment from search:', payment.id, 'status:', squareStatus);
                      }
                    }
                  } catch (searchErr) {
                    console.warn('[Payments] Could not search payments by order:', searchErr?.message);
                  }
                }
                
                // If still no payment object but link status is COMPLETED, create a mock payment
                // This handles sandbox where payment details might not be immediately available
                if (!payment && linkStatus === 'COMPLETED') {
                  console.log('[Payments] Payment link COMPLETED but no payment object found after fallbacks. Treating as paid (sandbox mode).', {
                    checkoutId,
                    orderIdToCheck,
                    relatedPaymentsCount: paymentLink.relatedResources?.payments?.length || 0,
                  });
                  // Create a minimal payment object for sandbox
                  payment = {
                    id: checkoutId + '_sandbox',
                    status: 'COMPLETED',
                    orderId: paymentLink.orderId || orderIdToCheck,
                  };
                  squareStatus = 'COMPLETED';
                }
              } else if (linkStatus === 'OPEN' || linkStatus === 'EXPIRED') {
                // Payment link is still open or expired - payment not completed
                console.log('[Payments] Payment link status indicates payment not completed:', linkStatus);
              }
            }
          } catch (err) {
            console.error('[Payments] Error retrieving payment link:', err?.message);
          }
        } else {
          console.warn('[Payments] Session is missing squareCheckoutId; cannot verify payment link.');
        }
        
        // Fallback: try searching payments by order ID if we have it
        if (!payment && orderIdToCheck) {
          console.log('[Payments] Fallback: searching payments by order ID:', orderIdToCheck);
          try {
            const payments = await searchPaymentsByOrder(orderIdToCheck);
            if (payments && payments.length > 0) {
              const completedPayment = payments.find(p => p?.status === 'COMPLETED');
              if (completedPayment) {
                payment = completedPayment;
                squareStatus = payment.status;
                console.log('[Payments] Found payment from order search:', payment.id);
              } else {
                payment = payments[0];
                squareStatus = payment.status;
                console.log('[Payments] Using first payment:', payment.id, 'status:', squareStatus);
              }
            } else {
              console.log('[Payments] Fallback order search returned no payments.');
            }
          } catch (err) {
            console.warn('[Payments] Could not search payments by order:', err?.message);
          }
        }
        
        console.log('[Payments] Final payment status after sandbox polling:', payment ? squareStatus : 'NO_PAYMENT_FOUND', {
          checkoutId,
          orderIdToCheck,
        });

        // If still no payment found and no transaction ID, treat as cancelled/failed
        if (!payment) {
          session.status = 'failed';
          session.payment = {
            ...(session.payment || {}),
            status: status === 'cancelled' ? 'cancelled' : 'failed',
            failureReason: status === 'cancelled' 
              ? 'Customer cancelled Square checkout' 
              : 'No payment found for this checkout session',
          };
          await session.save();

          return res.json({
            success: true,
            data: {
              order: null,
              paymentStatus: 'failed',
              squareStatus: status || 'CANCELLED',
            },
          });
        }
      } else {
        // transactionId was provided, fetch payment directly
        console.log('[Payments] transactionId present, retrieving payment directly', transactionId);
        payment = await retrieveSquarePayment(transactionId);
        squareStatus = payment?.status;
      }

      if (!payment) {
        console.warn('[Payments] Unable to determine payment after all strategies', {
          sessionId,
          transactionId,
          squareOrderId,
        });
        return res.status(404).json({ success: false, message: 'Square payment not found' });
      }

      // Use squareStatus from above or get it from payment
      if (!squareStatus) {
        squareStatus = payment?.status;
      }

      if (squareStatus === 'COMPLETED' || (payment && payment.status === 'COMPLETED')) {
        console.log('[Payments] Payment confirmed as COMPLETED, finalizing order', {
          sessionId,
          paymentId: payment?.id,
          squareStatus,
        });
        const order = await finalizeSquareOrderFromSession({
          session,
          payment,
          squareOrderIdOverride: squareOrderId || payment?.orderId,
        });

        console.log('[Payments] Order finalized from session', sessionId, { orderId: order._id });

        return res.json({
          success: true,
          data: {
            order,
            paymentStatus: 'paid',
            squareStatus: squareStatus || 'COMPLETED',
          },
        });
      }

      session.status = 'failed';
      session.payment = {
        ...(session.payment || {}),
        status: 'failed',
        squarePaymentId: transactionId,
        failureReason: payment?.cardDetails?.status || squareStatus || 'Square payment failed',
      };
      await session.save();

      return res.json({
        success: true,
        data: {
          order: null,
          paymentStatus: 'failed',
          squareStatus,
        },
      });
    }

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId is required' });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (String(order.user) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied for this order' });
    }

    if (order.paymentMethod !== 'square') {
      return res.status(400).json({ success: false, message: 'Order was not paid with Square' });
    }

    if (!transactionId) {
      order.payment.status = 'failed';
      order.payment.failureReason = status === 'cancelled'
        ? 'Customer cancelled Square checkout'
        : 'Missing Square transaction ID';
      await order.save();

      return res.json({
        success: true,
        data: {
          order,
          paymentStatus: order.payment.status,
        },
      });
    }

    const payment = await retrieveSquarePayment(transactionId);

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Square payment not found' });
    }

    const squareStatus = payment?.status;

    if (squareStatus === 'COMPLETED') {
      order.payment.status = 'paid';
      order.payment.squarePaymentId = payment.id;
      order.payment.squareOrderId = payment.orderId || squareOrderId || order.payment.squareOrderId;
      order.payment.failureReason = undefined;
      order.status = 'processing';
    } else {
      order.payment.status = 'failed';
      order.payment.failureReason = payment?.cardDetails?.status || squareStatus || 'Square payment failed';
    }

    await order.save();

    return res.json({
      success: true,
      data: {
        order,
        paymentStatus: order.payment.status,
        squareStatus,
      },
    });
  } catch (error) {
    console.error('[Payments] verifySquarePayment failed:', error);
    return res.status(502).json({
      success: false,
      message: error?.message || 'Unable to verify Square payment',
    });
  }
};


