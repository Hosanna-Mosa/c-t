import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchDTFProductBySlug } from "@/lib/api";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

type DTFProduct = {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  cost: number;
  image?: { url: string };
};

type PrintReadyFile = {
  name: string;
  preview: string;
  dataUrl: string;
};

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function DTFDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<DTFProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [printFile, setPrintFile] = useState<PrintReadyFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const { addItemToCart, loading: cartBusy } = useCart();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!slug) return;
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchDTFProductBySlug(slug);
        setProduct(data);
        setError(null);
      } catch (err: any) {
        setError(err?.message || "DTF product not found");
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  const heroImage = useMemo(() => {
    if (printFile?.preview) return printFile.preview;
    return product?.image?.url || "/placeholder.svg";
  }, [product, printFile]);

  const handleFileSelect = async (file: File | null) => {
    if (!file) {
      setPrintFile(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setFileError("Please upload an image file");
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    setPrintFile({
      name: file.name,
      preview: dataUrl,
      dataUrl,
    });
    setFileError(null);
  };

  const handleRemoveFile = () => {
    setPrintFile(null);
    setFileError(null);
  };

  const handleQuantityChange = (value: number) => {
    if (Number.isNaN(value)) return;
    setQuantity(Math.max(1, Math.min(value, 999)));
  };

  const handleAddToCart = async () => {
    if (!product) return;
    if (!printFile) {
      toast.error("Please upload your print ready file first");
      return;
    }
    if (!isAuthenticated) {
      toast.info("Please login to continue");
      navigate("/login", { state: { from: location.pathname } });
      return;
    }

    try {
      setAdding(true);
      await addItemToCart({
        productId: product._id,
        productModel: "DTFProduct",
        productType: "dtf",
        productName: product.title,
        productSlug: product.slug,
        productImage: product.image?.url,
        basePrice: product.cost,
        totalPrice: product.cost,
        quantity,
        dtfPrintFile: {
          dataUrl: printFile.dataUrl,
          preview: printFile.preview,
          fileName: printFile.name,
        },
      });
      toast.success("DTF product added to cart");
    } catch (err: any) {
      toast.error(err?.message || "Failed to add product to cart");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background via-background to-muted/10">
      <Navbar />
      <section className="container mx-auto flex-1 px-4 py-8 md:py-12">
        {loading ? (
          <div className="mx-auto max-w-5xl rounded-2xl border border-dashed border-muted p-12 text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-primary" />
            <p className="mt-4 text-sm text-muted-foreground">Loading DTF product...</p>
          </div>
        ) : error ? (
          <div className="mx-auto max-w-3xl rounded-xl border border-destructive/20 bg-destructive/10 p-8 text-center text-destructive">
            {error}
          </div>
        ) : product ? (
          <div className="grid gap-10 lg:grid-cols-[1.1fr,0.9fr]">
            <div className="space-y-6">
              <Card className="overflow-hidden border-0 shadow-lg">
                <div className="relative h-[360px] sm:h-[460px] bg-muted/40">
                  <img src={heroImage} alt={product.title} className="h-full w-full object-contain" />
                  <span className="absolute left-4 top-4 rounded-full bg-background/90 px-4 py-1 text-xs font-semibold uppercase shadow">
                    ${product.cost.toFixed(2)}
                  </span>
                </div>
              </Card>

            </div>

            <Card className="space-y-6 border-0 p-6 shadow-lg md:p-8">
              <div className="space-y-3">
                <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">DTF Transfer</div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">{product.title}</h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {product.description ||
                    "Premium-quality DTF artwork ready for instant upload. Expect high detail, smooth gradients, and consistent application."}
                </p>
              </div>

              <div className="rounded-2xl bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">Unit Cost</p>
                <p className="text-3xl font-bold text-primary">${product.cost.toFixed(2)}</p>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Quantity</h3>
                <div className="flex w-48 items-center rounded-full border bg-background">
                  <button
                    type="button"
                    onClick={() => handleQuantityChange(quantity - 1)}
                    className="h-10 w-10 rounded-l-full text-xl text-muted-foreground transition hover:bg-muted"
                    disabled={quantity <= 1}
                  >
                    –
                  </button>
                  <Input
                    value={quantity}
                    onChange={(event) => handleQuantityChange(Number(event.target.value))}
                    className="h-10 w-full border-x-0 text-center text-base font-semibold focus-visible:ring-0"
                    type="number"
                    min={1}
                    max={999}
                  />
                  <button
                    type="button"
                    onClick={() => handleQuantityChange(quantity + 1)}
                    className="h-10 w-10 rounded-r-full text-xl text-muted-foreground transition hover:bg-muted"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Print Ready File</h3>
                  {printFile && (
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={handleRemoveFile}>
                      Remove
                    </Button>
                  )}
                </div>
                {printFile ? (
                  <div className="flex items-center gap-3 rounded-xl border border-muted-foreground/30 bg-muted/10 p-3">
                    <img src={printFile.preview} alt="Selected print file" className="h-16 w-16 rounded-lg object-cover" />
                    <div className="flex-1 text-xs text-muted-foreground">
                      <p className="font-semibold text-foreground">{printFile.name}</p>
                      <p>Attached to this order</p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-muted-foreground/40 bg-muted/10 p-3 text-xs text-muted-foreground">
                    No file selected yet. Upload your print ready artwork.
                  </div>
                )}
                <Button variant="outline" className="w-full" onClick={() => setDialogOpen(true)}>
                  {printFile ? 'Replace Print Ready File' : 'Upload Print Ready File'}
                </Button>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Upload Print Ready File</DialogTitle>
                      <DialogDescription>
                        Supported formats: PNG, JPG, and SVG up to 10MB. This file stays attached to your DTF order.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => handleFileSelect(event.target.files?.[0] || null)}
                      />
                      {fileError && <p className="text-sm text-destructive">{fileError}</p>}
                      {printFile && (
                        <div className="rounded-lg border border-muted-foreground/30 p-3">
                          <img src={printFile.preview} alt="Preview" className="w-full rounded-md object-cover" />
                          <p className="mt-2 text-xs text-muted-foreground">{printFile.name}</p>
                        </div>
                      )}
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                        Close
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
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
                <Button variant="outline" className="rounded-full text-sm font-semibold" onClick={() => navigate("/dtf")}>
                  More DTF Designs
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


