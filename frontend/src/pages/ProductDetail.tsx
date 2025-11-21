import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { fetchCasualProductBySlug } from "@/lib/api";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

type ProductImage = {
  url: string;
  public_id: string;
};

type CasualProduct = {
  _id: string;
  name: string;
  slug: string;
  category: string;
  description?: string;
  price: number;
  colors: string[];
  sizes: string[];
  images: ProductImage[];
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
      // fall back to manual parsing
    }
    return trimmed
      .replace(/^\[|\]$/g, '')
      .split(',')
      .map((entry) => entry.replace(/['"]/g, '').trim())
      .filter(Boolean);
  }
  return [];
};

const normalizeProduct = (raw: any): CasualProduct => {
  return {
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
  };
};

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<CasualProduct | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [adding, setAdding] = useState<boolean>(false);
  const { addItemToCart, loading: cartBusy } = useCart();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!slug) return;
    const loadProduct = async () => {
      try {
        setLoading(true);
        const data = await fetchCasualProductBySlug(slug);
        const normalized = normalizeProduct(data);
        setProduct(normalized);
        setSelectedColor(normalized.colors[0] || "");
        setSelectedSize(normalized.sizes[0] || "");
        setSelectedImageIndex(0);
        setError(null);
      } catch (err: any) {
        setError(err?.message || "Product not found");
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };
    loadProduct();
  }, [slug]);

  const images = product?.images?.length ? product.images : [];

  const heroImage = useMemo(() => {
    if (!images.length) return "/placeholder.svg";
    return images[selectedImageIndex]?.url ?? images[0]?.url ?? "/placeholder.svg";
  }, [images, selectedImageIndex]);

  const handleAddToCart = async () => {
    if (!product) return;
    if (product.colors?.length && !selectedColor) {
      toast.error("Please select a color");
      return;
    }
    if (product.sizes?.length && !selectedSize) {
      toast.error("Please select a size");
      return;
    }
    if (quantity < 1) {
      toast.error("Quantity must be at least 1");
      return;
    }

    if (!isAuthenticated) {
      toast.info("Please login to add products to cart");
      navigate("/login", { state: { from: location.pathname } });
      return;
    }

    try {
      setAdding(true);
      await addItemToCart({
        productId: product._id,
        productModel: "CasualProduct",
        productType: "casual",
        productName: product.name,
        productSlug: product.slug,
        productImage: heroImage,
        selectedColor,
        selectedSize,
        basePrice: product.price,
        frontCustomizationCost: 0,
        backCustomizationCost: 0,
        totalPrice: product.price,
        quantity,
      });
    } catch (err: any) {
      toast.error(err?.message || "Failed to add product to cart");
    } finally {
      setAdding(false);
    }
  };

  const incrementQuantity = () => setQuantity((prev) => Math.min(prev + 1, 10));
  const decrementQuantity = () =>
    setQuantity((prev) => {
      if (prev <= 1) return 1;
      return prev - 1;
    });

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background via-background to-muted/10">
      <Navbar />

      <section className="container mx-auto flex-1 px-4 py-8 md:py-12">
        {loading ? (
          <div className="mx-auto max-w-5xl rounded-2xl border border-dashed border-muted p-12 text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-primary" />
            <p className="mt-4 text-sm text-muted-foreground">Loading product details...</p>
          </div>
        ) : error ? (
          <div className="mx-auto max-w-3xl rounded-xl border border-destructive/20 bg-destructive/10 p-8 text-center text-destructive">
            {error}
          </div>
        ) : product ? (
          <div className="grid gap-10 lg:grid-cols-[1.1fr,0.9fr]">
            <div className="space-y-6">
              <Card className="overflow-hidden border-0 shadow-lg">
                <div className="relative aspect-[4/5] bg-muted/50">
                  <img
                    src={heroImage}
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                  {product.category && (
                    <Badge className="absolute left-4 top-4 rounded-full bg-background/90 px-4 py-1 text-xs font-semibold uppercase shadow">
                      {product.category}
                    </Badge>
                  )}
                </div>
              </Card>

              {images.length > 1 && (
                <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
                  {images.map((image, index) => {
                    const isActive = index === selectedImageIndex;
                    return (
                      <button
                        key={image.public_id}
                        type="button"
                        onClick={() => setSelectedImageIndex(index)}
                        className={`relative overflow-hidden rounded-xl border-2 transition ${
                          isActive ? "border-primary" : "border-transparent hover:border-primary/60"
                        }`}
                      >
                        <img
                          src={image.url}
                          alt={`${product.name} preview ${index + 1}`}
                          className="h-20 w-full object-cover"
                          loading="lazy"
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <Card className="space-y-6 border-0 p-6 shadow-lg md:p-8">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                  {product.category && <span>{product.category}</span>}
                </div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
                  {product.name}
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {product.description ||
                    "Experience premium comfort with our carefully crafted casual wear, designed for everyday versatility and effortless style."}
                </p>
              </div>

              <div className="rounded-2xl bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Price
                </p>
                <p className="text-3xl font-bold text-primary">${product.price.toFixed(2)}</p>
              </div>

              {product.colors?.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Color
                    </h3>
                    {selectedColor && (
                      <span className="text-xs text-muted-foreground">
                        Selected: <span className="font-semibold text-foreground">{selectedColor}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {product.colors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        className={`rounded-full border px-4 py-2 text-xs font-medium transition ${
                          selectedColor === color
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted bg-background text-foreground hover:border-primary/60"
                        }`}
                      >
                        {color}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {product.sizes?.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Size
                    </h3>
                    {selectedSize && (
                      <span className="text-xs text-muted-foreground">
                        Selected: <span className="font-semibold text-foreground">{selectedSize}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {product.sizes.map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setSelectedSize(size)}
                        className={`rounded-lg border px-4 py-2 text-xs font-medium transition ${
                          selectedSize === size
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted bg-background text-foreground hover:border-primary/60"
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Quantity
                </h3>
                <div className="flex w-40 items-center rounded-full border bg-background">
                  <button
                    type="button"
                    onClick={decrementQuantity}
                    className="h-10 w-10 rounded-l-full text-xl text-muted-foreground transition hover:bg-muted"
                    disabled={quantity <= 1}
                  >
                    –
                  </button>
                  <Input
                    value={quantity}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      if (Number.isNaN(next)) return;
                      setQuantity(Math.max(1, Math.min(next, 99)));
                    }}
                    className="h-10 w-full border-x-0 text-center text-base font-semibold focus-visible:ring-0"
                    type="number"
                    min={1}
                    max={99}
                  />
                  <button
                    type="button"
                    onClick={incrementQuantity}
                    className="h-10 w-10 rounded-r-full text-xl text-muted-foreground transition hover:bg-muted"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="space-y-3 text-sm text-muted-foreground">
                {product.metadata?.material && (
                  <p>
                    <span className="font-semibold text-foreground">Material:</span>{" "}
                    {product.metadata.material}
                  </p>
                )}
                {product.metadata?.fit && (
                  <p>
                    <span className="font-semibold text-foreground">Fit:</span> {product.metadata.fit}
                  </p>
                )}
                {product.metadata?.careInstructions && (
                  <p>
                    <span className="font-semibold text-foreground">Care:</span>{" "}
                    {product.metadata.careInstructions}
                  </p>
                )}
              </div>

              <Separator />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  className="flex-1 rounded-full text-sm font-semibold shadow-lg hover:shadow-xl"
                  size="lg"
                  disabled={adding || cartBusy}
                  onClick={handleAddToCart}
                >
                  {adding || cartBusy ? (
                    <>
                      <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
                      Adding...
                    </>
                  ) : (
                    "Add to Cart"
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full text-sm font-semibold"
                  onClick={() => navigate("/products")}
                >
                  Continue Shopping
                </Button>
              </div>
            </Card>
          </div>
        ) : null}
      </section>

      <Footer />
    </div>
  );
}

