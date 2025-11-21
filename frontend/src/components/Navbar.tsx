import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShoppingCart, User, Menu, X, Search, Phone } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/contexts/CartContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SearchModal } from "@/components/SearchModal";

export const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();
  const { isAuthenticated, logout } = useAuth();
  const { cartCount } = useCart();
  
  const isActive = (path: string) => location.pathname === path;
  
  const navLinks = [
    { name: "Custom T-shirts", path: "/" },
    { name: "Design Lab", path: "/customize" },
    { name: "Products", path: "/products" },
    { name: "DTF", path: "/dtf" },
    { name: "My Designs", path: "/my-designs" },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Top bar */}
      <div className="border-b bg-muted/30">
        <div className="container mx-auto flex h-10 items-center justify-between px-4 text-sm">
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground hidden sm:inline">Custom T-shirts & Promotional Products</span>
            <span className="text-muted-foreground sm:hidden">Custom T-shirts</span>
          </div>
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <Phone className="h-4 w-4" />
              <span className="hidden sm:inline">855-271-2660</span>
              <span className="sm:hidden text-xs">Call</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main nav */}
      <div className="container mx-auto">
        <div className="flex h-16 items-center justify-between px-2 sm:px-2">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-1 sm:gap-2 transition-opacity hover:opacity-80">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary">
              <span className="text-lg sm:text-xl font-bold text-primary-foreground">T</span>
            </div>
            <span className="text-lg sm:text-xl font-bold">
              <span className="text-primary">Custom</span>Tees
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden items-center gap-1 md:flex">
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

          {/* Right actions */}
          <div className="flex items-center gap-2 sm:gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="hidden sm:flex"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10 ">
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
            )}
            <Link to="/cart">
              <Button variant="ghost" size="icon" className="relative h-8 w-8 sm:h-10 sm:w-10  -mr-1 sm:mr-0">
                <ShoppingCart className="h-4 w-4 sm:h-5 gap-2 sm:w-5" />
                {cartCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                    {cartCount}
                  </span>
                )}
              </Button>
            </Link>
            
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-8 w-8"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-4 w-4" />
              ) : (
                <Menu className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="border-t py-4 md:hidden">
            <div className="flex flex-col gap-2 px-4">
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
              {/* Mobile Search */}
              <Button 
                variant="outline" 
                onClick={() => { setMobileMenuOpen(false); setSearchOpen(true); }}
                className="w-full justify-start"
              >
                <Search className="h-4 w-4 mr-2" />
                Search Products
              </Button>
              
              {!isAuthenticated ? (
                <div className="flex flex-col gap-2">
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="rounded-md px-4 py-3 text-sm font-medium hover:bg-muted">
                    Login
                  </Link>
                  <Link to="/signup" onClick={() => setMobileMenuOpen(false)}>
                    <Button className="w-full">Sign up</Button>
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link to="/profile" onClick={() => setMobileMenuOpen(false)} className="rounded-md px-4 py-3 text-sm font-medium hover:bg-muted">Profile</Link>
                  <Button variant="ghost" onClick={() => { setMobileMenuOpen(false); logout(); }} className="justify-start">Logout</Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Search Modal */}
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </nav>
  );
};
