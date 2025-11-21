import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Trash2, ShoppingBag, ArrowRight, Shield } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router-dom";

export default function Cart() {
  const { cartItems, loading, updateItemQuantity, removeItemFromCart, clearCartItems } = useCart();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  const subtotal = cartItems.reduce((sum, item) => sum + (item.totalPrice * item.quantity), 0);
  const shipping = subtotal > 50 ? 0 : 5.99;
  const total = subtotal + shipping;

  const handleRemoveItem = (itemId: string) => {
    removeItemFromCart(itemId);
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      toast.error("Your cart is empty");
      return;
    }
    navigate('/checkout');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="container mx-auto px-4 py-20 flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading cart...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="container mx-auto px-4 py-20 flex-1">
          <div className="mx-auto max-w-md text-center">
            <ShoppingBag className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
            <h1 className="mb-2 text-2xl font-bold">Your Cart is Empty</h1>
            <p className="mb-6 text-muted-foreground">
            Start shopping to add items to your cart!
            </p>
            <Button asChild>
              <a href="/customize">Start Designing</a>
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/20">
      <Navbar />

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-8 flex-1">
        <div className="mb-4 sm:mb-6 md:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Shopping Cart</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            {cartItems.length} {cartItems.length === 1 ? 'item' : 'items'} in your cart
          </p>
        </div>

        <div className="flex flex-col lg:flex-row lg:gap-6 xl:gap-8">
          {/* Cart Items - Mobile First Design */}
          <div className="flex-1 space-y-3 sm:space-y-4 mb-4 lg:mb-0">
            {cartItems.map((item) => (
              <Card key={item._id} className="overflow-hidden border-2 hover:shadow-lg transition-all duration-200">
                <CardContent className="p-3 sm:p-4 md:p-6">
                {(() => {
                  const isDTF = item.productType === "dtf";
                  const previewImage =
                    item.dtfPrintFile?.preview ||
                    item.dtfPrintFile?.url ||
                    item.frontDesign?.previewImage ||
                    item.backDesign?.previewImage ||
                    item.customDesign?.frontDesign?.previewImage ||
                    item.customDesign?.backDesign?.previewImage ||
                    item.productImage;
                  return (
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 md:gap-6">
                    {/* Product Image */}
                    <div className="w-full sm:w-24 md:w-32 h-40 sm:h-24 md:h-32 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-muted to-muted/50 shadow-md">
                      {previewImage ? (
                        <img
                          src={previewImage}
                          alt={item.productName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs">
                          No Preview
                        </div>
                      )}
                    </div>

                    {/* Product Details */}
                    <div className="flex flex-1 flex-col justify-between min-w-0">
                      <div className="space-y-1.5 sm:space-y-2">
                        <h3 className="text-base sm:text-lg font-bold text-foreground line-clamp-2">
                          {item.productName}
                        </h3>
                        {!isDTF && (
                          <div className="flex flex-wrap gap-2 text-xs sm:text-sm text-muted-foreground">
                            {item.selectedSize && (
                              <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium">
                                Size: {item.selectedSize}
                              </span>
                            )}
                            {item.selectedColor && (
                              <span className="px-2 py-0.5 bg-secondary/50 rounded-full">
                                {item.selectedColor}
                              </span>
                            )}
                          </div>
                        )}
                        {isDTF ? (
                          <div className="rounded-xl border border-dashed border-muted-foreground/40 bg-muted/20 p-3 text-xs sm:text-sm text-muted-foreground">
                            <p className="font-semibold text-foreground">Print ready file attached</p>
                            {item.dtfPrintFile?.fileName && (
                              <p className="truncate text-xs mt-1">File: {item.dtfPrintFile.fileName}</p>
                            )}
                            <p className="mt-1">
                              Unit Cost: <span className="font-semibold text-foreground">${item.basePrice.toFixed(2)}</span>
                            </p>
                          </div>
                        ) : (
                          <div className="text-xs sm:text-sm text-muted-foreground space-y-0.5">
                            <p>
                              Base: <span className="font-medium text-foreground">${item.basePrice.toFixed(2)}</span>
                            </p>
                            {(item.frontCustomizationCost ?? 0) > 0 && (
                              <p>
                                Front Design: <span className="font-medium text-foreground">${(item.frontCustomizationCost ?? 0).toFixed(2)}</span>
                              </p>
                            )}
                            {(item.backCustomizationCost ?? 0) > 0 && (
                              <p>
                                Back Design: <span className="font-medium text-foreground">${(item.backCustomizationCost ?? 0).toFixed(2)}</span>
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Quantity and Actions */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t">
                        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                          <label className="text-xs sm:text-sm font-medium text-muted-foreground whitespace-nowrap">
                            Quantity:
                          </label>
                          <div className="flex items-center gap-1 border rounded-lg">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-r-none"
                              disabled={loading || item.quantity <= 1}
                              onClick={() => updateItemQuantity(item._id, item.quantity - 1)}
                            >
                              <span className="text-lg">−</span>
                            </Button>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              disabled={loading}
                              className="w-12 sm:w-16 h-8 text-center text-sm font-medium border-x bg-background disabled:opacity-50 focus:outline-none"
                              onChange={(e) => {
                                const newQuantity = parseInt(e.target.value) || 1;
                                updateItemQuantity(item._id, newQuantity);
                              }}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-l-none"
                              disabled={loading}
                              onClick={() => updateItemQuantity(item._id, item.quantity + 1)}
                            >
                              <span className="text-lg">+</span>
                            </Button>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
                          <div className="text-right sm:text-left">
                            <p className="text-xs text-muted-foreground">Total</p>
                            <span className="text-lg sm:text-xl font-bold text-primary">
                              ${(item.totalPrice * item.quantity).toFixed(2)}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={loading}
                            onClick={() => handleRemoveItem(item._id)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-9 w-9 sm:h-10 sm:w-10"
                          >
                            <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                  );
                })()}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Order Summary - Sticky on Desktop, Fixed Bottom on Mobile */}
          <div className="lg:w-80 xl:w-96 lg:sticky lg:top-24 lg:self-start">
            <Card className="border-2 shadow-xl">
              <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-5">
                <h2 className="text-xl sm:text-2xl font-bold text-foreground pb-2 border-b">
                  Order Summary
                </h2>

                <div className="space-y-3 border-b pb-4">
                  <div className="flex justify-between items-center text-sm sm:text-base">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-semibold text-foreground">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm sm:text-base">
                    <span className="text-muted-foreground">Shipping</span>
                    <span className={`font-semibold ${shipping === 0 ? 'text-green-600' : 'text-foreground'}`}>
                      {shipping === 0 ? "FREE" : `$${shipping.toFixed(2)}`}
                    </span>
                  </div>
                  {subtotal < 50 && (
                    <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs text-amber-700">
                        🎁 Add ${(50 - subtotal).toFixed(2)} more for free shipping!
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center pt-2">
                  <span className="text-base sm:text-lg font-bold text-foreground">Total</span>
                  <span className="text-xl sm:text-2xl font-bold text-primary">
                    ${total.toFixed(2)}
                  </span>
                </div>

                <Button
                  onClick={handleCheckout}
                  className="w-full h-11 sm:h-12 text-sm sm:text-base font-semibold gradient-hero shadow-lg hover:shadow-xl transition-all duration-200"
                  size="lg"
                >
                  Proceed to Checkout
                  <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
                </Button>

                <div className="rounded-xl bg-gradient-to-br from-muted/80 to-muted/50 p-3 sm:p-4 border border-muted-foreground/10">
                  <div className="flex items-start gap-2">
                    <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-xs sm:text-sm text-foreground">Secure Checkout</p>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        Your payment information is encrypted and secure.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
