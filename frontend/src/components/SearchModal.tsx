import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, X, Shirt, Palette } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchProducts } from '@/lib/api';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResult {
  id: string;
  name: string;
  type: 'product' | 'template';
  category?: string;
  price?: number;
  image?: string;
  description?: string;
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetchProducts()
        .then((data) => setProducts(data || []))
        .catch(() => setProducts([]));
    }
  }, [isOpen]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    
    // Simulate search delay
    const timeoutId = setTimeout(() => {
      const searchResults: SearchResult[] = [];
      
      // Search products
      const productResults = products
        .filter((product) => 
          product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.category?.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .slice(0, 5)
        .map((product) => ({
          id: product._id || product.id,
          name: product.name,
          type: 'product' as const,
          category: product.category,
          price: product.price,
          image: product.images?.[0]?.url || product.image,
          description: product.description,
        }));

      searchResults.push(...productResults);

      // Add template suggestions
      const templateSuggestions = [
        { name: 'Business Logo Design', type: 'template' as const, category: 'Business' },
        { name: 'Vintage Band Tee', type: 'template' as const, category: 'Vintage' },
        { name: 'Minimalist Quote', type: 'template' as const, category: 'Minimalist' },
        { name: 'Sports Team Pride', type: 'template' as const, category: 'Sports' },
      ].filter((template) => 
        template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.category.toLowerCase().includes(searchTerm.toLowerCase())
      ).slice(0, 3);

      searchResults.push(...templateSuggestions);

      setResults(searchResults);
      setLoading(false);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, products]);

  const handleResultClick = () => {
    setSearchTerm('');
    setResults([]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Products & Templates
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search for products, templates, or categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10"
              autoFocus
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8"
                onClick={() => setSearchTerm('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Search Results */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
              </div>
            ) : searchTerm && results.length === 0 ? (
              <div className="text-center py-8">
                <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No results found for "{searchTerm}"</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Try searching for products, templates, or categories
                </p>
              </div>
            ) : results.length > 0 ? (
              <div className="space-y-2">
                {results.map((result, index) => (
                  <Card key={`${result.type}-${index}`} className="hover:bg-muted/50 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex-shrink-0">
                          {result.type === 'product' ? (
                            <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                              {result.image ? (
                                <img 
                                  src={result.image} 
                                  alt={result.name}
                                  className="w-full h-full object-cover rounded-lg"
                                />
                              ) : (
                                <Shirt className="h-6 w-6 text-muted-foreground" />
                              )}
                            </div>
                          ) : (
                            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                              <Palette className="h-6 w-6 text-primary" />
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium truncate">{result.name}</h3>
                            <Badge variant="outline" className="text-xs">
                              {result.type === 'product' ? 'Product' : 'Template'}
                            </Badge>
                          </div>
                          
                          {result.category && (
                            <p className="text-sm text-muted-foreground mb-1">
                              {result.category}
                            </p>
                          )}
                          
                          {result.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {result.description}
                            </p>
                          )}
                          
                          {result.price && (
                            <p className="text-sm font-medium text-primary mt-1">
                              From ${Number(result.price).toFixed(2)}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex-shrink-0">
                          {result.type === 'product' ? (
                            <Link to="/products" onClick={handleResultClick}>
                              <Button size="sm" variant="outline">
                                View
                              </Button>
                            </Link>
                          ) : (
                            <Link to="/templates" onClick={handleResultClick}>
                              <Button size="sm" variant="outline">
                                Browse
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Start typing to search</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Search for products, templates, or categories
                </p>
              </div>
            )}
          </div>

          {/* Quick Links */}
          {!searchTerm && (
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Quick Links</h4>
              <div className="grid grid-cols-2 gap-2">
                <Link to="/products" onClick={handleResultClick}>
                  <Button variant="outline" className="w-full justify-start">
                    <Shirt className="h-4 w-4 mr-2" />
                    All Products
                  </Button>
                </Link>
                <Link to="/templates" onClick={handleResultClick}>
                  <Button variant="outline" className="w-full justify-start">
                    <Palette className="h-4 w-4 mr-2" />
                    Templates
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
