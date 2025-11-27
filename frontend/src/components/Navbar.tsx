import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShoppingCart, User, Menu, X, Phone } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/contexts/CartContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { isAuthenticated, logout } = useAuth();
  const { cartCount } = useCart();
  
  const isActive = (path: string) => location.pathname === path;
  
  const navLinks = [
    { name: "Custom T-shirts", path: "/" },
    { name: "Design Lab", path: "/customize" },
    { name: "Products", path: "/products" },
    { name: "DTF", path: "/dtf" },
  ];

  return (
    <>
      <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        {/* Top bar */}
        <div className="border-b bg-muted/30">
          <div className="container mx-auto flex h-10 items-center justify-between px-4 text-sm">
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground hidden sm:inline">Custom T-shirts & Promotional Products</span>
              <span className="text-muted-foreground sm:hidden">Custom T-shirts</span>
            </div>
            <div className="flex items-center gap-4">
              <a 
                href="tel:8552712660" 
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <Phone className="h-4 w-4" />
                <span className="hidden sm:inline">855-271-2660</span>
                <span className="sm:hidden text-xs">Call</span>
              </a>
            </div>
          </div>
        </div>

        {/* Main nav */}
        <div className="w-full">
          <div className="flex h-16 items-center justify-between px-4 md:px-6">
            {/* Logo - positioned at far left */}
            <Link to="/" className="flex items-center gap-1 sm:gap-2 transition-opacity hover:opacity-80 flex-shrink-0">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary">
                <span className="text-lg sm:text-xl font-bold text-primary-foreground">T</span>
              </div>
              <span className="text-lg sm:text-xl font-bold">
                <span className="text-primary">Custom</span>Tees
              </span>
            </Link>

            {/* Desktop Nav - centered */}
            <div className="hidden items-center gap-1 md:flex absolute left-1/2 transform -translate-x-1/2">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={cn(
                    "px-4 py-2 text-sm font-medium transition-colors rounded-md",
                    isActive(link.path)
                      ? "bg-primary/10 text-primary"
                      : "text-foreground/80 hover:bg-muted hover:text-foreground"
                  )}
                >
                  {link.name}
                </Link>
              ))}
            </div>

            {/* Right actions - positioned at far right */}
            <div className="flex items-center gap-2 sm:gap-2 flex-shrink-0">
              {!isAuthenticated ? (
                <div className="hidden sm:flex items-center gap-2">
                  <Link to="/login">
                    <Button variant="ghost" size="sm" className={cn(isActive('/login') && 'bg-primary/10 text-primary')}>Login</Button>
                  </Link>
                  <Link to="/signup">
                    <Button size="sm">Sign up</Button>
                  </Link>
                </div>
              ) : (
                // Profile dropdown - hidden on mobile, shown on desktop
                <div className="hidden md:block">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10">
                        <User className="h-4 w-4 sm:h-5 sm:w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link to="/profile">Profile</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/orders">Orders</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={logout}>Logout</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
              <Link to="/cart">
                <Button variant="ghost" size="icon" className="relative h-8 w-8 sm:h-10 sm:w-10 -mr-1 sm:mr-0">
                  <ShoppingCart className="h-4 w-4 sm:h-5 gap-2 sm:w-5" />
                  {cartCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                      {cartCount}
                    </span>
                  )}
                </Button>
              </Link>
              
              {/* Mobile menu button - positioned at the right corner */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-8 w-8"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile menu - rendered via portal at document root level */}
      {mobileMenuOpen && createPortal(
        <>
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 bg-black/50 z-[9998] md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          
          {/* Sliding menu from right */}
          <div className="fixed top-0 right-0 bottom-0 w-[280px] bg-background shadow-lg z-[9999] md:hidden animate-in slide-in-from-right duration-300">
            <div className="flex flex-col h-full">
              {/* Menu header */}
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                    <span className="text-lg font-bold text-primary-foreground">T</span>
                  </div>
                  <span className="text-lg font-bold">
                    <span className="text-primary">Custom</span>Tees
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Menu content */}
              <div className="flex-1 overflow-y-auto py-4">
                <div className="flex flex-col gap-1 px-4">
                  {navLinks.map((link) => (
                    <Link
                      key={link.path}
                      to={link.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "rounded-md px-4 py-3 text-sm font-medium transition-colors",
                        isActive(link.path)
                          ? "bg-primary/10 text-primary"
                          : "text-foreground/80 hover:bg-muted"
                      )}
                    >
                      {link.name}
                    </Link>
                  ))}
                  
                  {/* Orders link - always visible in mobile menu */}
                  {isAuthenticated && (
                    <Link
                      to="/orders"
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "rounded-md px-4 py-3 text-sm font-medium transition-colors",
                        isActive('/orders')
                          ? "bg-primary/10 text-primary"
                          : "text-foreground/80 hover:bg-muted"
                      )}
                    >
                      Orders
                    </Link>
                  )}
                  
                  {!isAuthenticated ? (
                    <div className="flex flex-col gap-2 mt-4 pt-4 border-t">
                      <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                        <Button variant="outline" className="w-full justify-start">
                          Login
                        </Button>
                      </Link>
                      <Link to="/signup" onClick={() => setMobileMenuOpen(false)}>
                        <Button className="w-full">Sign up</Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1 mt-4 pt-4 border-t">
                      <Link 
                        to="/profile" 
                        onClick={() => setMobileMenuOpen(false)} 
                        className="rounded-md px-4 py-3 text-sm font-medium text-foreground/80 hover:bg-muted"
                      >
                        Profile
                      </Link>
                      <Button 
                        variant="ghost" 
                        onClick={() => { setMobileMenuOpen(false); logout(); }} 
                        className="justify-start text-sm font-medium"
                      >
                        Logout
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
};
