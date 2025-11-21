import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./hooks/use-auth";
import { CartProvider } from "./contexts/CartContext";
import { ScrollToTop } from "./components/ScrollToTop";
import Home from "./pages/Home";
import Customize from "./pages/Customize";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import DTF from "./pages/DTF";
import DTFDetail from "./pages/DTFDetail";
import Cart from "./pages/Cart";
import NotFound from "./pages/NotFound";
import Checkout from "./pages/Checkout";
import Payments from "./pages/Payments";
import Orders from "./pages/Orders";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import Profile from "./pages/Profile.tsx";
import Track from "./pages/Track";
import MyDesigns from "./pages/MyDesigns";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <AuthProvider>
          <CartProvider>
            <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/customize" element={<Customize />} />
            <Route path="/products" element={<Products />} />
            <Route path="/products/:slug" element={<ProductDetail />} />
            <Route path="/dtf" element={<DTF />} />
            <Route path="/dtf/:slug" element={<DTFDetail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/payments/square-result" element={<Payments />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/track" element={<Track />} />
            <Route path="/track/:trackingNumber" element={<Track />} />
            <Route path="/my-designs" element={<MyDesigns />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
