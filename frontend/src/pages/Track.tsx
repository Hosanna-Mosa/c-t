import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getTrackingDetails } from '@/lib/api'
import { Loader2, MapPin, Clock, Package, RefreshCcw } from 'lucide-react'

type TrackingEvent = {
  status?: string
  code?: string
  description?: string
  location?: string
  date?: string
}

type TrackingResponse = {
  trackingNumber: string
  shipmentStatus?: string
  latestEvent?: TrackingEvent
  estimatedDelivery?: string
  events: TrackingEvent[]
}

const shipmentStatusMeta: Record<
  string,
  { label: string; badge: string; description: string }
> = {
  pending: {
    label: 'Label Pending',
    badge: 'bg-slate-100 text-slate-700',
    description: 'We created your order and will print the label next.',
  },
  label_generated: {
    label: 'Label Generated',
    badge: 'bg-cyan-100 text-cyan-800',
    description: 'UPS label is ready. We just need to hand it over.',
  },
  carrier_handoff: {
    label: 'Handed to UPS',
    badge: 'bg-indigo-100 text-indigo-800',
    description: 'Package received by UPS — first scan coming soon.',
  },
  in_transit: {
    label: 'In Transit',
    badge: 'bg-amber-100 text-amber-800',
    description: 'UPS is moving your package to the destination hub.',
  },
  delivered: {
    label: 'Delivered',
    badge: 'bg-emerald-100 text-emerald-800',
    description: 'Package delivered — enjoy your custom gear!',
  },
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

const formatDateTime = (value?: string) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const formatDate = (value?: string) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

const buildUpsLink = (tracking: string) =>
  `https://www.ups.com/track?loc=en_US&tracknum=${tracking}`

export default function Track() {
  const params = useParams<{ trackingNumber?: string }>()
  const [inputValue, setInputValue] = useState(params.trackingNumber || '')
  const [trackingData, setTrackingData] = useState<TrackingResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const shipmentStatus = trackingData?.shipmentStatus || 'pending'
  const statusMeta = shipmentStatusMeta[shipmentStatus] || shipmentStatusMeta.pending
  const stageIndex = getShipmentStageIndex(shipmentStatus)

  const latestEvent = trackingData?.latestEvent
  const events = trackingData?.events || []

  const hasTrackingNumber = inputValue.trim().length > 0

  const handleLookup = async (tracking: string) => {
    if (!tracking) {
      setError('Enter a tracking number to lookup the shipment.')
      return
    }
    try {
      setLoading(true)
      setError(null)
      const response = await getTrackingDetails(tracking)
      setTrackingData(response as TrackingResponse)
    } catch (err: any) {
      setTrackingData(null)
      setError(err?.message || 'Unable to fetch tracking details')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (params.trackingNumber) {
      handleLookup(params.trackingNumber)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.trackingNumber])

  const timeline = useMemo(() => events, [events])

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/30">
      <Navbar />

      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 flex-1 w-full max-w-5xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Track Your Order</h1>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">
            Enter your UPS tracking number to see real-time updates.
          </p>
        </div>

        <Card className="mb-6 border-2">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Tracking Number</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col sm:flex-row gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                handleLookup(inputValue.trim())
              }}
            >
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="e.g. 1Z999AA10123456784"
                className="text-lg h-12"
              />
              <Button type="submit" className="h-12 text-base" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Track Package
              </Button>
            </form>
            {!hasTrackingNumber && (
              <p className="text-xs text-muted-foreground mt-2">
                You can also open this page from the Orders section for faster access.
              </p>
            )}
          </CardContent>
        </Card>

        {error && (
          <Card className="mb-6 border-red-200 bg-red-50/80">
            <CardContent className="py-4 text-sm text-red-700">{error}</CardContent>
          </Card>
        )}

        {trackingData ? (
          <div className="space-y-6">
            <Card className="border-2">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" />
                    Tracking #{trackingData.trackingNumber}
                  </CardTitle>
                  <div className="text-xs text-muted-foreground">
                    Last updated {formatDateTime(latestEvent?.date)}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={`${statusMeta.badge} text-xs font-semibold`}>
                    {statusMeta.label}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => handleLookup(trackingData.trackingNumber)}
                    disabled={loading}
                  >
                    <RefreshCcw className="h-3.5 w-3.5 mr-2" />
                    Refresh
                  </Button>
                  <a
                    href={buildUpsLink(trackingData.trackingNumber)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    View on UPS.com
                  </a>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{statusMeta.description}</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Estimated Delivery</div>
                    <div className="font-semibold text-base">
                      {formatDate(trackingData.estimatedDelivery)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Latest Scan</div>
                    <div className="font-semibold">
                      {latestEvent?.description || latestEvent?.status || 'Waiting for updates'}
                    </div>
                    {latestEvent?.location && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" />
                        {latestEvent.location}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Last Update</div>
                    <div className="font-semibold text-base">{formatDateTime(latestEvent?.date)}</div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-wide text-muted-foreground pt-2 border-t">
                  {shipmentSteps.map((step, index) => (
                    <div key={step.key} className="flex items-center gap-1">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${
                          index <= stageIndex ? 'bg-primary' : 'bg-muted-foreground/30'
                        }`}
                      />
                      <span
                        className={`${
                          index <= stageIndex ? 'text-foreground font-semibold' : 'text-muted-foreground'
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
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Tracking Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {timeline.length ? (
                  timeline.map((event, index) => (
                    <div key={`${event.date}-${event.code}-${index}`} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${
                            index === 0 ? 'bg-primary' : 'bg-muted-foreground/50'
                          }`}
                        />
                        {index < timeline.length - 1 && (
                          <div className="w-px flex-1 bg-muted-foreground/30 mt-0.5" />
                        )}
                      </div>
                      <div className="space-y-1 pb-4 flex-1">
                        <div className="text-sm font-semibold">
                          {event.description || event.status || 'Status update'}
                        </div>
                        <div className="text-xs text-muted-foreground">{formatDateTime(event.date)}</div>
                        {event.location && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {event.location}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    We&apos;re waiting for UPS to post the first scan. Check back after the package is picked up.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        ) : !loading ? (
          <Card className="border-dashed border-2 bg-muted/20">
            <CardContent className="py-10 text-center space-y-3">
              <Package className="h-10 w-10 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Enter your tracking number to see every UPS scan, estimated delivery, and the latest updates in one place.
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Footer />
    </div>
  )
}


