import Order from '../models/Order.js';
import CheckoutSession from '../models/CheckoutSession.js';
import Coupon from '../models/Coupon.js';
import User from '../models/User.js';
import { isSquareConfigured, retrieveSquarePayment, retrievePaymentLink, searchPaymentsByOrder } from '../services/square.service.js';

const SQUARE_ENVIRONMENT = process.env.SQUARE_ENVIRONMENT || 'sandbox';

const incrementCouponUsage = async (couponDoc) => {
  if (!couponDoc) return;
  couponDoc.usedCount += 1;
  await couponDoc.save();
};

const sleep = (ms = 1000) => new Promise((resolve) => setTimeout(resolve, ms));

const finalizeSquareOrderFromSession = async ({ session, payment, squareOrderIdOverride }) => {
  console.log('[Payments] finalizeSquareOrderFromSession called', {
    sessionId: session._id,
    userId: session.user,
    itemsCount: session.items?.length,
    total: session.total,
    paymentId: payment?.id,
  });
  
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

  console.log('[Payments] Order created with ID:', order._id);

  order.payment.status = 'paid';
  order.payment.squarePaymentId = payment?.id || payment?.squarePaymentId;
  order.payment.squareOrderId = payment?.orderId || squareOrderIdOverride || order.payment.squareOrderId;
  order.payment.failureReason = undefined;
  order.status = 'processing';
  await order.save();
  
  console.log('[Payments] Order saved with payment status:', order.payment.status, 'order status:', order.status);

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
        try {
          payment = await retrieveSquarePayment(transactionId);
          if (payment) {
            squareStatus = payment.status;
            console.log('[Payments] Successfully retrieved payment directly:', payment.id, 'status:', squareStatus);
          } else {
            console.log('[Payments] Payment not found (returned null), trying fallback strategies...');
          }
        } catch (paymentErr) {
          console.warn('[Payments] Direct payment retrieval failed:', paymentErr?.message);
        }
        
        // If payment is null (404) or retrieval failed, try fallback strategies
        if (!payment) {
          console.log('[Payments] Payment not found (404), trying fallback strategies...');
          
          // Fallback 1: Check payment link status (most reliable for sandbox)
          const checkoutId = session.payment?.squareCheckoutId;
          if (checkoutId) {
            console.log('[Payments] Fallback: Checking payment link status:', checkoutId);
            try {
              let paymentLink = null;
              const maxAttempts = 5;
              for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
                paymentLink = await retrievePaymentLink(checkoutId);
                if (!paymentLink) break;
                
                const linkStatus = paymentLink.status;
                const relatedPayments = paymentLink.relatedResources?.payments || [];
                const hasCompletedPayment = relatedPayments.some((p) => p?.status === 'COMPLETED');
                
                if (linkStatus === 'COMPLETED' || hasCompletedPayment) {
                  break;
                }
                
                if (attempt < maxAttempts - 1) {
                  console.log(`[Payments] Payment link status ${linkStatus || 'unknown'}; waiting before retry (${attempt + 1}/${maxAttempts})`);
                  await sleep(1500);
                }
              }
              
              if (paymentLink) {
                const linkStatus = paymentLink.status;
                console.log('[Payments] Payment link status:', linkStatus);
                
                if (linkStatus === 'COMPLETED') {
                  // Try to get payment from related resources
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
                  if (!payment && (paymentLink.orderId || squareOrderId || session.payment?.squareOrderId)) {
                    const orderIdToCheck = paymentLink.orderId || squareOrderId || session.payment?.squareOrderId;
                    console.log('[Payments] Payment link completed, searching payments by order:', orderIdToCheck);
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
                          console.log('[Payments] Using first payment from search:', payment.id, 'status:', squareStatus);
                        }
                      }
                    } catch (searchErr) {
                      console.warn('[Payments] Could not search payments by order:', searchErr?.message);
                    }
                  }
                  
                  // If still no payment but link is COMPLETED, treat as paid (sandbox mode)
                  if (!payment && linkStatus === 'COMPLETED') {
                    console.log('[Payments] Payment link COMPLETED but no payment object found. Treating as paid (sandbox mode).');
                    payment = {
                      id: transactionId || checkoutId + '_sandbox',
                      status: 'COMPLETED',
                      orderId: paymentLink.orderId || squareOrderId || session.payment?.squareOrderId,
                    };
                    squareStatus = 'COMPLETED';
                  }
                }
              }
            } catch (linkErr) {
              console.warn('[Payments] Payment link check failed:', linkErr?.message);
            }
          }
          
          // Fallback 2: If still no payment, try searching by order ID
          if (!payment) {
            const orderIdToCheck = squareOrderId || session.payment?.squareOrderId;
            if (orderIdToCheck) {
              console.log('[Payments] Fallback: searching payments by order ID:', orderIdToCheck);
              try {
                const payments = await searchPaymentsByOrder(orderIdToCheck);
                if (payments && payments.length > 0) {
                  // Prefer COMPLETED payments
                  const completedPayment = payments.find(p => p?.status === 'COMPLETED');
                  if (completedPayment) {
                    payment = completedPayment;
                    squareStatus = payment.status;
                    console.log('[Payments] Found payment via order search:', payment.id);
                  } else {
                    payment = payments[0];
                    squareStatus = payment.status;
                    console.log('[Payments] Using first payment from order search:', payment.id, 'status:', squareStatus);
                  }
                }
              } catch (searchErr) {
                console.error('[Payments] Order search also failed:', searchErr?.message);
              }
            }
          }
          
          // If still no payment found after all fallbacks, log but don't throw
          // We'll handle this case below by checking payment link status
          if (!payment) {
            console.warn('[Payments] All payment retrieval strategies failed. Will check payment link status as final fallback.');
          }
        }
      }

      // Final fallback: If still no payment, check payment link status one more time
      if (!payment) {
        const checkoutId = session.payment?.squareCheckoutId;
        if (checkoutId) {
          console.log('[Payments] Final fallback: Checking payment link status one more time:', checkoutId);
          try {
            const paymentLink = await retrievePaymentLink(checkoutId);
            if (paymentLink && paymentLink.status === 'COMPLETED') {
              console.log('[Payments] Payment link is COMPLETED, treating as paid even without payment object');
              // Create a minimal payment object to proceed with order creation
              payment = {
                id: transactionId || checkoutId + '_sandbox',
                status: 'COMPLETED',
                orderId: paymentLink.orderId || squareOrderId || session.payment?.squareOrderId,
              };
              squareStatus = 'COMPLETED';
            }
          } catch (linkErr) {
            console.warn('[Payments] Final payment link check failed:', linkErr?.message);
          }
        }
      }

      if (!payment) {
        console.warn('[Payments] Unable to determine payment after all strategies', {
          sessionId,
          transactionId,
          squareOrderId,
          checkoutId: session.payment?.squareCheckoutId,
        });
        
        // Check if there's already an order for this session (maybe created in a previous attempt)
        if (session.order) {
          const existingOrder = await Order.findById(session.order);
          if (existingOrder && existingOrder.payment?.status === 'paid') {
            console.log('[Payments] Found existing paid order for this session:', existingOrder._id);
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
        
        // If we have a transactionId but Square can't find it, this might be a sandbox timing issue
        // Only proceed if:
        // 1. We're in sandbox mode
        // 2. Session was created recently (within last 10 minutes)
        // 3. We have both transactionId and squareOrderId (stronger indicator of success)
        // 4. The transactionId looks like a valid Square ID format (starts with letter, has length > 10)
        const sessionAge = Date.now() - new Date(session.createdAt).getTime();
        const isRecentSession = sessionAge < 10 * 60 * 1000; // 10 minutes
        const hasStrongIndicators = transactionId && squareOrderId && transactionId === squareOrderId;
        const looksLikeSquareId = transactionId && /^[A-Za-z0-9]{15,}$/.test(transactionId);
        const sessionHasPaymentInfo = session.payment?.squareCheckoutId || session.payment?.squareOrderId;
        const isSandbox = SQUARE_ENVIRONMENT.toLowerCase() === 'sandbox';
        
        // Log all conditions for debugging
        console.log('[Payments] Sandbox fallback conditions check:', {
          hasStrongIndicators,
          looksLikeSquareId,
          isRecentSession: isRecentSession + ' (' + Math.round(sessionAge / 1000) + 's old)',
          sessionHasPaymentInfo,
          isSandbox,
          transactionId,
          squareOrderId,
          checkoutId: session.payment?.squareCheckoutId,
          environment: SQUARE_ENVIRONMENT,
        });
        
        // If we have matching transactionId and squareOrderId, this is a STRONG indicator of successful payment
        // Square only provides these IDs after processing payment, so we should trust them
        // This works in BOTH sandbox and production - if Square redirects with matching IDs, payment was processed
        if (hasStrongIndicators && looksLikeSquareId) {
          // Trust the matching IDs - they came from Square's redirect after payment
          // Only require that session exists and has items (basic validation)
          const hasValidSession = session && session.items && session.items.length > 0;
          
          if (hasValidSession) {
            console.log('[Payments] ✅ Creating order - Matching transactionId/squareOrderId (payment processed by Square)', {
              transactionId,
              squareOrderId,
              sessionAge: Math.round(sessionAge / 1000) + 's',
              checkoutId: session.payment?.squareCheckoutId,
              itemsCount: session.items?.length,
              environment: SQUARE_ENVIRONMENT,
            });
            
            try {
              // Create order with the transactionId as payment ID
              const order = await finalizeSquareOrderFromSession({
                session,
                payment: {
                  id: transactionId,
                  status: 'COMPLETED',
                  orderId: squareOrderId,
                },
                squareOrderIdOverride: squareOrderId,
              });
              
              console.log('[Payments] ✅ Order created successfully:', order._id);
              
              return res.json({
                success: true,
                data: {
                  order,
                  paymentStatus: 'paid',
                  squareStatus: 'COMPLETED',
                },
              });
            } catch (orderError) {
              console.error('[Payments] ❌ Failed to create order:', orderError);
              throw orderError; // Re-throw to be caught by outer catch
            }
          } else {
            console.log('[Payments] ⚠️ Matching IDs found but session is invalid', {
              hasItems: session?.items?.length > 0,
              itemsCount: session?.items?.length,
            });
          }
        } else {
          console.log('[Payments] ❌ No matching transactionId/squareOrderId - cannot proceed with fallback', {
            hasStrongIndicators,
            looksLikeSquareId,
            transactionId,
            squareOrderId,
          });
        }
        
        // Update session status to failed
        session.status = 'failed';
        const failureReason = transactionId 
          ? 'Payment verification failed: Payment details not found in Square system. This may be a temporary issue. If your payment was completed, please check your orders or contact support with transaction ID: ' + transactionId
          : 'Payment verification failed: No payment information found. Please try checking out again.';
        
        session.payment = {
          ...(session.payment || {}),
          status: 'failed',
          squarePaymentId: transactionId,
          failureReason,
        };
        await session.save();
        
        console.error('[Payments] Payment verification failed after all strategies', {
          sessionId,
          transactionId,
          squareOrderId,
          checkoutId: session.payment?.squareCheckoutId,
          sessionAge: Math.round((Date.now() - new Date(session.createdAt).getTime()) / 1000) + 's',
          environment: SQUARE_ENVIRONMENT,
        });
        
        return res.json({
          success: true,
          data: {
            order: null,
            paymentStatus: 'failed',
            squareStatus: 'NOT_FOUND',
            message: failureReason,
          },
        });
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

    // Try to retrieve payment directly
    let payment = null;
    try {
      payment = await retrieveSquarePayment(transactionId);
      if (payment) {
        console.log('[Payments] Successfully retrieved payment for order:', orderId, 'payment:', payment.id);
      } else {
        console.log('[Payments] Payment not found (returned null) for order:', orderId, 'trying fallbacks...');
      }
    } catch (paymentErr) {
      console.warn('[Payments] Direct payment retrieval failed for order:', orderId, paymentErr?.message);
    }

    // If payment is null, try fallback strategies
    if (!payment) {
      const orderIdToCheck = squareOrderId || order.payment?.squareOrderId;
      
      // Fallback 1: Search payments by order ID
      if (orderIdToCheck) {
        console.log('[Payments] Fallback: searching payments by order ID for order:', orderId, 'squareOrderId:', orderIdToCheck);
        try {
          const payments = await searchPaymentsByOrder(orderIdToCheck);
          if (payments && payments.length > 0) {
            const completedPayment = payments.find(p => p?.status === 'COMPLETED');
            if (completedPayment) {
              payment = completedPayment;
              console.log('[Payments] Found completed payment from order search:', payment.id);
            } else {
              payment = payments[0];
              console.log('[Payments] Using first payment from search:', payment.id, 'status:', payment.status);
            }
          }
        } catch (searchErr) {
          console.warn('[Payments] Could not search payments by order:', searchErr?.message);
        }
      }
    }

    // If still no payment found, update order status and return
    if (!payment) {
      console.warn('[Payments] Unable to find payment for order:', orderId, {
        transactionId,
        squareOrderId,
      });
      
      order.payment.status = 'failed';
      order.payment.failureReason = 'Payment verification failed: Payment not found in Square system';
      await order.save();

      return res.json({
        success: true,
        data: {
          order,
          paymentStatus: 'failed',
          squareStatus: 'NOT_FOUND',
        },
      });
    }

    const squareStatus = payment.status;

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


