import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getCart, addToCart, updateCartItem, removeFromCart, clearCart } from '@/lib/api';
import { toast } from 'sonner';

interface CartItem {
  _id: string;
  productId: string;
  productModel?: 'Product' | 'CasualProduct' | 'DTFProduct';
  productType?: 'custom' | 'casual' | 'dtf';
  productName: string;
  productSlug: string;
  productImage?: string;
  selectedColor?: string;
  selectedSize?: string;
  frontDesign?: {
    designData?: any;
    designLayers?: any[];
    previewImage?: string;
    metrics?: any;
  };
  backDesign?: {
    designData?: any;
    designLayers?: any[];
    previewImage?: string;
    metrics?: any;
  };
  basePrice: number;
  frontCustomizationCost?: number;
  backCustomizationCost?: number;
  totalPrice: number;
  quantity: number;
  addedAt: string;
  instruction?: string;
  dtfPrintFile?: {
    url?: string;
    preview?: string;
    fileName?: string;
    dataUrl?: string;
  };
}

interface CartContextType {
  cartItems: CartItem[];
  cartCount: number;
  loading: boolean;
  addItemToCart: (item: any) => Promise<void>;
  updateItemQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItemFromCart: (itemId: string) => Promise<void>;
  clearCartItems: () => Promise<void>;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);

  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);

  const refreshCart = async () => {
    try {
      setLoading(true);
      const items = await getCart();
      setCartItems(items || []);
    } catch (error) {
      console.error('Failed to fetch cart:', error);
      // Don't show error toast for initial load
    } finally {
      setLoading(false);
    }
  };

  const addItemToCart = async (item: any) => {
    if (loading) return; // Prevent multiple simultaneous requests
    
    try {
      setLoading(true);
      await addToCart(item);
      await refreshCart();
      toast.success('Item added to cart!');
    } catch (error) {
      console.error('Failed to add to cart:', error);
      toast.error('Failed to add item to cart');
    } finally {
      setLoading(false);
    }
  };

  const updateItemQuantity = async (itemId: string, quantity: number) => {
    try {
      setLoading(true);
      await updateCartItem(itemId, quantity);
      await refreshCart();
      toast.success('Cart updated');
    } catch (error) {
      console.error('Failed to update cart item:', error);
      toast.error('Failed to update cart item');
    } finally {
      setLoading(false);
    }
  };

  const removeItemFromCart = async (itemId: string) => {
    try {
      setLoading(true);
      await removeFromCart(itemId);
      await refreshCart();
      toast.success('Item removed from cart');
    } catch (error) {
      console.error('Failed to remove cart item:', error);
      toast.error('Failed to remove cart item');
    } finally {
      setLoading(false);
    }
  };

  const clearCartItems = async () => {
    try {
      setLoading(true);
      await clearCart();
      await refreshCart();
      toast.success('Cart cleared');
    } catch (error) {
      console.error('Failed to clear cart:', error);
      toast.error('Failed to clear cart');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshCart();
  }, []);

  const value: CartContextType = {
    cartItems,
    cartCount,
    loading,
    addItemToCart,
    updateItemQuantity,
    removeItemFromCart,
    clearCartItems,
    refreshCart,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};
