import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetchDTFProducts } from "@/lib/api";

type DTFProduct = {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  cost: number;
  image?: { url: string };
  createdAt: string;
};

export default function DTF() {
  const [products, setProducts] = useState<DTFProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchDTFProducts();
        setProducts(Array.isArray(data) ? data : []);
        setError(null);
      } catch (err: any) {
        setError(err?.message || "Failed to load DTF products");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background via-background to-muted/10">
      <Navbar />
      <section className="container mx-auto flex-1 px-4 py-8 md:py-12">
        <header className="mx-auto mb-10 max-w-3xl text-center">
          <Badge variant="outline" className="mb-4 rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em]">
            DTF Library
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Ready-To-Print DTF Products
          </h1>
          <p className="mt-4 text-sm text-muted-foreground sm:text-base">
            Browse curated DTF transfers with premium detailing. Upload your print-ready file, set the quantity, and checkout without disrupting your other cart items.
          </p>
        </header>

        {loading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card key={index} className="overflow-hidden border-2 border-dashed border-muted-foreground/20">
                <div className="aspect-square animate-pulse bg-muted/50" />
                <CardContent className="space-y-3 p-4">
                  <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
                  <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                  <div className="h-9 w-full animate-pulse rounded bg-muted" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center text-destructive">
            {error}
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-muted p-12 text-center">
            <h3 className="text-lg font-semibold text-foreground">No DTF products yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Please check back soon for fresh transfers and print-ready drops.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <Card
                key={product._id}
                className="group flex h-full flex-col overflow-hidden border-2 border-transparent transition hover:border-primary/40 hover:shadow-lg"
              >
                <button
                  type="button"
                  className="relative aspect-square overflow-hidden"
                  onClick={() => navigate(`/dtf/${product.slug}`)}
                >
                  <img
                    src={product.image?.url || "/placeholder.svg"}
                    alt={product.title}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                  <span className="absolute left-4 top-4 rounded-full bg-background/80 px-3 py-1 text-xs font-semibold uppercase shadow">
                    ${product.cost.toFixed(2)}
                  </span>
                </button>
                <CardContent className="flex flex-1 flex-col gap-3 p-4">
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-foreground line-clamp-2">{product.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {product.description || "High opacity color, smooth gradient-ready film, and consistent coverage."}
                    </p>
                  </div>
                  <div className="mt-auto flex items-center justify-between">
                    <span className="text-xl font-bold text-primary">${product.cost.toFixed(2)}</span>
                    <Button
                      size="sm"
                      className="rounded-full px-4 text-xs"
                      onClick={() => navigate(`/dtf/${product.slug}`)}
                    >
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
      <Footer />
    </div>
  );
}


