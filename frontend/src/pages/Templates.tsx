import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { fetchProducts, fetchTemplates } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Image as ImageIcon,
  PackageSearch,
  Search,
  Shirt,
  Sparkles,
} from 'lucide-react';

interface Template {
  _id: string;
  name?: string;
  image: { url: string; public_id: string };
  createdAt: string;
  updatedAt: string;
}

interface Product {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  variants: Array<{
    color: string;
    colorCode: string;
    images: Array<{ url: string; public_id: string }>;
  }>;
}

export default function Templates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setLoading(true);
        const data = await fetchTemplates();
        setTemplates(data);
      } catch (e: any) {
        setError(e.message || 'Failed to load templates');
      } finally {
        setLoading(false);
      }
    };

    loadTemplates();
  }, []);

  const filteredTemplates = useMemo(() => {
    if (!searchTerm) return templates;
    const term = searchTerm.toLowerCase();
    return templates.filter((template) =>
      (template.name || 'template').toLowerCase().includes(term)
    );
  }, [templates, searchTerm]);

  const handleUseTemplate = async (template: Template) => {
    setSelectedTemplate(template);
    setDialogOpen(true);

    if (products.length === 0 && !productsLoading) {
      try {
        setProductsLoading(true);
        const data = await fetchProducts();
        setProducts(data);
      } catch (e: any) {
        setProductsError(e.message || 'Failed to load products');
      } finally {
        setProductsLoading(false);
      }
    }
  };

  const handleSelectProduct = (product: Product) => {
    if (!selectedTemplate) return;
    setDialogOpen(false);
    navigate('/customize', {
      state: {
        templateSelection: {
          templateId: selectedTemplate._id,
          imageUrl: selectedTemplate.image.url,
          productId: product._id,
        },
      },
    });
  };

  const handlePreview = (template: Template) => {
    window.open(template.image.url, '_blank', 'noopener');
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-48 w-full" />
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="py-6 text-center text-destructive">
            {error}
          </CardContent>
        </Card>
      );
    }

    if (filteredTemplates.length === 0) {
      return (
        <Card className="py-12 text-center">
          <CardContent className="flex flex-col items-center gap-4">
            <PackageSearch className="h-12 w-12 text-muted-foreground" />
            <div>
              <CardTitle className="text-lg">No templates found</CardTitle>
              <CardDescription>
                Try adjusting your search or check back later for new designs.
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => setSearchTerm('')}>
              Clear search
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filteredTemplates.map((template) => (
          <Card key={template._id} className="group overflow-hidden">
            <CardHeader className="p-0">
              <div className="relative">
                <img
                  src={template.image.url}
                  alt={template.name || 'Template'}
                  className="h-52 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <Badge className="absolute top-3 left-3 bg-black/80 text-white">
                  Template
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div>
                <CardTitle className="text-lg font-semibold">
                  {template.name || 'Untitled Template'}
                </CardTitle>
                <CardDescription>
                  Uploaded {new Date(template.createdAt).toLocaleDateString()}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => handleUseTemplate(template)}>
                  <Shirt className="mr-2 h-4 w-4" />
                  Use Template
                </Button>
                <Button variant="outline" onClick={() => handlePreview(template)}>
                  Preview
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <div className="container mx-auto px-4 py-6 sm:py-10 flex-1">
        <div className="max-w-6xl mx-auto space-y-8">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="flex flex-col space-y-2">
              <CardTitle className="text-2xl sm:text-3xl font-semibold flex items-center gap-2">
                <ImageIcon className="h-6 w-6 text-primary" />
                Design Templates
              </CardTitle>
              <CardDescription className="text-sm sm:text-base">
                Browse ready-made designs created by our team. Pick one, choose a
                product, and start customizing instantly.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search templates..."
                  className="pl-9"
                />
              </div>
            </CardContent>
          </Card>

          {renderContent()}

          <Card className="border-dashed border-2 border-primary/20 bg-secondary/10">
            <CardContent className="py-8 sm:py-12 text-center space-y-4">
              <Sparkles className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-primary" />
              <h2 className="text-xl sm:text-2xl font-semibold">
                Want something different?
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
                Jump into the design lab to create your own style from scratch.
                Upload images, add text, and customize every detail.
              </p>
              <Button size="lg" onClick={() => navigate('/customize')}>
                Start Custom Design
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Footer />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Select a product</DialogTitle>
            <DialogDescription>
              Choose where you want to apply this template. You can still change
              colors and sizes in the next step.
            </DialogDescription>
          </DialogHeader>

          {productsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <Skeleton className="h-40 w-full" />
                  <CardContent className="p-4 space-y-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : productsError ? (
            <Card className="bg-destructive/5 border-destructive/20">
              <CardContent className="py-6 text-destructive text-center">
                {productsError}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {products.map((product) => (
                <Card key={product._id} className="flex flex-col overflow-hidden">
                  <div className="h-44 bg-muted flex items-center justify-center">
                    {product.variants?.[0]?.images?.[0]?.url ? (
                      <img
                        src={product.variants[0].images[0].url}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Shirt className="h-8 w-8" />
                        <span>No preview</span>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4 space-y-2 flex-1 flex flex-col">
                    <CardTitle className="text-lg">{product.name}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {product.description || 'Customizable apparel'}
                    </CardDescription>
                    <div className="mt-auto pt-4">
                      <Button className="w-full" onClick={() => handleSelectProduct(product)}>
                        Use on this product
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

