import { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchCasualProducts } from "@/lib/api";
import { useNavigate } from "react-router-dom";

type CasualProduct = {
  _id: string;
  name: string;
  slug: string;
  category: string;
  description?: string;
  price: number;
  colors: string[];
  sizes: string[];
  images?: { url: string }[];
  metadata?: {
    material?: string;
    fit?: string;
    careInstructions?: string;
  };
};

const parseList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry).trim().replace(/^[\"\[]+|[\"\]]+$/g, ''))
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((entry) => String(entry).trim())
          .filter(Boolean);
      }
    } catch (_) {
      // ignore and fall back
    }
    return trimmed
      .replace(/^\[|\]$/g, '')
      .split(',')
      .map((entry) => entry.replace(/['"]/g, '').trim())
      .filter(Boolean);
  }
  return [];
};

const normalizeProduct = (raw: any): CasualProduct => ({
  _id: raw?._id,
  name: raw?.name ?? '',
  slug: raw?.slug ?? '',
  category: raw?.category ?? '',
  description: raw?.description ?? '',
  price: typeof raw?.price === 'string' ? Number(raw.price) : Number(raw?.price ?? 0),
  colors: parseList(raw?.colors),
  sizes: parseList(raw?.sizes),
  images: Array.isArray(raw?.images) ? raw.images : [],
  metadata: raw?.metadata ?? {},
});

export default function Products() {
  const [products, setProducts] = useState<CasualProduct[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchCasualProducts();
        const normalized = Array.isArray(data) ? data.map(normalizeProduct) : [];
        setProducts(normalized);
        setError(null);
        if (normalized.length) {
          const categories = new Set(normalized.map((item) => item.category).filter(Boolean));
          if (!categories.has(selectedCategory) && selectedCategory !== "All") {
            setSelectedCategory("All");
          }
        }
      } catch (err: any) {
        setError(err?.message || "Failed to load products");
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(products.map((product) => product.category).filter(Boolean)));
    return ["All", ...unique];
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (selectedCategory === "All") return products;
    return products.filter((product) => product.category === selectedCategory);
  }, [products, selectedCategory]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background via-background to-muted/10">
      <Navbar />

      <section className="container mx-auto flex-1 px-4 py-8 md:py-12">
        <header className="mx-auto mb-10 max-w-3xl text-center">
          <Badge variant="secondary" className="mb-4 rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-widest">
            New Collection
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Discover Our Casual Apparel Range
          </h1>
          <p className="mt-4 text-sm text-muted-foreground sm:text-base">
            Browse premium-quality tees, hoodies, polos, hats and more. Handpicked styles ready to order and perfect for everyday comfort.
          </p>
        </header>

        <div className="mb-8 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {categories.map((category) => (
            <Button
              key={category}
              size="sm"
              variant={selectedCategory === category ? "default" : "outline"}
              className="rounded-full px-4 text-xs sm:text-sm"
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Card key={index} className="overflow-hidden border-2 border-dashed border-muted-foreground/10">
                <div className="aspect-square animate-pulse bg-muted/60" />
                <CardContent className="space-y-2 p-4">
                  <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
                  <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                  <div className="h-9 w-full animate-pulse rounded bg-muted" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 text-center text-destructive">
            {error}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-muted p-12 text-center">
            <h3 className="text-lg font-semibold text-foreground">No products found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Try selecting a different category or check back soon for new arrivals.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product) => {
              const imageUrl = product.images?.[0]?.url || "/placeholder.svg";
              return (
                <Card
                  key={product._id}
                  className="group flex h-full flex-col overflow-hidden border-2 border-transparent transition hover:border-primary/40 hover:shadow-lg"
                >
                  <button
                    type="button"
                    className="relative aspect-square overflow-hidden"
                    onClick={() => navigate(`/products/${product.slug}`)}
                  >
                    <img
                      src={imageUrl}
                      alt={product.name}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    <span className="absolute left-4 top-4 rounded-full bg-background/80 px-3 py-1 text-xs font-semibold uppercase shadow">
                      {product.category}
                    </span>
                  </button>
                  <CardContent className="flex flex-1 flex-col gap-3 p-4">
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold text-foreground line-clamp-2">{product.name}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {product.description || "Comfort-first styling crafted for everyday wear."}
                      </p>
                    </div>

                    <div className="mt-auto space-y-2">
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>{product.colors?.length || 0} colors</span>
                        <span>{product.sizes?.length || 0} sizes</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xl font-bold text-primary">${product.price.toFixed(2)}</span>
                        <Button
                          size="sm"
                          className="rounded-full px-4 text-xs"
                          onClick={() => navigate(`/products/${product.slug}`)}
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}
