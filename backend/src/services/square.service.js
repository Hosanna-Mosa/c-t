import crypto from 'crypto';
import Square from 'square';

const { SquareClient, SquareEnvironment } = Square || {};

const {
  SQUARE_ACCESS_TOKEN,
  SQUARE_LOCATION_ID,
  SQUARE_ENVIRONMENT = 'sandbox',
  SQUARE_CURRENCY = 'USD',
} = process.env;

let squareClient = null;

if (SQUARE_ACCESS_TOKEN && SQUARE_LOCATION_ID && SquareClient && SquareEnvironment) {
  squareClient = new SquareClient({
    token: SQUARE_ACCESS_TOKEN,
    environment: SQUARE_ENVIRONMENT.toLowerCase() === 'production'
      ? SquareEnvironment.Production
      : SquareEnvironment.Sandbox,
  });
}

const SQUARE_API_BASE_URL = (SQUARE_ENVIRONMENT || 'sandbox').toLowerCase() === 'production'
  ? 'https://connect.squareup.com'
  : 'https://connect.squareupsandbox.com';

export const isSquareConfigured = () => Boolean(squareClient);

function assertSquareConfigured() {
  if (!squareClient) {
    throw new Error(
      'Square payments are not configured. Please set SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID.'
    );
  }
}

async function squareHttp(path, { method = 'GET', body } = {}) {
  if (!SQUARE_ACCESS_TOKEN) {
    throw new Error('Missing SQUARE_ACCESS_TOKEN');
  }

  const response = await fetch(`${SQUARE_API_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${SQUARE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'Square-Version': '2024-01-18',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Square API ${method} ${path} failed: ${response.status} ${text}`);
  }

  return response.json();
}

const cents = (amount = 0) => Math.max(0, Math.round(Number(amount || 0) * 100));
const toMoney = (amount, { isCents = false } = {}) => ({
  amount: BigInt(isCents ? Math.round(Number(amount || 0)) : cents(amount)),
  currency: SQUARE_CURRENCY,
});

export async function createSquareCheckoutSession({
  order,
  user,
  shippingAddress,
  redirectUrl,
}) {
  assertSquareConfigured();

  const idempotencyKey = crypto.randomUUID();

  const lineItems = (order.items || []).map((item) => ({
    name: (item.productName || 'Custom Tee').substring(0, 255),
    quantity: String(item.quantity || 1),
    note: item.productType === 'custom' ? 'Custom design' : 'Catalog item',
    basePriceMoney: toMoney(item.price),
  }));

  if (order.shippingCost && order.shippingCost > 0) {
    lineItems.push({
      name: order.shippingServiceName || 'Shipping',
      quantity: '1',
      basePriceMoney: toMoney(order.shippingCost, { isCents: true }),
    });
  }

  const discounts = [];
  const discountAmount = order?.coupon?.discountAmount || 0;
  if (discountAmount > 0) {
    discounts.push({
      name: order.coupon?.code || 'Discount',
      scope: 'ORDER',
      type: 'FIXED_AMOUNT',
      amountMoney: toMoney(discountAmount),
    });
  }

  const squareOrder = {
    locationId: SQUARE_LOCATION_ID,
    referenceId: order._id.toString(),
    lineItems,
    discounts: discounts.length ? discounts : undefined,
  };

  const checkoutClient = squareClient.checkout?.paymentLinks
    ? squareClient.checkout.paymentLinks
    : squareClient.checkout;

  if (!checkoutClient || typeof checkoutClient.create !== 'function') {
    throw new Error('Square checkout client unavailable');
  }

  const paymentLinkResponse = await checkoutClient.create({
    idempotencyKey,
    description: `CustomTees order ${order._id}`,
    order: squareOrder,
    checkoutOptions: {
      redirectUrl,
      askForShippingAddress: false,
    },
    prePopulatedData: {
      buyerEmail: user?.email,
      buyerPhoneNumber: shippingAddress?.phone,
      buyerAddress: shippingAddress
        ? {
            addressLine1: shippingAddress.line1,
            addressLine2: shippingAddress.line2,
            locality: shippingAddress.city,
            administrativeDistrictLevel1: shippingAddress.state,
            postalCode: shippingAddress.postalCode,
            country: (shippingAddress.country || 'US').toUpperCase(),
            firstName: shippingAddress.fullName?.split(' ')?.[0],
            lastName:
              shippingAddress.fullName?.split(' ')?.slice(1).join(' ') || shippingAddress.fullName,
          }
        : undefined,
    },
  });

  const paymentLink = paymentLinkResponse?.paymentLink;

  if (!paymentLink?.url) {
    throw new Error('Failed to create Square checkout session');
  }

  return {
    checkoutId: paymentLink.id,
    checkoutUrl: paymentLink.url,
    squareOrderId: paymentLink.orderId,
  };
}

export async function retrieveSquarePayment(paymentId) {
  assertSquareConfigured();
  try {
    // Try using HTTP API first (more reliable in production)
    const response = await squareHttp(`/v2/payments/${paymentId}`);
    return response?.payment || null;
  } catch (err) {
    // Check if it's a 404 error (payment not found)
    const is404 = err?.message?.includes('404') || err?.message?.includes('NOT_FOUND');
    
    if (is404) {
      console.log('[Square] Payment not found (404) - this is normal in sandbox mode, will use fallback strategies');
      // Return null instead of throwing, so caller can use fallback strategies
      return null;
    }
    
    console.warn('[Square] HTTP API payment retrieval failed, trying SDK:', err?.message);
    // Fallback to SDK if HTTP fails (and it's not a 404)
    try {
      const paymentsClient = squareClient.payments;
      if (paymentsClient && typeof paymentsClient.get === 'function') {
        const response = await paymentsClient.get({ paymentId });
        return response?.payment || null;
      }
    } catch (sdkErr) {
      console.error('[Square] SDK payment retrieval also failed:', sdkErr?.message);
    }
    
    // For non-404 errors, throw the original error
    throw err;
  }
}

export async function retrievePaymentLink(checkoutId) {
  assertSquareConfigured();
  try {
    const response = await squareHttp(`/v2/checkout/payment-links/${checkoutId}`);
    return response?.payment_link || response?.paymentLink || null;
  } catch (err) {
    console.error('[Square] Error retrieving payment link:', err?.message);
    return null;
  }
}

export async function searchPaymentsByOrder(orderId) {
  assertSquareConfigured();
  try {
    const response = await squareHttp('/v2/payments/search', {
      method: 'POST',
      body: {
        query: {
          filter: {
            orderFilter: {
              orderIds: [orderId],
            },
          },
        },
        limit: 10,
      },
    });
    return response?.payments || [];
  } catch (err) {
    console.warn('[Square] Error in searchPayments:', err?.message);
    return [];
  }
}


