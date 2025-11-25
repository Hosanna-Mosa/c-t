const renderUrl = 'https://api2.brelis.in/api';
const local = "http://localhost:8000/api";

const BASE = false ? local : renderUrl;
export const API_BASE_URL = BASE;

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

async function request(path: string, opts: { method?: Method; body?: any; isForm?: boolean } = {}) {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!opts.isForm) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method: opts.method || 'GET',
    headers,
    body: opts.body ? (opts.isForm ? opts.body : JSON.stringify(opts.body)) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();
  
  if (!res.ok) {
    const message = (data && (data.message || data.error)) || res.statusText || 'Request failed';
    const status = res.status;
    throw { message, status };
  }
  return data;
}

export const fetchProducts = async () => {
  const res = await request('/products');
  return (res as any).data;
};

export const fetchCasualProducts = async () => {
  const res = await request('/casual-products');
  return (res as any).data;
};

export const fetchDTFProducts = async () => {
  const res = await request('/dtf-products');
  return (res as any).data;
};

export const fetchCasualProductBySlug = async (slug: string) => {
  const res = await request(`/casual-products/slug/${slug}`);
  return (res as any).data;
};

export const fetchTemplates = async () => {
  const res = await request('/templates');
  return (res as any).data;
};

export const fetchProductBySlug = async (slug: string) => {
  const res = await request(`/products/${slug}`);
  return (res as any).data;
};

export const fetchDTFProductBySlug = async (slug: string) => {
  const res = await request(`/dtf-products/slug/${slug}`);
  return (res as any).data;
};

export const signup = async (data: { name: string; email: string; password: string }) => {
  return request('/auth/signup', { method: 'POST', body: data });
};

export const login = async (data: { email: string; password: string }) => {
  return request('/auth/login', { method: 'POST', body: data });
};

export const forgotPassword = async (data: { email: string }) => {
  return request('/auth/forgot-password', { method: 'POST', body: data });
};

export const resetPassword = async (data: { email: string; code: string; newPassword: string }) => {
  return request('/auth/reset-password', { method: 'POST', body: data });
};

export const getMe = async () => request('/auth/me');
export const updateMe = async (body: { name?: string }) => request('/auth/me', { method: 'PUT', body });
export const addAddress = async (addr: any) => request('/auth/me/addresses', { method: 'POST', body: addr });
export const updateAddress = async (id: string, addr: any) => request(`/auth/me/addresses/${id}`, { method: 'PUT', body: addr });
export const deleteAddress = async (id: string) => request(`/auth/me/addresses/${id}`, { method: 'DELETE' });

// Designs
export const saveMyDesign = async (design: any) => request('/auth/me/designs', { method: 'POST', body: design });
export const getMyDesigns = async () => {
  const res = await request('/auth/me/designs');
  return (res as any).data;
};
export const getMyDesignById = async (id: string) => {
  const res = await request(`/auth/me/designs/${id}`);
  return (res as any).data;
};
export const deleteMyDesign = async (id: string) => {
  return request(`/auth/me/designs/${id}`, { method: 'DELETE' });
};

// Cart API functions
export const addToCart = async (cartItem: any) => {
  return request('/auth/me/cart', { method: 'POST', body: cartItem });
};

export const getCart = async () => {
  const res = await request('/auth/me/cart');
  return (res as any).data;
};

export const updateCartItem = async (itemId: string, quantity: number) => {
  return request(`/auth/me/cart/${itemId}`, { method: 'PUT', body: { quantity } });
};

export const removeFromCart = async (itemId: string) => {
  return request(`/auth/me/cart/${itemId}`, { method: 'DELETE' });
};

export const clearCart = async () => {
  return request('/auth/me/cart', { method: 'DELETE' });
};

// Order API functions
export const createOrderFromCart = async (orderData: any) => {
  return request('/orders/from-cart', { method: 'POST', body: orderData });
};

// Settings
export const getSettings = async () => {
  const res = await request('/settings');
  return (res as any).data;
};

export const adminAddProduct = async (form: FormData) => {
  return request('/products', { method: 'POST', body: form, isForm: true });
};

export const adminUpdateProduct = async (id: string, form: FormData) => {
  return request(`/products/${id}`, { method: 'PUT', body: form, isForm: true });
};

export const adminDeleteProduct = async (id: string) => {
  return request(`/products/${id}`, { method: 'DELETE' });
};

// Orders
export const createOrder = async (body: { productId: string; quantity?: number; paymentMethod: 'cod' | 'square'; shippingAddress?: any }) => {
  return request('/orders', { method: 'POST', body });
};

export const myOrders = async () => {
  const res = await request('/orders/mine');
  return (res as any).data;
};

// Coupons
export const getActiveCoupons = async () => {
  const res = await request('/coupons/active');
  return (res as any).data;
};

export const applyCoupon = async (code: string, totalAmount: number) => {
  const res = await request('/coupons/apply', {
    method: 'POST',
    body: { code, totalAmount },
  });
  return (res as any).data;
};

// Shipping
export const getShippingRate = async (destination: any, weight?: number, serviceCode?: string) => {
  const res = await request('/shipping/rate', {
    method: 'POST',
    body: { destination, weight, serviceCode },
  });
  return (res as any).data;
};

export const getTransitTime = async (destination: any, shipDate?: string) => {
  const res = await request('/shipping/transit', {
    method: 'POST',
    body: { destination, shipDate },
  });
  return (res as any).data;
};

export const getAllShippingOptions = async (destination: any, weight?: number) => {
  const res = await request('/shipping/options', {
    method: 'POST',
    body: { destination, weight },
  });
  return (res as any).data;
};

export const verifySquarePayment = async (payload: {
  sessionId?: string;
  orderId?: string;
  transactionId?: string;
  squareOrderId?: string;
  status?: string;
}) => {
  const res = await request('/payments/square/verify', {
    method: 'POST',
    body: payload,
  });
  return (res as any).data;
};

// Tracking
export const getTrackingDetails = async (trackingNumber: string) => {
  const res = await request(`/tracking/${trackingNumber}`);
  return (res as any).data;
};

export const getOrderTrackingDetails = async (orderId: string) => {
  const res = await request(`/tracking/order/${orderId}`);
  return (res as any).data;
};

export default { request };


