import { useState, useEffect, useRef, useLayoutEffect, useCallback } from "react";
import { Canvas as FabricCanvas, FabricImage, FabricText } from "fabric";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Upload,
  Type,
  Trash2,
  RotateCw,
  Download,
  ShoppingCart,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { HexColorPicker } from "react-colorful";
import { motion, AnimatePresence } from "framer-motion";
import { fetchProducts, fetchProductBySlug, saveMyDesign, getMyDesignById, fetchTemplates } from "@/lib/api";
import { useCart } from "@/contexts/CartContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandList } from "@/components/ui/command";
import { Loader2, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

// Types
type Step = "category" | "product" | "design";

interface Category {
  id: string;
  name: string;
  icon?: string;
}

interface Product {
  _id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  sizes: string[];
  variants: Array<{
    color: string;
    colorCode: string;
    images: Array<{ url: string; public_id: string }>;
  }>;
  customizable: boolean;
  customizationType: "predefined" | "own" | "both";
  designTemplate?: any;
  customizationPricing?: {
    perTextLayer: number;
    perImageLayer: number;
    sizeMultiplier: number;
  };
}

interface TemplateAsset {
  _id: string;
  name?: string;
  image: {
    url: string;
    public_id: string;
  };
}

interface DesignLayer {
  id: string;
  type: "text" | "image";
  data: {
    content?: string;
    font?: string;
    color?: string;
    size?: number;
    url?: string;
    x: number;
    y: number;
    scale: number;
    rotation: number;
    dpi?: number;
  };
  cost: number;
  designSizeId?: string; // Size preset ID (pocket, small, medium, large)
}

const CATEGORIES: Category[] = [
  { id: "tshirts", name: "T-Shirts", icon: "👕" },
  { id: "hoodies", name: "Hoodies", icon: "🧥" },
  { id: "tanks", name: "Tank Tops", icon: "🎽" },
  { id: "polo", name: "Polo Shirts", icon: "👔" },
];

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const FONTS = ["Arial", "Helvetica", "Times New Roman", "Courier New", "Georgia", "Verdana"];

// Development flag - Set to false to hide "Refresh Sizes" button in production
const IS_DEVELOPMENT = false; // Change to false when project is ready for production

// Standard design sizes (in pixels at 300 DPI)
// These represent the maximum dimensions for design elements
// NOTE: After changing dimensions here, click "Refresh Sizes" button to update existing elements on canvas
const STANDARD_DESIGN_SIZES = [
  { 
    id: "pocket", 
    name: "Pocket Size", 
    width: 90, // 3 inches at 300 DPI
    height: 90, 
    description: "3\" × 3\"",
    price: 50 // Fixed price in $
  },
  { 
    id: "small", 
    name: "Small", 
    width: 150, // 5 inches at 300 DPI
    height: 150, 
    description: "5\" × 5\"",
    price: 100 // Fixed price in $
  },
  { 
    id: "medium", 
    name: "Medium", 
    width: 210, // 7 inches at 300 DPI
    height: 280, // Updated height (280px = ~9.33 inches at 300 DPI)
    description: "7\" × 9.33\"",
    price: 150 // Fixed price in $
  },
  { 
    id: "large", 
    name: "Large", 
    width: 300, // 10 inches at 300 DPI
    height: 300, 
    description: "10\" × 10\"",
    price: 200 // Fixed price in $
  },
];

// Dynamic pricing: cost derived from rendered object area (in pixels)
const PRICE_PER_PIXEL = 0.02; // $ per pixel area
const DPI = 300; // standard printing resolution
const DEFAULT_TEXT_DPI = 300; // default for text layers

// Attempt to extract per-image DPI from underlying HTMLImageElement metadata (EXIF) with fallback
function getImageDPIFromMeta(imgObject: any): number {
  try {
    const originalEl = imgObject?._originalElement || imgObject?._element || imgObject?._image || undefined;
    if (originalEl && originalEl.naturalWidth) {
      const exif = (originalEl as any).exifdata;
      if (exif) {
        const xRes = exif.XResolution;
        const yRes = exif.YResolution;
        const dpi = xRes || yRes;
        if (typeof dpi === 'number' && isFinite(dpi) && dpi > 0) return dpi;
        if (typeof dpi === 'object' && dpi?.numerator && dpi?.denominator) {
          const val = Number(dpi.numerator) / Number(dpi.denominator || 1);
          if (isFinite(val) && val > 0) return val;
        }
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("Could not extract DPI from image metadata, falling back to default 300 DPI");
  }
  return 300; // fallback
}

// Extract DPI from an uploaded File using EXIF if available; fallback to 300
async function getImageDPI(file: File): Promise<number> {
  try {
    // If EXIF library is available globally, use it
    const EXIF = (window as any).EXIF;
    if (EXIF && typeof EXIF.getData === 'function') {
      return await new Promise<number>((resolve) => {
        EXIF.getData(file, function () {
          const xRes = EXIF.getTag(this, 'XResolution');
          const yRes = EXIF.getTag(this, 'YResolution');
          const dpi = xRes || yRes;
          if (typeof dpi === 'number' && isFinite(dpi) && dpi > 0) return resolve(dpi);
          if (dpi && typeof dpi === 'object' && dpi.numerator && dpi.denominator) {
            const val = Number(dpi.numerator) / Number(dpi.denominator || 1);
            if (isFinite(val) && val > 0) return resolve(val);
          }
          resolve(300);
        });
      });
    }
  } catch {}
  return 300;
}

// Add at the top, after imports but before component definition
const MAX_PRINTABLE_WIDTH = 400; // px for mockup display
const MAX_PRINTABLE_HEIGHT = 400; // px for mockup display

async function fetchImageAsDataURL(url: string): Promise<string> {
  const res = await fetch(url, { mode: "cors", credentials: "omit" });
  if (!res.ok) {
    throw new Error(`Failed to fetch image: ${res.status}`);
  }
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to convert blob to data URL"));
      }
    };
    reader.onerror = () => reject(reader.error || new Error("Failed to read blob"));
    reader.readAsDataURL(blob);
  });
}

export default function Customize() {
  const { addItemToCart } = useCart();
  const navigate = useNavigate();
  const location = useLocation() as any;
  // Step management
  const [step, setStep] = useState<Step>("product");

  // Data state
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState("M");
  const templateSelectionHandledRef = useRef(false);
  const [templateInfo, setTemplateInfo] = useState<{ id: string; imageUrl: string } | null>(null);
  const [templateApplied, setTemplateApplied] = useState(false);
  const [templates, setTemplates] = useState<TemplateAsset[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [templatePopoverOpen, setTemplatePopoverOpen] = useState(false);
  const [instructionDialogOpen, setInstructionDialogOpen] = useState(false);
  const [orderInstruction, setOrderInstruction] = useState("");
  const templateImageCache = useRef<Record<string, string>>({});

  // Canvas state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  
  // Design state
  const [designSide, setDesignSide] = useState<"front" | "back">("front");
  const [frontDesignLayers, setFrontDesignLayers] = useState<DesignLayer[]>([]);
  const [backDesignLayers, setBackDesignLayers] = useState<DesignLayer[]>([]);
  
  // Metrics for each side (inches and pixels)
  const [frontDesignMetrics, setFrontDesignMetrics] = useState<{
    widthInches: number;
    heightInches: number;
    areaInches: number;
    totalPixels: number;
    perLayer: Array<{
      id: string;
      type: string;
      widthPixels: number;
      heightPixels: number;
      areaPixels: number;
      widthInches: number;
      heightInches: number;
      areaInches: number;
      cost: number;
    }>;
  } | null>(null);
  const [backDesignMetrics, setBackDesignMetrics] = useState<{
    widthInches: number;
    heightInches: number;
    areaInches: number;
    totalPixels: number;
    perLayer: Array<{
      id: string;
      type: string;
      widthPixels: number;
      heightPixels: number;
      areaPixels: number;
      widthInches: number;
      heightInches: number;
      areaInches: number;
      cost: number;
    }>;
  } | null>(null);
  
  // Use refs to store latest layer state to avoid stale closures
  const frontDesignLayersRef = useRef<DesignLayer[]>([]);
  const backDesignLayersRef = useRef<DesignLayer[]>([]);
  const previousDesignSideRef = useRef<"front" | "back">("front");
  
  // Keep refs in sync with state
  useEffect(() => {
    frontDesignLayersRef.current = frontDesignLayers;
  }, [frontDesignLayers]);
  
  useEffect(() => {
    backDesignLayersRef.current = backDesignLayers;
  }, [backDesignLayers]);
  const [textColor, setTextColor] = useState("#000000");
  const [fontSize, setFontSize] = useState(40);
  const [selectedFont, setSelectedFont] = useState("Arial");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [showBackground, setShowBackground] = useState(false);
  const [transparentBgEnabled, setTransparentBgEnabled] = useState(false);
  const [transparentColor] = useState<string>("#ffffff");
  const [showColorDropdown, setShowColorDropdown] = useState(false);
  const colorDropdownRef = useRef<HTMLDivElement>(null);
  const [selectedDesignSize, setSelectedDesignSize] = useState<string>("medium"); // Default to medium
  // Load design by id from navigation state; also fetch product so images load
  useEffect(() => {
    const id = (location as any)?.state?.loadDesignId as string | undefined;
    if (!id) return;
    (async () => {
      try {
        const d = await getMyDesignById(id);
        if (!d) return;
        setSelectedSize(d.selectedSize || "M");
        setSelectedColor(d.selectedColor || null);
        if (d.productSlug) {
          try {
            const prod = await fetchProductBySlug(d.productSlug);
            setSelectedProduct(prod);
          } catch {}
        }
        if (d.frontDesign?.designLayers) setFrontDesignLayers(d.frontDesign.designLayers);
        if (d.backDesign?.designLayers) setBackDesignLayers(d.backDesign.designLayers);
        setStep("design");
        toast.success("Loaded saved design");
      } catch (e) {
        toast.error("Failed to load saved design");
      }
    })();
  }, [location]);

  // Current design layers based on selected side
  const designLayers = designSide === "front" ? frontDesignLayers : backDesignLayers;
  const setDesignLayers = designSide === "front" ? setFrontDesignLayers : setBackDesignLayers;
  
  // Loading state
  const [loading, setLoading] = useState(false);
  const [savingDesign, setSavingDesign] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (step === "product" && products.length === 0) {
        setLoading(true);
        try {
          const allProducts = await fetchProducts();
          setProducts(allProducts);
        } catch {
          toast.error("Failed to load products");
        } finally {
          setLoading(false);
        }
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, products.length]);

  useEffect(() => {
    const selection = (location as any)?.state?.templateSelection;
    if (!selection || templateSelectionHandledRef.current) return;

    templateSelectionHandledRef.current = true;

    const initializeFromTemplate = async () => {
      try {
        setLoading(true);
        let currentProducts = products;
        if (!currentProducts.length) {
          currentProducts = await fetchProducts();
          setProducts(currentProducts);
        }
        const product = currentProducts.find((item) => item._id === selection.productId);
        if (product) {
          setSelectedProduct(product);
          setSelectedColor(product.variants?.[0]?.color || null);
          setStep("design");
          setTemplateInfo({ id: selection.templateId, imageUrl: selection.imageUrl });
          setTemplateApplied(false);
          toast.success("Template applied. Customize your design!");
        } else {
          setTemplateInfo(null);
          toast.error("Selected product is unavailable.");
        }
      } catch (err) {
        setTemplateInfo(null);
        toast.error("Unable to load template. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    initializeFromTemplate();

    const currentState = { ...((location as any)?.state || {}) };
    if (currentState.templateSelection) {
      delete currentState.templateSelection;
      navigate(location.pathname, {
        replace: true,
        state: Object.keys(currentState).length ? currentState : null,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, products, navigate]);

  useEffect(() => {
    let active = true;
    const loadTemplates = async () => {
      try {
        setTemplatesLoading(true);
        const data = await fetchTemplates();
        if (!active) return;
        setTemplates(Array.isArray(data) ? data : []);
        setTemplatesError(null);
      } catch (error: any) {
        if (!active) return;
        setTemplatesError(error?.message || "Failed to load templates");
      } finally {
        if (active) setTemplatesLoading(false);
      }
    };

    loadTemplates();

    return () => {
      active = false;
    };
  }, []);
  
  // Pricing
  const basePrice = selectedProduct?.price || 0;
  const [frontCustomizationCost, setFrontCustomizationCost] = useState(0);
  const [backCustomizationCost, setBackCustomizationCost] = useState(0);
  const totalPrice = basePrice + frontCustomizationCost + backCustomizationCost;

  // Update total price when base price changes
  useEffect(() => {
    // Reset customization costs when base price changes
    setFrontCustomizationCost(0);
    setBackCustomizationCost(0);
  }, [basePrice]);
  // Helper: disable resizing but allow movement
  const configureObjectControls = (obj: any) => {
    // Disable all resize controls, but keep move and rotate
    obj.set({
      hasControls: true,
      hasBorders: true,
      lockScalingX: true, // Disable horizontal scaling
      lockScalingY: true, // Disable vertical scaling
      lockUniScaling: true, // Disable uniform scaling
      lockSkewingX: true, // Disable skewing
      lockSkewingY: true, // Disable skewing
      // Keep these enabled for movement and rotation
      lockMovementX: false,
      lockMovementY: false,
      lockRotation: false,
    });
  };

  // Helper: initialize Fabric canvas
  const setupCanvasInstance = useCallback((el: HTMLCanvasElement) => {
    if (didInitCanvasRef.current || fabricCanvas) return;
    
    // Calculate responsive canvas size
    const getCanvasSize = () => {
      // Get the actual container width
      const container = el.closest('.container') || el.parentElement?.parentElement;
      if (!container) {
        // Fallback: use viewport width
        const viewportWidth = window.innerWidth;
        const isMobile = viewportWidth < 640;
        const maxWidth = isMobile ? Math.min(viewportWidth - 48, 320) : 500;
        const aspectRatio = 5 / 6;
        return { width: maxWidth, height: maxWidth / aspectRatio };
      }
      
      const containerWidth = (container as HTMLElement).clientWidth || window.innerWidth;
      const padding = 48; // Account for container padding and card padding
      const availableWidth = Math.max(280, containerWidth - padding);
      
      // On mobile, use smaller size; on desktop, use full size
      const isMobile = window.innerWidth < 640; // sm breakpoint
      const maxWidth = isMobile ? Math.min(availableWidth, 320) : Math.min(availableWidth, 500);
      const aspectRatio = 5 / 6; // 500:600 ratio
      const height = maxWidth / aspectRatio;
      
      return { width: Math.round(maxWidth), height: Math.round(height) };
    };
    
    // Wait a bit for DOM to be ready, then calculate size
    const calculateSize = () => {
      const size = getCanvasSize();
      return size;
    };
    
    const { width, height } = calculateSize();
    const canvas = new FabricCanvas(el, {
      width,
      height,
      backgroundColor: "transparent",
    });
    setFabricCanvas(canvas);
    didInitCanvasRef.current = true;

    if (showBackground) {
      addBackgroundPhoto(canvas);
    }
    if (selectedProduct && selectedColor) {
      const variant = selectedProduct.variants.find((v) => v.color === selectedColor);
      const imgUrl = variant ? pickVariantImageForSide(variant, designSide) : undefined;
      if (imgUrl) {
        // eslint-disable-next-line no-console
        console.log("[Customize] Loading base image for", designSide, ":", imgUrl);
        addProductPhotoBase(canvas, imgUrl);
      } else {
        // eslint-disable-next-line no-console
        console.warn("[Customize] No image found for", designSide, "side");
      }
    }

    const getObjectArea = (obj: any) => {
      // Use absolute values to handle negative scaling
      const scaleX = Math.abs(obj.scaleX || 1);
      const scaleY = Math.abs(obj.scaleY || 1);
      
      // For text objects, use the actual bounding box
      if (obj.type === 'text' || obj.type === 'textbox') {
        const bbox = obj.getBoundingRect();
        return bbox.width * bbox.height;
      }
      
      // For other objects, use width/height with absolute scaling
      const width = (obj.width || 0) * scaleX;
      const height = (obj.height || 0) * scaleY;
      return width * height;
    };

  }, [selectedColor, selectedProduct, showBackground, step]);

  // Canvas element ref
  const canvasElRef = useCallback((el: HTMLCanvasElement | null) => {
    canvasRef.current = el;
    if (el) {
      if (step === "design") {
        setupCanvasInstance(el);
      }
    }
  }, [setupCanvasInstance, step]);

  // Resize canvas on window resize to prevent overflow
  useEffect(() => {
    if (!fabricCanvas || step !== "design" || !canvasRef.current) return;
    
    const handleResize = () => {
      const canvas = fabricCanvas;
      const container = canvasRef.current?.parentElement?.parentElement;
      if (!container || !canvasRef.current) return;
      
      const containerWidth = container.clientWidth;
      const padding = 48;
      const availableWidth = Math.max(280, containerWidth - padding);
      
      const isMobile = window.innerWidth < 640;
      const maxWidth = isMobile ? Math.min(availableWidth, 320) : Math.min(availableWidth, 500);
      const aspectRatio = 5 / 6;
      const newHeight = maxWidth / aspectRatio;
      
      // Only resize if size changed significantly (more than 10px difference)
      const currentWidth = canvas.getWidth();
      const currentHeight = canvas.getHeight();
      if (Math.abs(currentWidth - maxWidth) > 10 || Math.abs(currentHeight - newHeight) > 10) {
        // Store current scale ratio before resize
        const scaleRatio = maxWidth / currentWidth;
        
        // Resize canvas
        canvas.setDimensions({ width: maxWidth, height: newHeight });
        
        // Rescale all objects to maintain relative positions
        const objects = canvas.getObjects();
        objects.forEach((obj) => {
          if ((obj as any).name !== 'tshirt-base-photo' && (obj as any).name !== 'bg-photo') {
            // Scale custom elements proportionally
            obj.scaleX = (obj.scaleX || 1) * scaleRatio;
            obj.scaleY = (obj.scaleY || 1) * scaleRatio;
            obj.left = (obj.left || 0) * scaleRatio;
            obj.top = (obj.top || 0) * scaleRatio;
            obj.setCoords();
          }
        });
        
        // Reload base image to fit new canvas size
        const baseImg = objects.find((o) => (o as any).name === 'tshirt-base-photo');
        if (baseImg && selectedProduct && selectedColor) {
          const variant = selectedProduct.variants.find((v) => v.color === selectedColor);
          const imgUrl = variant ? pickVariantImageForSide(variant, designSide) : undefined;
          if (imgUrl) {
            canvas.remove(baseImg);
            addProductPhotoBase(canvas, imgUrl);
          }
        }
        
        canvas.renderAll();
      }
    };
    
    // Debounce resize
    let resizeTimeout: NodeJS.Timeout;
    const debouncedResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(handleResize, 200);
    };
    
    window.addEventListener('resize', debouncedResize);
    // Initial check after a short delay to ensure DOM is ready
    setTimeout(handleResize, 200);
    
    return () => {
      window.removeEventListener('resize', debouncedResize);
      clearTimeout(resizeTimeout);
    };
  }, [fabricCanvas, step, selectedProduct, selectedColor, designSide]);

  // Focused logging for front/back switching
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log("[Customize] Side changed to:", designSide);
  }, [designSide]);

  // Initialize canvas only when in design step (layout effect for earlier timing)
  const didInitCanvasRef = useRef(false);
  useLayoutEffect(() => {
    if (step !== "design" || !canvasRef.current) return;
    if (didInitCanvasRef.current && fabricCanvas) {
      return;
    }
    setupCanvasInstance(canvasRef.current);

    return () => {
      if (fabricCanvas) {
        fabricCanvas.off("object:modified");
        fabricCanvas.off("object:scaling");
        fabricCanvas.off("object:moving");
        fabricCanvas.off("object:rotating");
        fabricCanvas.dispose();
      }
      didInitCanvasRef.current = false;
    };
  }, [step, selectedProduct, selectedColor, designSide, setupCanvasInstance]);

  // Switch base image when changing sides
  useEffect(() => {
    if (!fabricCanvas || step !== "design") return;
    
    // eslint-disable-next-line no-console
    console.log("[Customize] Side switching to:", designSide);
    
    // Store current canvas state from the PREVIOUS side before switching
    const storeCurrentCanvasState = () => {
      const objects = fabricCanvas.getObjects();
      const previousSide = previousDesignSideRef.current;
      const currentLayers = previousSide === "front" ? frontDesignLayersRef.current : backDesignLayersRef.current;
      const updatedLayers = [...currentLayers];
      
      // Update layer positions from current canvas objects
      objects.forEach((obj: any) => {
        if (obj.layerId && (obj.name === "custom-text" || obj.name === "custom-image")) {
          const layerIndex = updatedLayers.findIndex(layer => layer.id === obj.layerId);
          if (layerIndex !== -1) {
            updatedLayers[layerIndex] = {
              ...updatedLayers[layerIndex],
              data: {
                ...updatedLayers[layerIndex].data,
                x: obj.left || 0,
                y: obj.top || 0,
                rotation: obj.angle || 0,
                scale: obj.scaleX || 1,
                size: obj.fontSize || updatedLayers[layerIndex].data.size,
                color: obj.fill || updatedLayers[layerIndex].data.color,
                font: obj.fontFamily || updatedLayers[layerIndex].data.font,
              }
            };
          }
        }
      });
      
      // Update the appropriate state for the PREVIOUS side
      if (previousSide === "front") {
        setFrontDesignLayers(updatedLayers);
      } else {
        setBackDesignLayers(updatedLayers);
      }
      
      return updatedLayers;
    };
    
    // Only store state if we're actually switching sides (not initial load)
    if (previousDesignSideRef.current !== designSide) {
      const currentStoredLayers = storeCurrentCanvasState();
    }
    
    // Update the previous side ref for next time
    previousDesignSideRef.current = designSide;
    
    // Clear canvas
    fabricCanvas.clear();
    
    // Add background if enabled
    if (showBackground) {
      addBackgroundPhoto(fabricCanvas);
    }
    
    // Replace base image according to side
    if (selectedProduct && selectedColor) {
      const variant = selectedProduct.variants.find((v) => v.color === selectedColor);
      const imgUrl = variant ? pickVariantImageForSide(variant, designSide) : undefined;
      if (imgUrl) {
        // eslint-disable-next-line no-console
        console.log("[Customize] Loading", designSide, "image:", imgUrl);
        
        // Add new base image and wait for it to load before proceeding
        FabricImage.fromURL(imgUrl, { crossOrigin: "anonymous" })
          .then((img) => {
            // eslint-disable-next-line no-console
            console.log("[Customize] Base image loaded successfully for", designSide, "Dimensions:", img.width, "x", img.height);
            img.set({ selectable: false, evented: false });
            
            // Use actual canvas dimensions instead of hardcoded values
            const canvasW = fabricCanvas.getWidth();
            const canvasH = fabricCanvas.getHeight();
            const scaleX = canvasW / (img.width || canvasW);
            const scaleY = canvasH / (img.height || canvasH);
            const scale = Math.max(scaleX, scaleY);
            img.scale(scale);
            const newW = (img.width || 0) * scale;
            const newH = (img.height || 0) * scale;
            const left = (canvasW - newW) / 2;
            const top = (canvasH - newH) / 2;
            img.set({ left, top });
            
            // eslint-disable-next-line no-console
            console.log("[Customize] Image positioning - Scale:", scale, "Size:", newW, "x", newH, "Position:", left, ",", top);
            (img as any).name = "tshirt-base-photo";
            fabricCanvas.add(img);
            
            // Send to back but above background
            fabricCanvas.sendObjectToBack(img);
            const bg = fabricCanvas.getObjects().find((o) => (o as any).name === "bg-photo");
            if (bg) {
              fabricCanvas.sendObjectToBack(bg);
            }
            
            // Now reload design layers for the NEW side with EXACT positions
            const targetLayers = designSide === "front" ? frontDesignLayersRef.current : backDesignLayersRef.current;
            // eslint-disable-next-line no-console
            console.log("[Customize] Loading", targetLayers.length, "design elements for", designSide);
            
            // Add each layer with exact positioning
            targetLayers.forEach((layer) => {
              if (layer.type === "text") {
                const text = new FabricText(layer.data.content || "", {
                  left: layer.data.x,
                  top: layer.data.y,
                  fontSize: layer.data.size,
                  fill: layer.data.color,
                  fontFamily: layer.data.font,
                  angle: layer.data.rotation,
                  scaleX: layer.data.scale,
                  scaleY: layer.data.scale,
                });
                (text as any).name = "custom-text";
                (text as any).layerId = layer.id;
                (text as any).designSide = designSide;
                (text as any).designSizeId = (layer as any).designSizeId || selectedDesignSize;
                configureObjectControls(text);
                fabricCanvas.add(text);
                // eslint-disable-next-line no-console
                console.log("[Customize] Added text:", layer.data.content, "at position:", layer.data.x, layer.data.y);
              } else if (layer.type === "image" && layer.data.url) {
                FabricImage.fromURL(layer.data.url).then((img) => {
                  img.set({
                    left: layer.data.x,
                    top: layer.data.y,
                    angle: layer.data.rotation,
                    scaleX: layer.data.scale,
                    scaleY: layer.data.scale,
                  });
                  (img as any).name = "custom-image";
                  (img as any).layerId = layer.id;
                  (img as any).designSide = designSide;
                  (img as any).designSizeId = (layer as any).designSizeId || selectedDesignSize;
                  configureObjectControls(img);
                  fabricCanvas.add(img);
                  fabricCanvas.renderAll();
                  // eslint-disable-next-line no-console
                  console.log("[Customize] Added image at position:", layer.data.x, layer.data.y);
                });
              }
            });
            
            fabricCanvas.renderAll();
            // eslint-disable-next-line no-console
            console.log("[Customize] Canvas rendered after adding", designSide, "image and layers");
          })
          .catch((err) => {
            // eslint-disable-next-line no-console
            console.error("[Customize] Failed to load base image for", designSide, ":", err);
            toast.error("Failed to load product image");
          });
      } else {
        // eslint-disable-next-line no-console
        console.warn("[Customize] No", designSide, "image available");
      }
    }
  }, [designSide, fabricCanvas, step, selectedProduct, selectedColor, showBackground]);

  useEffect(() => {
    if (!fabricCanvas || !templateInfo || templateApplied || step !== "design") return;
    if (!selectedProduct || !selectedColor) return;

    const currentSide = designSide;

    // Remove existing template layers before adding a new one
    const objects = fabricCanvas.getObjects();
    const targetLayerRef =
      currentSide === "front" ? frontDesignLayersRef.current : backDesignLayersRef.current;
    const templateLayerIds = new Set(
      targetLayerRef.filter((layer) => layer.id.startsWith("template-")).map((layer) => layer.id)
    );

    if (templateLayerIds.size > 0) {
      objects
        .filter((obj: any) => obj.layerId && templateLayerIds.has(obj.layerId))
        .forEach((obj) => fabricCanvas.remove(obj));
      fabricCanvas.renderAll();
      if (currentSide === "front") {
        setFrontDesignLayers((prev) =>
          prev.filter((layer) => !templateLayerIds.has(layer.id))
        );
      } else {
        setBackDesignLayers((prev) =>
          prev.filter((layer) => !templateLayerIds.has(layer.id))
        );
      }
    }

    const loadTemplate = async () => {
      try {
        const cacheKey = `${templateInfo.imageUrl}`;
        let source = templateImageCache.current[cacheKey];
        if (!source) {
          source = await fetchImageAsDataURL(templateInfo.imageUrl);
          templateImageCache.current[cacheKey] = source;
        }

        const img = await FabricImage.fromURL(source);

        const maxWidth = 280;
        const maxHeight = 280;
        const originalWidth = img.width || maxWidth;
        const originalHeight = img.height || maxHeight;
        const scale = Math.min(maxWidth / originalWidth, maxHeight / originalHeight, 1);

        img.set({
          left: 110,
          top: 180,
          scaleX: scale,
          scaleY: scale,
          selectable: true,
        });
        configureObjectControls(img);

        const layerId = `template-${templateInfo.id}-${currentSide}`;
        (img as any).name = "custom-image";
        (img as any).layerId = layerId;
        (img as any).designSide = currentSide;
        (img as any).designSizeId = selectedDesignSize;

        fabricCanvas.add(img);
        fabricCanvas.setActiveObject(img);
        fabricCanvas.renderAll();

        const newLayer: DesignLayer = {
          id: layerId,
          type: "image",
          data: {
            url: source,
            x: img.left || 0,
            y: img.top || 0,
            scale: img.scaleX || 1,
            rotation: img.angle || 0,
          },
          cost: selectedProduct?.customizationPricing?.perImageLayer || 20,
          designSizeId: selectedDesignSize,
        };

        if (currentSide === "front") {
          setFrontDesignLayers((prev) => {
            const filtered = prev.filter((layer) => !layer.id.startsWith("template-"));
            return [...filtered, newLayer];
          });
        } else {
          setBackDesignLayers((prev) => {
            const filtered = prev.filter((layer) => !layer.id.startsWith("template-"));
            return [...filtered, newLayer];
          });
        }
        setTemplateApplied(true);
      } catch (error) {
        console.error("Failed to load template image", error);
        toast.error("Failed to load template image");
        setTemplateApplied(true);
      }
    };

    loadTemplate();
  }, [fabricCanvas, templateInfo, templateApplied, selectedProduct, selectedColor, selectedDesignSize, designSide, step]);

  // Toggle background photo on/off
  useEffect(() => {
    if (!fabricCanvas) return;
    const objects = fabricCanvas.getObjects();
    const bg = objects.find((o) => (o as any).name === "bg-photo");
    if (showBackground && !bg) {
      addBackgroundPhoto(fabricCanvas);
      (fabricCanvas as any).backgroundColor = "#f5f5f5";
      fabricCanvas.renderAll();
    } else if (!showBackground && bg) {
      fabricCanvas.remove(bg);
      (fabricCanvas as any).backgroundColor = "transparent";
      fabricCanvas.renderAll();
    }
  }, [showBackground, fabricCanvas]);

  // Live update active text styling
  useEffect(() => {
    if (!fabricCanvas) return;
    const active = fabricCanvas.getActiveObject();
    if (active && (active as any).name === "custom-text") {
      (active as any).set({ fontSize, fill: textColor, fontFamily: selectedFont });
      fabricCanvas.requestRenderAll();
    }
  }, [fontSize, textColor, selectedFont, fabricCanvas]);

  // Always keep canvas transparent so product background image is visible
  useEffect(() => {
    if (!fabricCanvas) return;
    (fabricCanvas as any).backgroundColor = "transparent";
    fabricCanvas.renderAll();
  }, [fabricCanvas]);

  // Continuous position sync - update layer positions when objects move
  useEffect(() => {
    if (!fabricCanvas) return;

    const updateLayerPositions = () => {
      const objects = fabricCanvas.getObjects();
      const currentLayers = designSide === "front" ? frontDesignLayersRef.current : backDesignLayersRef.current;
      const updatedLayers = [...currentLayers];
      let hasChanges = false;

      objects.forEach((obj: any) => {
        if (obj.layerId && (obj.name === "custom-text" || obj.name === "custom-image")) {
          const layerIndex = updatedLayers.findIndex(layer => layer.id === obj.layerId);
          if (layerIndex !== -1) {
            const currentLayer = updatedLayers[layerIndex];
            const newData = {
              ...currentLayer.data,
              x: obj.left || 0,
              y: obj.top || 0,
              rotation: obj.angle || 0,
              scale: obj.scaleX || 1,
              size: obj.fontSize || currentLayer.data.size,
              color: obj.fill || currentLayer.data.color,
              font: obj.fontFamily || currentLayer.data.font,
            };

            // Sync size preset ID from canvas object
            if (obj.designSizeId && currentLayer.designSizeId !== obj.designSizeId) {
              updatedLayers[layerIndex] = {
                ...currentLayer,
                data: newData,
                designSizeId: obj.designSizeId
              };
              hasChanges = true;
            } else if (
              currentLayer.data.x !== newData.x ||
              currentLayer.data.y !== newData.y ||
              currentLayer.data.rotation !== newData.rotation ||
              currentLayer.data.scale !== newData.scale
            ) {
              updatedLayers[layerIndex] = {
                ...currentLayer,
                data: newData
              };
              hasChanges = true;
            }
          }
        }
      });

      // Only update state if there are actual changes
      if (hasChanges) {
        if (designSide === "front") {
          setFrontDesignLayers(updatedLayers);
        } else {
          setBackDesignLayers(updatedLayers);
        }
      }
    };

    // Debounced update to prevent too many rapid updates
    let updateTimeout: NodeJS.Timeout;
    const debouncedUpdate = () => {
      clearTimeout(updateTimeout);
      updateTimeout = setTimeout(updateLayerPositions, 100);
    };

    // Add event listeners for object changes (scaling disabled, but keep listener for safety)
    fabricCanvas.on("object:modified", debouncedUpdate);
    fabricCanvas.on("object:moving", debouncedUpdate);
    fabricCanvas.on("object:rotating", debouncedUpdate);

    // Cleanup
    return () => {
      clearTimeout(updateTimeout);
      fabricCanvas.off("object:modified", debouncedUpdate);
      fabricCanvas.off("object:moving", debouncedUpdate);
      fabricCanvas.off("object:rotating", debouncedUpdate);
    };
  }, [fabricCanvas, designSide]);

  // Handle canvas object selection
  useEffect(() => {
    if (!fabricCanvas) return;
    
    const handleObjectSelection = () => {
      const activeObject = fabricCanvas.getActiveObject();
      if (activeObject) {
        const obj = activeObject as any;
        const objSizeId = obj.designSizeId || selectedDesignSize;
        
        // Update size selector to match selected object's size
        if (objSizeId && STANDARD_DESIGN_SIZES.find(s => s.id === objSizeId)) {
          setSelectedDesignSize(objSizeId);
        }
        
        if (obj.name === "custom-text") {
          // Populate text input with selected text content
          setTextInput(obj.text || "");
          setFontSize(obj.fontSize || 40);
          setTextColor(obj.fill || "#000000");
          setSelectedFont(obj.fontFamily || "Arial");
        } else {
          // Clear text input when no text is selected
          setTextInput("");
        }
      } else {
        // Clear text input when no object is selected
        setTextInput("");
      }
    };

    fabricCanvas.on("selection:created", handleObjectSelection);
    fabricCanvas.on("selection:updated", handleObjectSelection);
    fabricCanvas.on("selection:cleared", () => {
      setTextInput("");
    });

    return () => {
      fabricCanvas.off("selection:created", handleObjectSelection);
      fabricCanvas.off("selection:updated", handleObjectSelection);
      fabricCanvas.off("selection:cleared");
    };
  }, [fabricCanvas, selectedDesignSize]);

  // Fixed price-based pricing updates on canvas object changes
  useEffect(() => {
    if (!fabricCanvas) return;

    const calculateTotalPrice = () => {
      const objects = fabricCanvas.getObjects();
      
      // Calculate for both front and back sides
      let frontMaxPrice = 0;
      let backMaxPrice = 0;
      let frontTotalAreaPixels = 0;
      let backTotalAreaPixels = 0;
      let frontMaxWidthPixels = 0;
      let frontMaxHeightPixels = 0;
      let backMaxWidthPixels = 0;
      let backMaxHeightPixels = 0;
      const frontPerLayerMetrics: Array<{
        id: string;
        type: string;
        widthPixels: number;
        heightPixels: number;
        areaPixels: number;
        widthInches: number;
        heightInches: number;
        areaInches: number;
        dpi?: number;
        cost: number;
      }> = [];
      const backPerLayerMetrics: Array<{
        id: string;
        type: string;
        widthPixels: number;
        heightPixels: number;
        areaPixels: number;
        widthInches: number;
        heightInches: number;
        areaInches: number;
        dpi?: number;
        cost: number;
      }> = [];

      objects.forEach((obj) => {
        // Skip background and base images
        if (!obj.selectable || (obj as any).name === "tshirt-base" || (obj as any).name === "tshirt-base-photo" || (obj as any).name === "bg-photo") {
          return;
        }

        // Get the side this object belongs to
        const objSide = (obj as any).designSide as ("front" | "back" | undefined);
        if (!objSide) return; // Skip if no side assigned

        // Get the size preset ID from the object
        const sizeId = (obj as any).designSizeId;
        const sizePreset = sizeId ? STANDARD_DESIGN_SIZES.find(s => s.id === sizeId) : null;
        
        // Use fixed price if size preset exists, otherwise fallback to pixel-based
        let elementPrice = 0;
        if (sizePreset && sizePreset.price) {
          elementPrice = sizePreset.price;
        } else {
          // Fallback to pixel-based pricing if no size preset
          const layerDPI = (obj as any).dpi
            ? Number((obj as any).dpi)
            : ((obj.type === 'text' || obj.type === 'textbox') ? DEFAULT_TEXT_DPI : 300);
          
          const widthPixels = typeof (obj as any).getScaledWidth === 'function' ? (obj as any).getScaledWidth() : Math.abs((obj.width || 0) * (obj.scaleX || 1));
          const heightPixels = typeof (obj as any).getScaledHeight === 'function' ? (obj as any).getScaledHeight() : Math.abs((obj.height || 0) * (obj.scaleY || 1));
          const areaPixels = widthPixels * heightPixels;
          elementPrice = areaPixels * PRICE_PER_PIXEL;
        }

        // Calculate metrics for display (still needed for UI)
        const layerDPI = (obj as any).dpi
          ? Number((obj as any).dpi)
          : ((obj.type === 'text' || obj.type === 'textbox') ? DEFAULT_TEXT_DPI : 300);

        const widthPixels = typeof (obj as any).getScaledWidth === 'function' ? (obj as any).getScaledWidth() : Math.abs((obj.width || 0) * (obj.scaleX || 1));
        const heightPixels = typeof (obj as any).getScaledHeight === 'function' ? (obj as any).getScaledHeight() : Math.abs((obj.height || 0) * (obj.scaleY || 1));
        const areaPixels = widthPixels * heightPixels;

        const widthInches = widthPixels / layerDPI;
        const heightInches = heightPixels / layerDPI;
        const areaInches = areaPixels / (layerDPI * layerDPI);

        const metrics = {
          id: (obj as any).layerId,
          type: (obj as any).type as string,
          widthPixels,
          heightPixels,
          areaPixels,
          widthInches,
          heightInches,
          areaInches,
          dpi: layerDPI,
          cost: elementPrice,
        };

        if (objSide === "front") {
          frontMaxPrice = Math.max(frontMaxPrice, elementPrice);
          frontMaxWidthPixels = Math.max(frontMaxWidthPixels, widthPixels);
          frontMaxHeightPixels = Math.max(frontMaxHeightPixels, heightPixels);
          frontTotalAreaPixels += areaPixels;
          frontPerLayerMetrics.push(metrics);
        } else if (objSide === "back") {
          backMaxPrice = Math.max(backMaxPrice, elementPrice);
          backMaxWidthPixels = Math.max(backMaxWidthPixels, widthPixels);
          backMaxHeightPixels = Math.max(backMaxHeightPixels, heightPixels);
          backTotalAreaPixels += areaPixels;
          backPerLayerMetrics.push(metrics);
        }
      });

      // Calculate metrics for front
      const frontWidthInches = frontMaxWidthPixels / 300;
      const frontHeightInches = frontMaxHeightPixels / 300;
      const frontAreaInches = frontTotalAreaPixels / (300 * 300);
      
      // Calculate metrics for back
      const backWidthInches = backMaxWidthPixels / 300;
      const backHeightInches = backMaxHeightPixels / 300;
      const backAreaInches = backTotalAreaPixels / (300 * 300);
      
      // Update both sides' customization costs
      setFrontCustomizationCost(frontMaxPrice);
      setFrontDesignMetrics({ 
        widthInches: frontWidthInches, 
        heightInches: frontHeightInches, 
        areaInches: frontAreaInches, 
        totalPixels: frontTotalAreaPixels, 
        perLayer: frontPerLayerMetrics 
      });
      
      setBackCustomizationCost(backMaxPrice);
      setBackDesignMetrics({ 
        widthInches: backWidthInches, 
        heightInches: backHeightInches, 
        areaInches: backAreaInches, 
        totalPixels: backTotalAreaPixels, 
        perLayer: backPerLayerMetrics 
      });
      
      console.log(`[Pricing] Front: $${frontMaxPrice.toFixed(2)}, Back: $${backMaxPrice.toFixed(2)} (based on size presets)`);
    };

    // Debounced update to prevent too many rapid calculations
    let updateTimeout: NodeJS.Timeout;
    const debouncedUpdate = () => {
      clearTimeout(updateTimeout);
      updateTimeout = setTimeout(calculateTotalPrice, 100);
    };

    // Add event listeners (scaling disabled, but keep listener for safety)
    fabricCanvas.on("object:modified", debouncedUpdate);
    fabricCanvas.on("object:moving", debouncedUpdate);
    fabricCanvas.on("object:rotating", debouncedUpdate);
    fabricCanvas.on("object:added", debouncedUpdate);
    fabricCanvas.on("object:removed", debouncedUpdate);

    // Cleanup
    return () => {
      clearTimeout(updateTimeout);
      fabricCanvas.off("object:modified", debouncedUpdate);
      fabricCanvas.off("object:moving", debouncedUpdate);
      fabricCanvas.off("object:rotating", debouncedUpdate);
      fabricCanvas.off("object:added", debouncedUpdate);
      fabricCanvas.off("object:removed", debouncedUpdate);
    };
  }, [fabricCanvas, basePrice, frontDesignLayers, backDesignLayers]);

  // Close color dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (colorDropdownRef.current && !colorDropdownRef.current.contains(event.target as Node)) {
        setShowColorDropdown(false);
      }
    };

    if (showColorDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showColorDropdown]);

  // Step handlers
  const handleCategorySelect = async (category: Category) => {
    setSelectedCategory(category);
    setLoading(true);
    try {
      const allProducts = await fetchProducts();
      // Filter products by category (simplified - you can add category field to products later)
      setProducts(allProducts);
      setStep("product");
      toast.success(`Selected ${category.name}`);
    } catch (error) {
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateSelect = useCallback(
    (template: TemplateAsset) => {
      setTemplateInfo({ id: template._id, imageUrl: template.image.url });
      setTemplateApplied(false);
      setTemplatePopoverOpen(false);
      toast.success("Template applied to canvas");
    },
    []
  );

  const handleProductSelect = async (product: Product) => {
    setSelectedProduct(product);
    // Automatically select the first color variant
    if (product.variants && product.variants.length > 0) {
      setSelectedColor(product.variants[0].color);
    }
    setStep("design");
    toast.success(`Selected ${product.name}`);
  };

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    setStep("design");
    toast.success(`Selected color: ${color}`);
  };

  const handleBack = () => {
    if (step === "product") {
      setStep("category");
      setSelectedCategory(null);
      setProducts([]);
    } else if (step === "design") {
      setStep("product");
      setSelectedColor(null);
    }
  };

  const addTShirtBase = (canvas: FabricCanvas, color: string) => {
    const tshirtSvg = `
      <svg width="400" height="500" viewBox="0 0 400 500" xmlns="http://www.w3.org/2000/svg">
        <path d="M50 80 L50 480 L350 480 L350 80 L320 50 L280 70 L280 30 L120 30 L120 70 L80 50 Z" 
              fill="${color}" stroke="#ccc" stroke-width="2"/>
        <circle cx="200" cy="150" r="100" fill="${color}" opacity="0.3"/>
      </svg>
    `;
    
    const blob = new Blob([tshirtSvg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    
    FabricImage.fromURL(url).then((img) => {
      img.set({
        left: 50,
        top: 50,
        selectable: false,
        evented: false,
      });
      (img as any).name = "tshirt-base";
      canvas.add(img);
      canvas.sendObjectToBack(img);
      canvas.renderAll();
    });
  };

  const addBackgroundPhoto = (canvas: FabricCanvas) => {
    const url = "/placeholder.svg"; // uses existing public asset
    FabricImage.fromURL(url).then((img) => {
      img.set({ left: 0, top: 0, selectable: false, evented: false, opacity: 0.25 });
      // Use actual canvas dimensions
      const canvasW = canvas.getWidth();
      const canvasH = canvas.getHeight();
      const scaleX = canvasW / (img.width || canvasW);
      const scaleY = canvasH / (img.height || canvasH);
      const scale = Math.max(scaleX, scaleY);
      img.scale(scale);
      const newW = (img.width || 0) * scale;
      const newH = (img.height || 0) * scale;
      img.set({ left: (canvasW - newW) / 2, top: (canvasH - newH) / 2 });
      (img as any).name = "bg-photo";
      canvas.add(img);
      canvas.sendObjectToBack(img);
      (canvas as any).backgroundColor = "#f5f5f5";
      canvas.renderAll();
    });
  };

  const addProductPhotoBase = (canvas: FabricCanvas, url: string) => {
    FabricImage.fromURL(url, { crossOrigin: "anonymous" })
      .then((img) => {
        // eslint-disable-next-line no-console
        console.log("[Customize] Base image loaded successfully");
        img.set({ selectable: false, evented: false });
        // Use actual canvas dimensions instead of hardcoded values
        const canvasW = canvas.getWidth();
        const canvasH = canvas.getHeight();
        const scaleX = canvasW / (img.width || canvasW);
        const scaleY = canvasH / (img.height || canvasH);
        const scale = Math.max(scaleX, scaleY);
        img.scale(scale);
        const newW = (img.width || 0) * scale;
        const newH = (img.height || 0) * scale;
        img.set({ left: (canvasW - newW) / 2, top: (canvasH - newH) / 2 });
        (img as any).name = "tshirt-base-photo";
        canvas.add(img);
        // keep base above background but below custom elements
        canvas.sendObjectToBack(img);
        // but ensure bg-photo (if exists) stays at very back
        const bg = canvas.getObjects().find((o) => (o as any).name === "bg-photo");
        if (bg) {
          canvas.sendObjectToBack(bg);
        }
        canvas.renderAll();
        // eslint-disable-next-line no-console
        console.log("[Customize] Base image loaded successfully for", designSide, "Dimensions:", canvasW, "x", canvasH);
        // eslint-disable-next-line no-console
        console.log("[Customize] Image positioning - Scale:", scale, "Size:", newW, "x", newH, "Position:", (canvasW - newW) / 2, ",", (canvasH - newH) / 2);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[Customize] Failed to load base image:", err);
        toast.error("Failed to load product image");
      });
  };

  // Pick appropriate base image for the selected side
  const pickVariantImageForSide = (variant: Product["variants"][number], side: "front" | "back") => {
    if (!variant) return undefined;

    const getUrl = (images?: Array<{ url: string }>) =>
      images && images.length ? images[0]?.url : undefined;

    if (side === "front") {
      const front = getUrl((variant as any).frontImages);
      if (front) return front;
    } else {
      const back = getUrl((variant as any).backImages);
      if (back) return back;
    }

    if (Array.isArray(variant.images) && variant.images.length) {
      const lower = (s: string) => s.toLowerCase();
      const hinted = variant.images.find((img) =>
        side === "back" ? lower(img.url).includes("back") : lower(img.url).includes("front")
      );
      if (hinted) return hinted.url;

      // Fallback — assume images array is [front, back, ...]
      if (side === "front") return variant.images[0]?.url;
      return variant.images[1]?.url || variant.images[0]?.url;
    }

    return undefined;
  };

  const handleAddText = () => {
    if (!fabricCanvas) return;
    const content = textInput.trim();
    if (!content) {
      toast.error("Please type your text first.");
      return;
    }

    // Check if there's an active text object selected
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject && (activeObject as any).name === "custom-text") {
      // Edit existing text
      const layerId = (activeObject as any).layerId;
      (activeObject as any).set({ text: content });
      
      // Update the layer data
      const updatedLayers = designLayers.map(layer => {
        if (layer.id === layerId) {
          return {
            ...layer,
            data: {
              ...layer.data,
              content: content
            }
          };
        }
        return layer;
      });
      setDesignLayers(updatedLayers);
      
      fabricCanvas.renderAll();
      toast.success("Text updated!");
    } else {
      // Add new text
      const sizePreset = STANDARD_DESIGN_SIZES.find(s => s.id === selectedDesignSize) || STANDARD_DESIGN_SIZES[2];
      // Calculate font size to fit within the standard size (approximate)
      const maxDimension = Math.max(sizePreset.width, sizePreset.height);
      const calculatedFontSize = Math.min(fontSize, maxDimension * 0.3); // Scale font to fit
      
      const text = new FabricText(content, {
        left: 200,
        top: 250,
        fontSize: calculatedFontSize,
        fill: textColor,
        fontFamily: selectedFont,
      });
      (text as any).name = "custom-text";
      (text as any).layerId = `text-${Date.now()}`;
      (text as any).designSide = designSide;
      (text as any).designSizeId = selectedDesignSize; // Store the size preset ID

      // Apply size constraints
      configureObjectControls(text);
      
      // Scale text to fit within standard size if needed
      const textBBox = text.getBoundingRect();
      if (textBBox.width > sizePreset.width || textBBox.height > sizePreset.height) {
        const scaleX = sizePreset.width / textBBox.width;
        const scaleY = sizePreset.height / textBBox.height;
        const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down
        text.scale(scale);
      }

      fabricCanvas.add(text);
      fabricCanvas.setActiveObject(text);
      fabricCanvas.renderAll();

      // Add to design layers
      const layer: DesignLayer = {
        id: (text as any).layerId,
        type: "text",
        data: {
          content,
          font: selectedFont,
          color: textColor,
          size: fontSize,
          x: 200,
          y: 250,
          scale: 1,
          rotation: 0,
        },
        // Fixed cost for layer tracking (not used for pricing anymore)
        cost: selectedProduct?.customizationPricing?.perTextLayer || 10,
        designSizeId: selectedDesignSize, // Save the size preset ID
      };
      setDesignLayers([...designLayers, layer]);

      toast.success("Text added! Drag to reposition.");
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fabricCanvas) return;
  
    // ✅ Get real DPI
    const dpi = await getImageDPI(file);
  
    const reader = new FileReader();
    reader.onload = async (f) => {
      const data = f.target?.result as string;
      FabricImage.fromURL(data).then((img) => {
        // Get the selected size preset
        const sizePreset = STANDARD_DESIGN_SIZES.find(s => s.id === selectedDesignSize) || STANDARD_DESIGN_SIZES[2];
        
        // Calculate scale to fit within standard size
        const iw = img.width || 1;
        const ih = img.height || 1;
        const maxW = sizePreset.width;
        const maxH = sizePreset.height;
        
        // Scale to fit within the standard size while maintaining aspect ratio
        const scaleToFit = Math.min(maxW / iw, maxH / ih, 1); // Don't scale up, only down
        
        img.set({
          left: 200,
          top: 200,
          scaleX: scaleToFit,
          scaleY: scaleToFit,
          selectable: true,
        });
        (img as any).name = "custom-image";
        (img as any).layerId = Date.now().toString();
        (img as any).dpi = dpi; // ✅ Store per image DPI
        (img as any).designSide = designSide;
        (img as any).designSizeId = selectedDesignSize; // Store the size preset ID

        // Apply size constraints (disable resizing)
        configureObjectControls(img);
  
        fabricCanvas.add(img);
        fabricCanvas.setActiveObject(img);
        fabricCanvas.renderAll();
  
        const newLayer: DesignLayer = {
          id: (img as any).layerId,
          type: "image",
          data: {
            url: data,
            x: img.left!,
            y: img.top!,
            scale: img.scaleX!,
            rotation: img.angle || 0,
            dpi: dpi, // ✅ Save DPI in layer state
          },
          cost: selectedProduct?.customizationPricing?.perImageLayer || 20,
          designSizeId: selectedDesignSize, // Save the size preset ID
        };
  
        if (designSide === "front") {
          setFrontDesignLayers((prev) => [...prev, newLayer]);
        } else {
          setBackDesignLayers((prev) => [...prev, newLayer]);
        }
      });
    };
    reader.readAsDataURL(file);
  };
  

  const handleDeleteSelected = () => {
    if (!fabricCanvas) return;
    
    const activeObject = fabricCanvas.getActiveObject();
    if (
      activeObject &&
      (activeObject as any).name !== "tshirt-base" &&
      (activeObject as any).name !== "tshirt-base-photo" &&
      (activeObject as any).name !== "bg-photo"
    ) {
      const layerId = (activeObject as any).layerId;
      if (layerId) {
        if (designSide === "front") {
          setFrontDesignLayers(frontDesignLayers.filter((layer) => layer.id !== layerId));
        } else {
          setBackDesignLayers(backDesignLayers.filter((layer) => layer.id !== layerId));
        }
      }
      fabricCanvas.remove(activeObject);
      fabricCanvas.renderAll();
      toast.success("Element deleted!");
    }
  };

  const handleRotate = () => {
    if (!fabricCanvas) return;
    
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject) {
      activeObject.rotate((activeObject.angle || 0) + 15);
      fabricCanvas.renderAll();
    }
  };

  // Helper function to apply size preset to an object
  const applySizePresetToObject = (obj: any, sizePreset: typeof STANDARD_DESIGN_SIZES[0], recalculateFromOriginal: boolean = false) => {
    if (obj.name === "custom-text") {
      // For text, we need to get dimensions at scale 1
      const currentScale = obj.scaleX || 1;
      
      // Temporarily reset scale to get true dimensions
      obj.scaleX = 1;
      obj.scaleY = 1;
      const textBBox = obj.getBoundingRect();
      const originalWidth = textBBox.width;
      const originalHeight = textBBox.height;
      
      // Calculate scale needed to fit within new size preset
      const scaleX = sizePreset.width / originalWidth;
      const scaleY = sizePreset.height / originalHeight;
      const newScale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down
      
      // Apply the new scale
      obj.scaleX = newScale;
      obj.scaleY = newScale;
      
      // Re-apply constraints
      configureObjectControls(obj);
      
    } else if (obj.name === "custom-image") {
      // For images, get original dimensions (at scale 1)
      const originalWidth = obj.width || 1;
      const originalHeight = obj.height || 1;
      
      // Calculate scale to fit within the new size preset
      const scaleX = sizePreset.width / originalWidth;
      const scaleY = sizePreset.height / originalHeight;
      const newScale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down
      
      // Apply new scale from original dimensions
      obj.scaleX = newScale;
      obj.scaleY = newScale;
      
      // Re-apply constraints
      configureObjectControls(obj);
    }
  };

  // Change size of selected object
  const handleChangeObjectSize = (sizeId: string) => {
    if (!fabricCanvas) return;
    
    const activeObject = fabricCanvas.getActiveObject();
    if (!activeObject || ((activeObject as any).name !== "custom-text" && (activeObject as any).name !== "custom-image")) {
      toast.error("Please select a text or image element to change its size");
      return;
    }

    const sizePreset = STANDARD_DESIGN_SIZES.find(s => s.id === sizeId);
    if (!sizePreset) return;

    const obj = activeObject as any;
    
    // Apply the size preset
    applySizePresetToObject(obj, sizePreset);
    
    // Update the stored size ID
    obj.designSizeId = sizeId;
    
    fabricCanvas.renderAll();
    toast.success(`Size changed to ${sizePreset.name}`);
  };

  // Refresh all objects on canvas to use current size preset dimensions
  const refreshAllObjectSizes = () => {
    if (!fabricCanvas) return;
    
    const objects = fabricCanvas.getObjects();
    let updatedCount = 0;
    
    objects.forEach((obj: any) => {
      if ((obj.name === "custom-text" || obj.name === "custom-image") && obj.designSizeId) {
        const sizePreset = STANDARD_DESIGN_SIZES.find(s => s.id === obj.designSizeId);
        if (sizePreset) {
          applySizePresetToObject(obj, sizePreset);
          updatedCount++;
        }
      }
    });
    
    if (updatedCount > 0) {
      fabricCanvas.renderAll();
      toast.success(`Updated ${updatedCount} element(s) with new size dimensions`);
    }
  };

  const handleReset = () => {
    if (!fabricCanvas) return;
    
    const objects = fabricCanvas.getObjects();
    objects.forEach((obj) => {
      const name = (obj as any).name;
      if (name !== "tshirt-base" && name !== "tshirt-base-photo" && name !== "bg-photo") {
        fabricCanvas.remove(obj);
      }
    });
    
    fabricCanvas.renderAll();
    if (designSide === "front") {
      setFrontDesignLayers([]);
    } else {
      setBackDesignLayers([]);
    }
    toast.success(`${designSide === "front" ? "Front" : "Back"} design reset!`);
  };

  const handleDownload = () => {
    if (!fabricCanvas) return;
    
    const dataURL = fabricCanvas.toDataURL({
      format: "png",
      quality: 1,
      multiplier: 2,
    });
    
    const link = document.createElement("a");
    link.download = "custom-tshirt.png";
    link.href = dataURL;
    link.click();
    
    toast.success("Design downloaded!");
  };


  const prepareCartItem = async () => {
    const token = localStorage.getItem('token');
    if (!token) throw new Error("Please login to add items to cart");

    try {
      console.log("[Customize] Starting add to cart process...");
      console.log("[Customize] User token exists:", !!token);
      
      // Sync current canvas object positions/styles back into layer state for accuracy
      const syncLayersFromCanvas = (layers: DesignLayer[]): DesignLayer[] => {
        if (!fabricCanvas) return layers;
        const objects = fabricCanvas.getObjects();
        return layers.map((layer) => {
          const obj = objects.find((o: any) => (o as any).layerId === layer.id) as any;
          if (!obj) return layer;
          const next = { ...layer } as DesignLayer;
          next.data = {
            ...next.data,
            x: obj.left || 0,
            y: obj.top || 0,
            rotation: obj.angle || 0,
            // prefer scaleX for uniform scaling; Fabric uses separate X/Y
            scale: typeof obj.scaleX === 'number' ? obj.scaleX : (next.data.scale || 1),
            size: obj.fontSize || next.data.size,
            color: obj.fill || next.data.color,
            font: obj.fontFamily || next.data.font,
          } as any;
          // Sync the size preset ID from the canvas object
          if (obj.designSizeId) {
            next.designSizeId = obj.designSizeId;
          }
          return next;
        });
      };

      const updatedFrontLayers = designSide === 'front' ? syncLayersFromCanvas(frontDesignLayers) : frontDesignLayers;
      const updatedBackLayers = designSide === 'back' ? syncLayersFromCanvas(backDesignLayers) : backDesignLayers;

      const currentDesignData = fabricCanvas.toJSON();

      // Helper: compress a dataURL png/jpeg
      const compressImage = (dataUrl: string, quality: number = 0.7): Promise<string> => {
        return new Promise<string>((resolve) => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const img = new Image();
          
          img.onload = () => {
            // Set canvas size to reasonable dimensions
            const maxWidth = 400;
            const maxHeight = 500;
            let { width, height } = img;
            
            if (width > maxWidth || height > maxHeight) {
              const ratio = Math.min(maxWidth / width, maxHeight / height);
              width *= ratio;
              height *= ratio;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
          };
          
          img.src = dataUrl;
        });
      };

      // Generate preview images for both sides regardless of current side
      const generatePreviewForSide = async (side: "front" | "back") => {
        // If we're currently on this side, take directly from current canvas
        if (side === designSide) {
          const dataUrl = fabricCanvas.toDataURL({ format: "png", quality: 1, multiplier: 2 });
          return compressImage(dataUrl, 0.6);
        }

        const targetLayers = side === 'front' ? updatedFrontLayers : updatedBackLayers;
        // Create a temporary canvas to render that side
        const tempCanvasEl = document.createElement('canvas');
        tempCanvasEl.width = 500;
        tempCanvasEl.height = 600;
        const tempCanvas = new FabricCanvas(tempCanvasEl, { width: 500, height: 600, backgroundColor: 'transparent' });

        // Base product image for that side
        if (selectedProduct && selectedColor) {
          const variant = selectedProduct.variants.find((v) => v.color === selectedColor);
          const imgUrl = variant ? pickVariantImageForSide(variant, side) : undefined;
          if (imgUrl) {
            try {
              const baseImg = await FabricImage.fromURL(imgUrl, { crossOrigin: 'anonymous' });
              baseImg.set({ selectable: false, evented: false });
              const canvasW = 500; const canvasH = 600;
              const scaleX = canvasW / (baseImg.width || canvasW);
              const scaleY = canvasH / (baseImg.height || canvasH);
              const scale = Math.max(scaleX, scaleY);
              baseImg.scale(scale);
              const newW = (baseImg.width || 0) * scale;
              const newH = (baseImg.height || 0) * scale;
              baseImg.set({ left: (canvasW - newW) / 2, top: (canvasH - newH) / 2 });
              (baseImg as any).name = 'tshirt-base-photo';
              tempCanvas.add(baseImg);
              tempCanvas.sendObjectToBack(baseImg);
            } catch {}
          }
        }

        // Add layers
        const imagePromises: Promise<any>[] = [];
        targetLayers.forEach((layer) => {
          if (layer.type === 'text') {
            const t = new FabricText(layer.data.content || '', {
              left: layer.data.x,
              top: layer.data.y,
              fontSize: layer.data.size,
              fill: layer.data.color,
              fontFamily: layer.data.font,
              angle: layer.data.rotation,
              scaleX: layer.data.scale,
              scaleY: layer.data.scale,
            });
            (t as any).name = 'custom-text';
            (t as any).layerId = layer.id;
            tempCanvas.add(t);
          } else if (layer.type === 'image' && layer.data.url) {
            imagePromises.push(
              FabricImage.fromURL(layer.data.url).then((img) => {
                img.set({ left: layer.data.x, top: layer.data.y, angle: layer.data.rotation, scaleX: layer.data.scale, scaleY: layer.data.scale });
                (img as any).name = 'custom-image';
                (img as any).layerId = layer.id;
                tempCanvas.add(img);
                return img;
              })
            );
          }
        });

        await Promise.all(imagePromises);
        tempCanvas.renderAll();
        const dataUrl = tempCanvas.toDataURL({ format: 'png', quality: 1, multiplier: 2 });
        tempCanvas.dispose();
        tempCanvasEl.remove();
        return compressImage(dataUrl, 0.6);
      };

      const frontPreviewImage = await generatePreviewForSide('front');
      const backPreviewImage = await generatePreviewForSide('back');

      // Prepare cart item data
      const cartItem: any = {
        productId: selectedProduct._id,
        productName: selectedProduct.name,
        productSlug: selectedProduct.slug,
        selectedColor,
        selectedSize,
        frontDesign: {
          designData: currentDesignData,
          designLayers: updatedFrontLayers,
          previewImage: frontPreviewImage,
          metrics: frontDesignMetrics,
        },
        backDesign: {
          designData: currentDesignData,
          designLayers: updatedBackLayers,
          previewImage: backPreviewImage,
          metrics: backDesignMetrics,
        },
        basePrice,
        frontCustomizationCost,
        backCustomizationCost,
        totalPrice,
        quantity: 1,
      };

      // Check if cart item is too large for MongoDB (16MB limit)
      const cartItemSize = JSON.stringify(cartItem).length;
      console.log("[Customize] Cart item size:", cartItemSize, "bytes");
      
      if (cartItemSize > 15 * 1024 * 1024) { // 15MB safety margin
        throw new Error("Design data is too large. Please reduce image size or remove some elements.");
      }
      
      console.log("[Customize] Cart item prepared:", cartItem);
      console.log("[Customize] Front design preview image length:", cartItem.frontDesign.previewImage?.length);
      console.log("[Customize] Front design preview image start:", cartItem.frontDesign.previewImage?.substring(0, 50));
      
      // Add to cart via context
      return cartItem;
    } catch (error) {
      throw error;
    }
  };

  const handleAddToCart = async () => {
    if (!fabricCanvas || !selectedProduct || !selectedColor) {
      toast.error("Please complete all steps before adding to cart");
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      toast.error("Please login to add items to cart");
      return;
    }

    setAddingToCart(true);

    try {
      const cartItem = await prepareCartItem();
      if (!cartItem) {
        throw new Error("Unable to prepare cart item.");
      }
      if (orderInstruction.trim()) {
        cartItem.instruction = orderInstruction.trim();
      }

      await addItemToCart(cartItem);
      setOrderInstruction("");
      setInstructionDialogOpen(false);
    } catch (error: any) {
      console.error("[Customize] Add to cart error:", error);
      toast.error(error?.message || "Failed to add to cart");
    } finally {
      setAddingToCart(false);
    }
  };

  const handleSaveDesign = async () => {
    if (!fabricCanvas || !selectedProduct || !selectedColor) {
      toast.error("Please complete all steps before saving");
      return;
    }
    
    setSavingDesign(true);
    try {
      // Sync current canvas object positions/styles back into layer state for accuracy
      const syncLayersFromCanvas = (layers: DesignLayer[]): DesignLayer[] => {
        if (!fabricCanvas) return layers;
        const objects = fabricCanvas.getObjects();
        return layers.map((layer) => {
          const obj = objects.find((o: any) => (o as any).layerId === layer.id) as any;
          if (!obj) return layer;
          const next = { ...layer } as DesignLayer;
          next.data = {
            ...next.data,
            x: obj.left || 0,
            y: obj.top || 0,
            rotation: obj.angle || 0,
            // prefer scaleX for uniform scaling; Fabric uses separate X/Y
            scale: typeof obj.scaleX === 'number' ? obj.scaleX : (next.data.scale || 1),
            size: obj.fontSize || next.data.size,
            color: obj.fill || next.data.color,
            font: obj.fontFamily || next.data.font,
          } as any;
          // Sync the size preset ID from the canvas object
          if (obj.designSizeId) {
            next.designSizeId = obj.designSizeId;
          }
          return next;
        });
      };

      const updatedFrontLayers = designSide === 'front' ? syncLayersFromCanvas(frontDesignLayers) : frontDesignLayers;
      const updatedBackLayers = designSide === 'back' ? syncLayersFromCanvas(backDesignLayers) : backDesignLayers;

      const currentDesignData = fabricCanvas.toJSON();
      const currentPreviewImage = fabricCanvas.toDataURL({ format: "png", quality: 1, multiplier: 2 });
      
      // Generate preview images for both front and back designs
      const generatePreviewForSide = async (side: "front" | "back") => {
        if (side === designSide) {
          // If we're currently on this side, use the current canvas
          return currentPreviewImage;
        } else {
          // If we're not on this side, we need to temporarily switch and generate preview
          const targetLayers = side === "front" ? updatedFrontLayers : updatedBackLayers;
          
          // Create a temporary canvas to generate preview
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = 500;
          tempCanvas.height = 600;
          const tempFabricCanvas = new FabricCanvas(tempCanvas, {
            width: 500,
            height: 600,
            backgroundColor: "transparent",
          });
          
          // Add base product image for this side
          if (selectedProduct && selectedColor) {
            const variant = selectedProduct.variants.find((v) => v.color === selectedColor);
            const imgUrl = variant ? pickVariantImageForSide(variant, side) : undefined;
            if (imgUrl) {
              try {
                const img = await FabricImage.fromURL(imgUrl, { crossOrigin: "anonymous" });
                img.set({ selectable: false, evented: false });
                
                // Scale and position the image
                const canvasW = 500;
                const canvasH = 600;
                const scaleX = canvasW / (img.width || canvasW);
                const scaleY = canvasH / (img.height || canvasH);
                const scale = Math.max(scaleX, scaleY);
                img.scale(scale);
                const newW = (img.width || 0) * scale;
                const newH = (img.height || 0) * scale;
                const left = (canvasW - newW) / 2;
                const top = (canvasH - newH) / 2;
                img.set({ left, top });
                (img as any).name = "tshirt-base-photo";
                tempFabricCanvas.add(img);
                tempFabricCanvas.sendObjectToBack(img);
              } catch (err) {
                console.error("Failed to load base image for preview:", err);
              }
            }
          }
          // Add design layers for this side - wait for all images to load
          const imagePromises = [];
          targetLayers.forEach((layer) => {
            if (layer.type === "text") {
              const text = new FabricText(layer.data.content || "", {
                left: layer.data.x,
                top: layer.data.y,
                fontSize: layer.data.size,
                fill: layer.data.color,
                fontFamily: layer.data.font,
                angle: layer.data.rotation,
                scaleX: layer.data.scale,
                scaleY: layer.data.scale,
              });
              (text as any).name = "custom-text";
              (text as any).layerId = layer.id;
              tempFabricCanvas.add(text);
            } else if (layer.type === "image" && layer.data.url) {
              const imagePromise = FabricImage.fromURL(layer.data.url).then((img) => {
                img.set({
                  left: layer.data.x,
                  top: layer.data.y,
                  angle: layer.data.rotation,
                  scaleX: layer.data.scale,
                  scaleY: layer.data.scale,
                });
                (img as any).name = "custom-image";
                (img as any).layerId = layer.id;
                tempFabricCanvas.add(img);
                return img;
              });
              imagePromises.push(imagePromise);
            }
          });
          
          // Wait for all images to load before generating preview
          await Promise.all(imagePromises);
          tempFabricCanvas.renderAll();
          
          // Wait a bit more to ensure all rendering is complete
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const previewImage = tempFabricCanvas.toDataURL({ format: "png", quality: 1, multiplier: 2 });
          
          // Clean up temporary canvas
          tempFabricCanvas.dispose();
          tempCanvas.remove();
          
          return previewImage;
        }
      };
      
      // Generate preview images for both sides
      const frontPreviewImage = await generatePreviewForSide("front");
      const backPreviewImage = await generatePreviewForSide("back");
      
      const payload = {
        name: `${selectedProduct.name} - ${selectedColor} (${selectedSize})`,
        productId: selectedProduct._id,
        productName: selectedProduct.name,
        productSlug: selectedProduct.slug,
        selectedColor,
        selectedSize,
        frontDesign: {
          designData: currentDesignData,
          designLayers: updatedFrontLayers,
          previewImage: frontPreviewImage,
        },
        backDesign: {
          designData: currentDesignData,
          designLayers: updatedBackLayers,
          previewImage: backPreviewImage,
        },
        totalPrice,
      };
      await saveMyDesign(payload);
      toast.success("Design saved to your account");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save design");
    } finally {
      setSavingDesign(false);
    }
  };

  const applyTransparentBgToActiveImage = (enabled: boolean) => {
    if (!fabricCanvas) return;
    const active = fabricCanvas.getActiveObject() as any;
    if (!active || active.type !== "image") {
      if (enabled) toast.error("Select an image to make background transparent.");
      return;
    }

    const fabricNS: any = (window as any).fabric;
    const RemoveColor = fabricNS?.Image?.filters?.RemoveColor;
    if (!RemoveColor) {
      toast.error("Transparent background not supported in this browser.");
      return;
    }

    active.filters = active.filters || [];
    if (enabled) {
      // remove any existing RemoveColor filter then add one
      active.filters = active.filters.filter((f: any) => !(f && f.type === "RemoveColor"));
      const filter = new RemoveColor({ color: transparentColor, distance: 0.25 });
      filter.type = "RemoveColor"; // help identification
      active.filters.push(filter);
    } else {
      active.filters = active.filters.filter((f: any) => !(f && f.type === "RemoveColor"));
    }
    active.applyFilters();
    fabricCanvas.requestRenderAll();
  };

  // Step indicator component
  const StepIndicator = () => {
    const steps = [
      { id: "category", label: "Category", icon: "📂" },
      { id: "product", label: "Product", icon: "👕" },
      { id: "design", label: "Design", icon: "✏️" },
    ];

    const currentStepIndex = steps.findIndex((s) => s.id === step);

    return (
      <div className="flex items-center justify-center gap-4 mb-8">
        {steps.map((s, idx) => (
          <div key={s.id} className="flex items-center">
            <div
              className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all ${
                idx <= currentStepIndex
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border"
              }`}
            >
              <span className="text-xl">{s.icon}</span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`w-16 h-1 mx-2 transition-all ${
                  idx < currentStepIndex ? "bg-primary" : "bg-border"
                }`}
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  // ---- At top inside Customize() ----
  const [activeLayerMetric, setActiveLayerMetric] = useState<any>(null);
  const [activeLayerType, setActiveLayerType] = useState<string | null>(null);

  useEffect(() => {
    if (!fabricCanvas) return;
    const updateActiveLayerMetric = () => {
      const activeObject = fabricCanvas.getActiveObject();
      let selectedId = null;
      let selectedType = null;
      let metrics = designSide === "front" ? frontDesignMetrics : backDesignMetrics;
      let layerMetric = null;
      if (activeObject) {
        selectedId = (activeObject as any).layerId;
        selectedType = (activeObject as any).name;
        if (selectedId && metrics && metrics.perLayer) {
          layerMetric = metrics.perLayer.find((l) => l.id === selectedId);
        }
      }
      setActiveLayerMetric(layerMetric);
      setActiveLayerType(selectedType);
    };

    // Listen to relevant canvas events
    fabricCanvas.on("selection:created", updateActiveLayerMetric);
    fabricCanvas.on("selection:updated", updateActiveLayerMetric);
    fabricCanvas.on("selection:cleared", updateActiveLayerMetric);
    fabricCanvas.on("object:modified", updateActiveLayerMetric);
    fabricCanvas.on("object:scaling", updateActiveLayerMetric);
    fabricCanvas.on("object:moving", updateActiveLayerMetric);
    // Also update on metrics change (handler below will trigger this effect)

    // Initial effect call
    updateActiveLayerMetric();

    return () => {
      fabricCanvas.off("selection:created", updateActiveLayerMetric);
      fabricCanvas.off("selection:updated", updateActiveLayerMetric);
      fabricCanvas.off("selection:cleared", updateActiveLayerMetric);
      fabricCanvas.off("object:modified", updateActiveLayerMetric);
      fabricCanvas.off("object:scaling", updateActiveLayerMetric);
      fabricCanvas.off("object:moving", updateActiveLayerMetric);
    };
  }, [fabricCanvas, frontDesignMetrics, backDesignMetrics, designSide]);
  // ---- End top ----

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/20">
      <Navbar />

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-8 flex-1 overflow-x-hidden">

        <AnimatePresence mode="wait">
          {/* Step 1: Category Selection */}
          {step === "category" && (
            <motion.div
              key="category"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="max-w-4xl mx-auto"
            >
              <Card>
                <CardContent className="p-4 sm:p-6 md:p-8">
                  <h2 className="text-xl sm:text-2xl font-semibold mb-4 sm:mb-6 text-center">Select a Category</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                    {CATEGORIES.map((category) => (
                      <Button
                        key={category.id}
                        variant="outline"
                        className="h-24 sm:h-32 flex flex-col gap-1 sm:gap-2 text-xs sm:text-sm"
                        onClick={() => handleCategorySelect(category)}
                        disabled={loading}
                      >
                        <span className="text-2xl sm:text-4xl">{category.icon}</span>
                        <span className="font-medium">{category.name}</span>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 2: Product Selection */}
          {step === "product" && (
            <motion.div
              key="product"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="max-w-6xl mx-auto"
            >
              <Card>
                <CardContent className="p-4 sm:p-6 md:p-8">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
                    <h2 className="text-xl sm:text-2xl font-semibold">
                      {selectedCategory?.name ? `${selectedCategory.name} - ` : ""}Select a Product
                    </h2>
                    {selectedCategory && (
                      <Button variant="outline" onClick={handleBack} className="w-full sm:w-auto text-xs sm:text-sm h-9 sm:h-10">
                        <ArrowLeft className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                        Back
                      </Button>
                    )}
                  </div>
                  {loading ? (
                    <div className="text-center py-12">Loading products...</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {products.map((product) => (
                        <Card
                          key={product._id}
                          className="cursor-pointer hover:shadow-lg transition-shadow"
                          onClick={() => handleProductSelect(product)}
                        >
                          <CardContent className="p-4">
                            <div className="aspect-square bg-muted rounded-lg mb-4 flex items-center justify-center">
                              {product.variants[0]?.frontImages?.[0] ? (
                                <img
                                  src={product.variants[0].frontImages[0].url}
                                  alt={product.name}
                                  className="w-full h-full object-cover rounded-lg"
                                />
                              ) : product.variants[0]?.images?.[0] ? (
                                <img
                                  src={product.variants[0].images[0].url}
                                  alt={product.name}
                                  className="w-full h-full object-cover rounded-lg"
                                />
                              ) : (
                                <span className="text-4xl">👕</span>
                              )}
                            </div>
                            <h3 className="font-semibold mb-2">{product.name}</h3>
                            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                              {product.description}
                            </p>
                            <p className="text-lg font-bold text-primary">
                              ${product.price.toFixed(2)}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}


          {/* Step 4: Design */}
          {step === "design" && (
            <motion.div
              key="design"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0 }}
            >
        <div className="flex flex-col lg:grid lg:grid-cols-[minmax(280px,400px)_1fr_minmax(280px,300px)] gap-4 sm:gap-6 lg:gap-8">
          {/* Left Sidebar - Product Options */}
          <Card className="h-fit order-1 lg:order-1">
            <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              <div>
                      <Label className="mb-2 sm:mb-3 block text-sm sm:text-base font-semibold">Design Side</Label>
                      <div className="grid grid-cols-2 gap-2 mb-3 sm:mb-4">
                        <Button
                          variant={designSide === "front" ? "default" : "outline"}
                          onClick={() => setDesignSide("front")}
                          className="w-full h-9 sm:h-10 text-xs sm:text-sm"
                        >
                          Front
                        </Button>
                        <Button
                          variant={designSide === "back" ? "default" : "outline"}
                          onClick={() => setDesignSide("back")}
                          className="w-full h-9 sm:h-10 text-xs sm:text-sm"
                        >
                          Back
                        </Button>
                      </div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground">
                        Front: {frontDesignLayers.length} elements | Back: {backDesignLayers.length} elements
                </div>
              </div>

                    <div className="border-t pt-3 sm:pt-4">
                <Label className="mb-2 sm:mb-3 block text-sm sm:text-base font-semibold">Size</Label>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  {SIZES.map((size) => (
                    <Button
                      key={size}
                      variant={selectedSize === size ? "default" : "outline"}
                      onClick={() => setSelectedSize(size)}
                      className="w-full h-8 sm:h-9 text-xs sm:text-sm"
                    >
                      {size}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="border-t pt-3 sm:pt-4">
                <Label className="mb-2 sm:mb-3 block text-sm sm:text-base font-semibold">Product Color</Label>
                {selectedProduct && selectedProduct.variants && selectedProduct.variants.length > 0 && (
                  <div className="space-y-3">
                    {/* Color Dropdown Trigger */}
                    <div className="relative" ref={colorDropdownRef}>
                      <Button
                        variant="outline"
                        onClick={() => setShowColorDropdown(!showColorDropdown)}
                        className="w-full h-10 sm:h-12 flex items-center justify-between p-2 sm:p-3 rounded-lg border bg-primary/10 border-primary/20 hover:bg-primary/20 text-xs sm:text-sm"
                      >
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div
                            className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 border-border shrink-0"
                            style={{ backgroundColor: selectedProduct.variants.find(v => v.color === selectedColor)?.colorCode || '#ffffff' }}
                          />
                          <span className="font-medium truncate">{selectedColor}</span>
                        </div>
                        <ChevronDown className={`h-3 w-3 sm:h-4 sm:w-4 transition-transform shrink-0 ${showColorDropdown ? 'rotate-180' : ''}`} />
                      </Button>

                      {/* Color Dropdown Content */}
                      {showColorDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-background border-2 border-border rounded-lg shadow-xl z-50 max-h-64 sm:max-h-80 overflow-y-auto">
                          <div className="p-3 sm:p-4">
                            <div className="grid grid-cols-8 sm:grid-cols-10 gap-2">
                              {selectedProduct.variants.map((variant) => (
                                <button
                                  key={variant.color}
                                  onClick={() => {
                                    setSelectedColor(variant.color);
                                    setShowColorDropdown(false);
                                  }}
                                  className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 transition-all hover:scale-110 ${
                                    selectedColor === variant.color 
                                      ? 'border-primary ring-2 ring-primary/20' 
                                      : 'border-border hover:border-primary/50'
                                  }`}
                                  style={{ backgroundColor: variant.colorCode }}
                                  title={variant.color}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t pt-3 sm:pt-4">
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-muted-foreground">Base Price:</span>
                    <span className="font-medium">${basePrice.toFixed(2)}</span>
                  </div>
                  
                  {frontCustomizationCost > 0 && (
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-muted-foreground">Front Design:</span>
                      <span className="font-medium">${frontCustomizationCost.toFixed(2)}</span>
                    </div>
                  )}
                  
                  {backCustomizationCost > 0 && (
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-muted-foreground">Back Design:</span>
                      <span className="font-medium">${backCustomizationCost.toFixed(2)}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between border-t pt-2 text-base sm:text-lg font-bold">
                    <span>Total:</span>
                    <span className="text-primary">${totalPrice.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Center - Canvas */}
          <div className="flex flex-col items-center gap-3 sm:gap-4 order-3 lg:order-2 w-full overflow-hidden">
            <div className="rounded-lg border-2 p-2 sm:p-4 shadow-lg bg-muted/30 w-full max-w-full overflow-hidden flex items-center justify-center" style={{ maxWidth: '100%', width: '100%' }}>
                    <div className="w-full max-w-full flex items-center justify-center" style={{ maxWidth: '100%', width: '100%', overflow: 'hidden' }}>
                      <canvas 
                        ref={canvasElRef} 
                        className="bg-transparent" 
                        style={{ 
                          maxWidth: '100%', 
                          width: '100%',
                          height: 'auto',
                          display: 'block',
                          objectFit: 'contain'
                        }} 
                      />
                    </div>
            </div>
            {activeLayerMetric && (
              <div
                className="text-center mt-2 font-medium text-xs sm:text-sm md:text-base text-foreground bg-background/90 rounded-md inline-block px-2 sm:px-3 py-1 shadow-sm"
              >
                Size: {activeLayerMetric.widthInches.toFixed(2)}″ × {activeLayerMetric.heightInches.toFixed(2)}″
              </div>
            )}

            <div className="flex flex-wrap gap-2 justify-center w-full px-2">
              <Button variant="outline" size="sm" onClick={handleRotate} className="text-xs sm:text-sm">
                <RotateCw className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Rotate</span>
                <span className="sm:hidden">↻</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleDeleteSelected} className="text-xs sm:text-sm">
                <Trash2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Delete</span>
                <span className="sm:hidden">🗑</span>
              </Button>
              {IS_DEVELOPMENT && (
                <Button variant="outline" size="sm" onClick={refreshAllObjectSizes} title="Refresh all elements to use updated size dimensions" className="text-xs sm:text-sm">
                  <RefreshCw className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Refresh Sizes</span>
                  <span className="sm:hidden">↻</span>
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleReset} className="text-xs sm:text-sm">
                <span className="hidden sm:inline">Reset</span>
                <span className="sm:hidden">↺</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload} className="text-xs sm:text-sm">
                <Download className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Download</span>
                <span className="sm:hidden">↓</span>
              </Button>
              <Button size="sm" onClick={handleSaveDesign} disabled={savingDesign} className="text-xs sm:text-sm">
                {savingDesign ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white mr-1 sm:mr-2"></div>
                    <span className="hidden sm:inline">Saving...</span>
                    <span className="sm:hidden">...</span>
                  </>
                ) : (
                  <>
                    <span className="hidden sm:inline">Save</span>
                    <span className="sm:hidden">💾</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Right Sidebar - Customization Tools */}
          <Card className="h-fit order-2 lg:order-3">
            <CardContent className="p-4 sm:p-6">
              {/* Design Size Selector */}
              <div className="mb-4 sm:mb-6 pb-4 sm:pb-6 border-b">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <Label className="text-sm sm:text-base font-semibold">Design Size</Label>
                  <Popover open={templatePopoverOpen} onOpenChange={setTemplatePopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1"
                      >
                        <Sparkles className="h-4 w-4" />
                        Templates
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-0" align="end">
          <Command>
            <CommandInput placeholder="Search templates..." />
            <CommandEmpty>
              {templatesLoading ? (
                <span className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading templates...
                </span>
              ) : templatesError ? (
                templatesError
              ) : (
                "No templates found."
              )}
            </CommandEmpty>
            <CommandList>
              <div className="max-h-64 overflow-y-auto px-3 pb-3">
                <div className="grid grid-cols-3 gap-2">
                  {templates.map((template) => {
                    const isActive = templateInfo?.id === template._id;
                    return (
                      <button
                        key={template._id}
                        type="button"
                        onClick={() => handleTemplateSelect(template)}
                        className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-md border transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                          isActive ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/60"
                        }`}
                      >
                        <img
                          src={template.image?.url}
                          alt={template.name || "Template preview"}
                          className="h-full w-full object-cover"
                        />
                        {isActive && (
                          <span className="absolute bottom-1 left-1 right-1 rounded bg-primary/80 px-1 text-[10px] font-medium text-white">
                            Selected
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CommandList>
          </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {STANDARD_DESIGN_SIZES.map((size) => (
                    <Button
                      key={size.id}
                      variant={selectedDesignSize === size.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setSelectedDesignSize(size.id);
                        // If an object is selected, also change its size
                        if (fabricCanvas?.getActiveObject()) {
                          handleChangeObjectSize(size.id);
                        }
                      }}
                      className="flex flex-col h-auto py-2 text-xs"
                    >
                      <span className="text-xs font-medium leading-tight">{size.name}</span>
                      <span className="text-[10px] sm:text-xs text-muted-foreground leading-tight">{size.description}</span>
                      <span className="text-xs font-semibold text-primary mt-0.5">${size.price}</span>
                    </Button>
                  ))}
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-2 leading-relaxed">
                  Select a size before adding elements, or change size of selected element
                </p>
              </div>

              <Tabs defaultValue="text" className="w-full">
                <TabsList className="grid w-full grid-cols-2 h-9 sm:h-10">
                  <TabsTrigger value="text" className="text-xs sm:text-sm">
                    <Type className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Text</span>
                    <span className="sm:hidden">T</span>
                  </TabsTrigger>
                  <TabsTrigger value="image" className="text-xs sm:text-sm">
                    <Upload className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Image</span>
                    <span className="sm:hidden">📷</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="text" className="space-y-3 sm:space-y-4 pt-3 sm:pt-4">
                  <div>
                    <Label className="mb-2 block text-xs sm:text-sm">Your Text</Label>
                    <Input
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      placeholder="Type here..."
                      className="mb-3 sm:mb-4 text-sm sm:text-base h-9 sm:h-10"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddText();
                      }}
                    />
                    <Label className="mb-2 block text-xs sm:text-sm">Font</Label>
                    <select
                      value={selectedFont}
                      onChange={(e) => setSelectedFont(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm h-9 sm:h-10"
                    >
                      {FONTS.map((font) => (
                        <option key={font} value={font}>
                          {font}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label className="mb-2 block text-xs sm:text-sm">Font Size: {fontSize}px</Label>
                    <Slider
                      value={[fontSize]}
                      onValueChange={(value) => setFontSize(value[0])}
                      min={20}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <Label className="mb-2 block text-xs sm:text-sm">Text Color</Label>
                    <div className="space-y-2">
                      <button
                        onClick={() => setShowColorPicker(!showColorPicker)}
                        className="h-9 sm:h-10 w-full rounded-md border-2 border-border"
                        style={{ backgroundColor: textColor }}
                      />
                      {showColorPicker && (
                        <div className="rounded-lg border p-2 sm:p-3">
                          <HexColorPicker color={textColor} onChange={setTextColor} style={{ width: '100%' }} />
                        </div>
                      )}
                    </div>
                  </div>

                  <Button onClick={handleAddText} className="w-full h-9 sm:h-10 text-xs sm:text-sm">
                    <Type className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    {fabricCanvas?.getActiveObject() && (fabricCanvas.getActiveObject() as any).name === "custom-text" ? "Update Text" : "Add Text"}
                  </Button>
                </TabsContent>

                <TabsContent value="image" className="space-y-3 sm:space-y-4 pt-3 sm:pt-4">
                  <div>
                    <Label className="mb-2 block text-xs sm:text-sm">Upload Image</Label>
                    <div className="rounded-lg border-2 border-dashed border-border p-4 sm:p-8 text-center">
                      <Upload className="mx-auto mb-2 h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
                      <p className="mb-2 text-xs sm:text-sm text-muted-foreground">
                        Click to upload your logo or design
                      </p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="image-upload"
                      />
                      <label htmlFor="image-upload">
                        <Button variant="outline" size="sm" asChild className="text-xs sm:text-sm h-8 sm:h-9">
                          <span>Choose File</span>
                        </Button>
                      </label>
                    </div>
                  </div>

                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 sm:p-4 text-xs sm:text-sm">
                    <p className="font-medium text-blue-800">💡 Pro Tip:</p>
                    <p className="mt-1 text-blue-700">PNG images give you the best results with transparent backgrounds and high quality.</p>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="mt-4 sm:mt-6 space-y-3 border-t pt-4 sm:pt-6">
                <Button 
                  onClick={() => {
                    if (!fabricCanvas || !selectedProduct || !selectedColor) {
                      toast.error("Please complete all steps before adding to cart");
                      return;
                    }
                    const token = localStorage.getItem('token');
                    if (!token) {
                      toast.error("Please login to add items to cart");
                      return;
                    }
                    setInstructionDialogOpen(true);
                  }}
                  className="w-full gradient-hero shadow-primary h-10 sm:h-11 text-xs sm:text-sm font-semibold"
                  disabled={addingToCart}
                >
                  {addingToCart ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white mr-2"></div>
                      <span className="hidden sm:inline">Adding to Cart...</span>
                      <span className="sm:hidden">Adding...</span>
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">Add to Cart</span>
                      <span className="sm:hidden">Add to Cart</span>
                    </>
                  )}
                </Button>
                <p className="text-center text-[10px] sm:text-xs text-muted-foreground">
                  Free shipping on orders over $50
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
            </motion.div>
          )}
        </AnimatePresence>

        {selectedProduct?.description && (
          <div className="mt-6">
            <div className="max-w-3xl mx-auto text-sm text-muted-foreground leading-relaxed">
              {selectedProduct.description}
            </div>
          </div>
        )}
      </div>

      <Footer />

      <Dialog
        open={instructionDialogOpen}
        onOpenChange={(open) => {
          setInstructionDialogOpen(open)
          if (!open && !addingToCart) {
            setOrderInstruction("")
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Special Instructions</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Share any notes for printing, packaging, or delivery. Leave blank if you have no extra requests.
          </p>
          <Textarea
            placeholder="e.g. Print logo 2cm higher, deliver before 5 PM..."
            value={orderInstruction}
            onChange={(e) => setOrderInstruction(e.target.value)}
            rows={5}
          />
          <DialogFooter className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setInstructionDialogOpen(false)
                setOrderInstruction("")
              }}
              disabled={addingToCart}
            >
              Cancel
            </Button>
            <Button onClick={handleAddToCart} disabled={addingToCart}>
              {addingToCart ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add to Cart"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
