import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import { myOrders, API_BASE_URL } from '@/lib/api'
import { Package, ShoppingBag, Clock, CheckCircle, XCircle, Truck, ArrowLeft, CreditCard, MapPin } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const statusConfig = {
  placed: { label: 'Placed', icon: Package, color: 'bg-blue-100 text-blue-800' },
  processing: { label: 'Processing', icon: Clock, color: 'bg-yellow-100 text-yellow-800' },
  shipped: { label: 'Shipped', icon: Truck, color: 'bg-purple-100 text-purple-800' },
  delivered: { label: 'Delivered', icon: CheckCircle, color: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelled', icon: XCircle, color: 'bg-red-100 text-red-800' },
}

const shipmentStatusMeta: Record<string, { label: string; badge: string }> = {
  pending: { label: 'Label Pending', badge: 'bg-slate-100 text-slate-700' },
  label_generated: { label: 'Label Generated', badge: 'bg-cyan-100 text-cyan-800' },
  carrier_handoff: { label: 'Handed to UPS', badge: 'bg-indigo-100 text-indigo-800' },
  in_transit: { label: 'In Transit', badge: 'bg-amber-100 text-amber-800' },
  delivered: { label: 'Delivered', badge: 'bg-emerald-100 text-emerald-800' },
}

const shipmentSteps = [
  { key: 'pending', label: 'Label' },
  { key: 'label_generated', label: 'Packed' },
  { key: 'carrier_handoff', label: 'UPS' },
  { key: 'in_transit', label: 'Transit' },
  { key: 'delivered', label: 'Delivered' },
]

const getShipmentStageIndex = (status?: string) => {
  if (!status) return 0
  const idx = shipmentSteps.findIndex((step) => step.key === status)
  return idx === -1 ? 0 : idx
}

const formatShipmentDate = (value?: string) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function Orders() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const fileBase = API_BASE_URL.replace(/\/api$/, '')

  useEffect(() => {
    myOrders()
      .then(setOrders)
      .catch((e) => setError(e.message || 'Failed to load orders'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="container mx-auto px-4 py-8 flex-1">
          <div className="max-w-4xl mx-auto">
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading your orders...</p>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/20">
      <Navbar />
      
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-8 flex-1">
        <div className="max-w-4xl mx-auto">
          <div className="mb-4 sm:mb-6 md:mb-8">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/products')}
              className="mb-3 sm:mb-4 -ml-2 sm:-ml-0"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="text-xs sm:text-sm">Continue Shopping</span>
            </Button>
            <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">My Orders</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Track and manage your orders</p>
          </div>

          {error && (
            <Card className="mb-4 sm:mb-6 border-2 border-red-200 bg-red-50/50">
              <CardContent className="p-3 sm:p-4">
                <p className="text-sm sm:text-base text-red-600">{error}</p>
              </CardContent>
            </Card>
          )}

          {orders.length === 0 && !error ? (
            <Card className="text-center py-8 sm:py-12 border-2">
              <CardContent className="p-6 sm:p-8">
                <ShoppingBag className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg sm:text-xl font-semibold mb-2">No orders yet</h3>
                <p className="text-sm sm:text-base text-muted-foreground mb-6">Start shopping to see your orders here</p>
                <Button onClick={() => navigate('/products')} className="w-full sm:w-auto">
                  Browse Products
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              {orders.map((order) => {
                const statusInfo = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.placed
                const StatusIcon = statusInfo.icon
                const shippingStatus = order.shipmentStatus || (order.status === 'delivered' ? 'delivered' : 'pending')
                const shippingMeta = shipmentStatusMeta[shippingStatus] || shipmentStatusMeta.pending
                const shippingStageIndex = getShipmentStageIndex(shippingStatus)
                const trackingSummary = order.trackingSummary
                const eta = trackingSummary?.estimatedDelivery ? formatShipmentDate(trackingSummary.estimatedDelivery) : null
                
                return (
                  <Card key={order._id} className="overflow-hidden border-2 hover:shadow-xl transition-all duration-200">
                    <CardHeader className="p-4 sm:p-6 bg-gradient-to-r from-muted/30 to-transparent">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="flex items-center gap-2 text-base sm:text-lg mb-1">
                            <Package className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                            <span className="truncate">Order #{order._id.slice(-8)}</span>
                          </CardTitle>
                          <div className="text-xs sm:text-sm text-muted-foreground">
                            Placed on {new Date(order.createdAt).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </div>
                        </div>
                        <Badge className={`${statusInfo.color} shrink-0 text-xs sm:text-sm px-2 sm:px-3 py-1`}>
                          <StatusIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" />
                          {statusInfo.label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6 space-y-4">
                      {order.trackingNumber && (
                        <div className="space-y-3 p-3 rounded-xl bg-muted/40 border border-muted-foreground/20">
                          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-sm sm:text-base text-muted-foreground">
                              <Truck className="h-4 w-4 text-primary" />
                              <div>
                                <div className="text-xs uppercase tracking-wide text-muted-foreground/80">Tracking Number</div>
                                <div className="font-semibold text-foreground">{order.trackingNumber}</div>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 sm:gap-3 text-xs sm:text-sm font-medium">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs sm:text-sm"
                                onClick={() => navigate(`/track/${order.trackingNumber}`)}
                              >
                                Tracking Page
                              </Button>
                              <a
                                href={`https://www.ups.com/track?loc=en_US&tracknum=${order.trackingNumber}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:underline"
                              >
                                View on UPS.com
                              </a>
                              {order.labelUrl && (
                                <a
                                  href={`${fileBase}${order.labelUrl}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  download
                                  className="text-primary hover:underline"
                                >
                                  Download Label
                                </a>
                              )}
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge className={`${shippingMeta.badge} text-xs font-semibold`}>
                                  {shippingMeta.label}
                                </Badge>
                                {trackingSummary?.description && (
                                  <span className="text-xs sm:text-sm text-muted-foreground">
                                    {trackingSummary.description}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                {trackingSummary?.lastLocation && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {trackingSummary.lastLocation}
                                  </span>
                                )}
                                {eta && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    ETA {eta}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 sm:justify-end text-[11px] uppercase tracking-wide text-muted-foreground">
                              {shipmentSteps.map((step, index) => (
                                <div key={step.key} className="flex items-center gap-1">
                                  <div
                                    className={`w-2.5 h-2.5 rounded-full ${
                                      index <= shippingStageIndex ? 'bg-primary' : 'bg-muted-foreground/30'
                                    }`}
                                  />
                                  <span
                                    className={`${
                                      index <= shippingStageIndex ? 'text-foreground font-semibold' : 'text-muted-foreground'
                                    }`}
                                  >
                                    {step.label}
                                  </span>
                                  {index < shipmentSteps.length - 1 && (
                                    <div className="w-6 h-px bg-muted-foreground/30 hidden sm:block" />
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                      {order.items?.map((item: any, index: number) => {
                        const isDTF = item.productType === 'dtf';
                        const imageSrc =
                          item.dtfPrintFile?.preview ||
                          item.dtfPrintFile?.url ||
                          item.customDesign?.frontDesign?.previewImage ||
                          item.customDesign?.backDesign?.previewImage ||
                          item.frontDesign?.previewImage ||
                          item.backDesign?.previewImage ||
                          item.productImage ||
                          item.product?.images?.[0]?.url ||
                          item.product?.image?.url ||
                          item.product?.image;
                        
                        const selectedSize =
                          item.customDesign?.selectedSize ||
                          item.selectedSize ||
                          item.product?.sizes?.[0] ||
                          '—';
                        const selectedColor =
                          item.customDesign?.selectedColor ||
                          item.selectedColor ||
                          item.product?.colors?.[0] ||
                          '—';
                        
                        return (
                          <div key={index} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-gradient-to-br from-muted/50 to-muted/30 rounded-xl border border-muted-foreground/10">
                            <div className="w-full sm:w-20 md:w-24 h-32 sm:h-20 md:h-24 flex-shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-muted to-muted/50 shadow-md">
                              {imageSrc ? (
                                <img 
                                  src={imageSrc} 
                                  alt={item.product?.name || 'Custom Design'} 
                                  className="w-full h-full object-cover"
                                  onLoad={() => console.log('Image loaded successfully')}
                                  onError={(e) => {
                                    console.log('Image failed to load:', e);
                                    e.currentTarget.style.display = 'none';
                                    const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                    if (fallback) fallback.classList.remove('hidden');
                                  }}
                                />
                              ) : null}
                              <div className={`w-full h-full bg-muted rounded-lg flex items-center justify-center ${imageSrc ? 'hidden' : ''}`}>
                                <Package className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0 w-full sm:w-auto">
                              <h4 className="font-bold text-sm sm:text-base mb-1.5 sm:mb-2 line-clamp-2">
                                {item.product?.name || item.product?.title || item.productName || 'Casual Product'}
                              </h4>
                              <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                                {isDTF ? (
                                  <>
                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs font-medium">
                                      DTF Print
                                    </span>
                                    {item.dtfPrintFile?.fileName && (
                                      <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded-full text-xs">
                                        {item.dtfPrintFile.fileName}
                                      </span>
                                    )}
                                  </>
                                ) : (item.customDesign || item.frontDesign || item.backDesign) ? (
                                  <>
                                    <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">
                                      Size: {selectedSize}
                                    </span>
                                    <span className="px-2 py-0.5 bg-secondary/50 rounded-full text-xs">
                                      {selectedColor}
                                    </span>
                                    {(item.customDesign?.frontDesign || item.frontDesign) && (
                                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs">
                                        Front Design
                                      </span>
                                    )}
                                    {(item.customDesign?.backDesign || item.backDesign) && (
                                      <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full text-xs">
                                        Back Design
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                                    {item.product?.description}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 pt-2 border-t">
                                <span className="text-xs sm:text-sm text-muted-foreground">
                                  Quantity: <span className="font-semibold text-foreground">{item.quantity}</span>
                                </span>
                                <span className="text-base sm:text-lg font-bold text-primary">
                                  ${Number(item.price).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      
                      <Separator className="my-4" />
                      
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pt-2">
                        <div className="space-y-1.5 text-xs sm:text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <CreditCard className="h-3.5 w-3.5" />
                            <span>Payment: <span className="font-medium text-foreground">{order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Razorpay'}</span></span>
                          </div>
                          <div className="text-muted-foreground font-mono text-xs">
                            ID: {order._id.slice(-12)}
                          </div>
                        </div>
                        <div className="text-left sm:text-right pt-2 sm:pt-0 border-t sm:border-t-0">
                          <div className="text-xs sm:text-sm text-muted-foreground mb-1">Total</div>
                          <div className="text-xl sm:text-2xl font-bold text-primary">
                            ${Number(order.total).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  )
}


