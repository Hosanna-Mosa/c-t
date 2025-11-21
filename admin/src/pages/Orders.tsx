import { useEffect, useState } from 'react'
import api from '@/lib/api'

type TrackingEvent = {
  status?: string
  code?: string
  description?: string
  location?: string
  date?: string
}

type TrackingSummary = {
  status?: string
  description?: string
  code?: string
  estimatedDelivery?: string
  lastLocation?: string
  updatedAt?: string
}

type Order = { 
  _id: string; 
  total?: number; 
  status?: string; 
  user?: any; 
  items?: any[];
  shippingAddress?: any;
  paymentMethod?: string;
  createdAt?: string;
  trackingNumber?: string;
  labelUrl?: string;
  shipmentStatus?: string;
  trackingHistory?: TrackingEvent[];
  trackingSummary?: TrackingSummary;
  carrierHandoffAt?: string;
  deliveredAt?: string;
}

type OrderDetails = Order & {
  user: {
    name: string;
    email: string;
    phone?: string;
  };
  items: Array<{
    productName?: string;
    productImage?: string;
    productType?: 'custom' | 'casual';
    selectedColor?: string;
    selectedSize?: string;
    product?: {
      name: string;
      slug: string;
      price: number;
      variants: any[];
      images?: Array<{ url: string }>;
    };
    quantity: number;
    price: number;
    instruction?: string;
    customDesign?: {
      frontDesign?: {
        previewImage?: string;
        // Optional list of layers used to produce the preview
        designLayers?: Array<{
          id?: string;
          type?: string;
          data?: { url?: string };
          designSizeId?: string; // Size preset ID (pocket, small, medium, large)
        }>;
        // Metrics injected from storefront at add-to-cart time
        metrics?: {
          widthInches?: number;
          heightInches?: number;
          areaInches?: number;
          totalPixels?: number;
          perLayer?: Array<{
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
        };
      };
      backDesign?: {
        previewImage?: string;
        designLayers?: Array<{
          id?: string;
          type?: string;
          data?: { url?: string };
          designSizeId?: string; // Size preset ID (pocket, small, medium, large)
        }>;
        metrics?: {
          widthInches?: number;
          heightInches?: number;
          areaInches?: number;
          totalPixels?: number;
          perLayer?: Array<{
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
        };
      };
      selectedColor?: string;
      selectedSize?: string;
    };
  }>;
}

const SHIPMENT_STAGES = [
  { key: 'pending', title: 'Label Pending', hint: 'Order placed' },
  { key: 'label_generated', title: 'Label Generated', hint: 'UPS label ready' },
  { key: 'carrier_handoff', title: 'Handed to UPS', hint: 'Box handed to carrier' },
  { key: 'in_transit', title: 'In Transit', hint: 'UPS scans updating' },
  { key: 'delivered', title: 'Delivered', hint: 'Customer notified' },
]

const shipmentStatusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: '#94a3b8' },
  label_generated: { label: 'Label Generated', color: '#0ea5e9' },
  carrier_handoff: { label: 'Carrier Handoff', color: '#6366f1' },
  in_transit: { label: 'In Transit', color: '#f59e0b' },
  delivered: { label: 'Delivered', color: '#10b981' },
}

const formatDateTime = (value?: string | Date | null) => {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString()
}

const getShipmentStageIndex = (status?: string) => {
  if (!status) return 0
  const idx = SHIPMENT_STAGES.findIndex((stage) => stage.key === status)
  return idx === -1 ? 0 : idx
}

type PackageField = 'weight' | 'length' | 'width' | 'height';
const PACKAGE_FIELDS: PackageField[] = ['weight', 'length', 'width', 'height'];

export function Orders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<OrderDetails | null>(null)
  const [loadingOrder, setLoadingOrder] = useState<string | null>(null)
  const [zoomedImage, setZoomedImage] = useState<string | null>(null)
  const [activeItemIndex, setActiveItemIndex] = useState<number>(0)
  const [labelLoading, setLabelLoading] = useState(false)
  const [handoffLoading, setHandoffLoading] = useState(false)
  const [trackingLoading, setTrackingLoading] = useState(false)
  const [packageForm, setPackageForm] = useState<Record<PackageField, string>>({
    weight: '1',
    length: '10',
    width: '8',
    height: '4',
  })
  const apiBase = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:8000/api'
  const fileBase = typeof apiBase === 'string' ? apiBase.replace(/\/api$/, '') : 'http://localhost:8000'
  const storefrontBase = (import.meta as any).env?.VITE_STOREFRONT_URL || 'http://localhost:5173'
  const storefrontUrl = typeof storefrontBase === 'string' ? storefrontBase.replace(/\/$/, '') : 'http://localhost:5173'
  const hasStoredLabel = Boolean(selectedOrder?.trackingNumber || selectedOrder?.labelUrl)
  const labelDownloadPath =
    selectedOrder && (selectedOrder.labelUrl || `/uploads/labels/${selectedOrder._id}.pdf`)
  const showGenerateForm = !hasStoredLabel && selectedOrder?.status !== 'shipped'

  async function downloadImage(imageUrl: string, filename = 'layer.png') {
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (_) {
      // best-effort download; show a simple fallback error state inline
      setError('Failed to download image')
      setTimeout(() => setError(null), 2500)
    }
  }

  useEffect(() => {
    api.getOrders()
      .then((res) => setOrders(res.data))
      .catch((e) => setError(e.message))
  }, [])

  async function updateStatus(id: string, status: string) {
    try {
      setSaving(id)
      await api.updateOrderStatus(id, status)
      setOrders((prev) => prev.map((o) => (o._id === id ? { ...o, status } : o)))
    } catch (e) {
      setError('Failed to update status')
    } finally {
      setSaving(null)
    }
  }

  async function handleOrderClick(orderId: string) {
    try {
      setLoadingOrder(orderId)
      const response = await api.getOrderById(orderId)
      console.log("order details :",response.data);
      
      setSelectedOrder(response.data)
      setPackageForm({
        weight: '1',
        length: '10',
        width: '8',
        height: '4',
      })
      setActiveItemIndex(0)
    } catch (e) {
      setError('Failed to load order details')
    } finally {
      setLoadingOrder(null)
    }
  }

  async function reloadOrder(orderId: string) {
    const response = await api.getOrderById(orderId)
    const orderData = response.data as OrderDetails
    setSelectedOrder(orderData)
    setOrders((prev) =>
      prev.map((order) => (order._id === orderId ? { ...order, ...orderData } : order))
    )
    return orderData
  }

  async function handleGenerateLabel() {
    if (!selectedOrder) return
    try {
      console.log('[Admin] Starting UPS label generation', {
        orderId: selectedOrder._id,
        packageForm,
      })
      setLabelLoading(true)
      setError(null)
      const payload = { ...packageForm }
      const response = await api.createShipmentLabel(selectedOrder._id, payload)
      console.log('[Admin] UPS label API response', response)
      if (!response.success) {
        throw new Error('Failed to generate UPS label')
      }

      setSelectedOrder((prev) => {
        if (!prev || prev._id !== selectedOrder._id) return prev
        return {
          ...prev,
          trackingNumber: response.trackingNumber,
          labelUrl: response.labelUrl,
          status: response.status || 'shipped',
          shipmentStatus: response.shipmentStatus || 'label_generated',
        }
      })

      setOrders((prev) =>
        prev.map((order) =>
          order._id === selectedOrder._id
            ? {
                ...order,
                status: response.status || 'shipped',
                trackingNumber: response.trackingNumber,
                labelUrl: response.labelUrl,
                shipmentStatus: response.shipmentStatus || 'label_generated',
              }
            : order
        )
      )
      await reloadOrder(selectedOrder._id)
    } catch (e: any) {
      console.error('[Admin] UPS label generation failed', e)
      setError(e.message || 'Failed to generate UPS label')
    } finally {
      console.log('[Admin] Finished UPS label generation flow')
      setLabelLoading(false)
    }
  }

  async function handleHandoffToUps() {
    if (!selectedOrder) return
    try {
      setHandoffLoading(true)
      setError(null)
      await api.handoffShipment(selectedOrder._id)
      await reloadOrder(selectedOrder._id)
    } catch (e: any) {
      console.error('[Admin] UPS handoff update failed', e)
      setError(e.message || 'Failed to mark UPS handoff')
    } finally {
      setHandoffLoading(false)
    }
  }

  async function handleRefreshTracking() {
    if (!selectedOrder) return
    try {
      setTrackingLoading(true)
      setError(null)
      await api.refreshTrackingForOrder(selectedOrder._id)
      await reloadOrder(selectedOrder._id)
    } catch (e: any) {
      console.error('[Admin] UPS tracking refresh failed', e)
      setError(e.message || 'Failed to refresh UPS tracking')
    } finally {
      setTrackingLoading(false)
    }
  }

  function closeOrderDialog() {
    setSelectedOrder(null)
    setZoomedImage(null)
    setActiveItemIndex(0)
  }

  function openImageZoom(imageUrl: string) {
    setZoomedImage(imageUrl)
  }

  function closeImageZoom() {
    setZoomedImage(null)
  }

  // Helper: find per-layer metrics for a given side by layer id
  function findLayerMetrics(
    side: 'front' | 'back',
    item: OrderDetails['items'][number],
    layerId?: string
  ) {
    const sideData = side === 'front' ? item.customDesign?.frontDesign : item.customDesign?.backDesign
    const per = sideData?.metrics?.perLayer
    if (!per || !layerId) return null
    return per.find((m: any) => m.id === layerId) || null
  }

  // Helper: get size name from design size ID
  function getSizeName(sizeId?: string): string {
    if (!sizeId) return 'Unknown'
    const sizeMap: Record<string, string> = {
      'pocket': 'Pocket Size',
      'small': 'Small',
      'medium': 'Medium',
      'large': 'Large'
    }
    return sizeMap[sizeId] || sizeId
  }

  const activeItem = selectedOrder?.items?.[activeItemIndex] || null
  const activeItemHasDesign = Boolean(
    activeItem?.customDesign?.frontDesign?.previewImage ||
    activeItem?.customDesign?.backDesign?.previewImage
  )
  const shipmentStatus = selectedOrder?.shipmentStatus || 'pending'
  const shipmentStageIndex = getShipmentStageIndex(shipmentStatus)
  const shipmentStatusMeta = shipmentStatusLabels[shipmentStatus] || shipmentStatusLabels.pending
  const trackingTimeline = selectedOrder?.trackingHistory || []
  const trackingSummary = selectedOrder?.trackingSummary || null
  const canMarkHandoff =
    !!selectedOrder?.trackingNumber &&
    !['carrier_handoff', 'in_transit', 'delivered'].includes(shipmentStatus)

  return (
    <section>
      <h2>Orders</h2>
      {error && <div className="error">{error}</div>}
      <table className="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Customer</th>
            <th>Total</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o._id} style={{ cursor: 'pointer' }} onClick={() => handleOrderClick(o._id)}>
              <td>
                {o._id.slice(-6)}
                {loadingOrder === o._id && <span className="loading-spinner" style={{ marginLeft: '8px' }}></span>}
              </td>
              <td>{o.user?.name || '—'}</td>
              <td>₹{((o.total || 0) / 100).toFixed(2)}</td>
              <td>{o.status}</td>
              <td onClick={(e) => e.stopPropagation()}>
                <select disabled={saving === o._id} value={o.status} onChange={(e) => updateStatus(o._id, e.target.value)}>
                  <option value="placed">placed</option>
                  <option value="processing">processing</option>
                  <option value="shipped">shipped</option>
                  <option value="delivered">delivered</option>
                  <option value="cancelled">cancelled</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {orders.length === 0 && !error && <div>No orders yet</div>}

      {/* Order Details Dialog */}
      {selectedOrder && selectedOrder.user && (
        <div className="modal-overlay" onClick={closeOrderDialog}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Order Details - #{selectedOrder._id.slice(-6)}</h3>
              <button className="close-btn" onClick={closeOrderDialog}>×</button>
            </div>
            
            <div style={{ padding: '20px', maxHeight: '70vh', overflowY: 'auto' }}>
              {/* Design Previews Section */}
              {selectedOrder.items && selectedOrder.items.length > 0 && (
                <div style={{ marginBottom: '32px' }}>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600', color: 'var(--text)' }}>
                    Design Preview
                  </h4>
                  {!activeItemHasDesign ? (
                    <div className="card" style={{ padding: '16px', color: 'var(--muted)' }}>
                      Select an item below to view its design files.
                    </div>
                  ) : (
                    <div className="design-preview-card" key={activeItemIndex}>
                          <div className="design-preview-header">
                            <h5 style={{ margin: '0', fontSize: '16px', fontWeight: '600' }}>
                          {activeItem?.product?.name || 'Unknown Product'}
                            </h5>
                            <div style={{ fontSize: '14px', color: 'var(--muted)' }}>
                          {activeItem?.customDesign?.selectedColor} • {activeItem?.customDesign?.selectedSize}
                            </div>
                        {activeItem?.instruction && (
                              <div style={{ marginTop: 8, padding: '8px 10px', background: '#f5f5f5', borderRadius: 8, fontSize: 13, color: '#444' }}>
                                <strong style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Customer Instructions</strong>
                            <span style={{ whiteSpace: 'pre-wrap' }}>{activeItem.instruction}</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="design-preview-grid">
                        {activeItem?.customDesign?.frontDesign?.previewImage && (
                              <div className="design-preview-item">
                                <div className="design-preview-label">Front Design</div>
                            <div className="design-preview-container" onClick={() => openImageZoom(activeItem.customDesign!.frontDesign!.previewImage!)}>
                                  <img 
                                src={activeItem.customDesign.frontDesign.previewImage}
                                    alt="Front Design" 
                                    className="design-preview-image"
                                  />
                                  <div className="zoom-overlay">
                                    <span className="zoom-icon">🔍</span>
                                  </div>
                                </div>
                            {activeItem.customDesign.frontDesign?.designLayers && activeItem.customDesign.frontDesign.designLayers.length > 0 && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
                                {activeItem.customDesign.frontDesign.designLayers.map((layer: any, lIdx: number) => (
                                      layer?.data?.url ? (
                                        <div key={layer.id || `front-layer-${lIdx}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                          <img
                                            src={layer.data.url}
                                            alt={`Front layer ${lIdx + 1}`}
                                            style={{ width: 60, height: 60, objectFit: 'contain', borderRadius: 6, background: 'var(--panel)', border: '1px solid var(--border)', cursor: 'zoom-in' }}
                                            onClick={() => openImageZoom(layer.data!.url!)}
                                          />
                                          {layer.designSizeId ? (
                                            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: '500' }}>
                                              {getSizeName(layer.designSizeId)}
                                            </div>
                                          ) : (
                                            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                                              Size: Unknown
                                            </div>
                                          )}
                                          <button
                                            style={{ fontSize: 12, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--panel)', cursor: 'pointer' }}
                                            onClick={() => downloadImage(layer.data!.url!, `front-layer-${lIdx + 1}.png`)}
                                          >
                                            Download
                                          </button>
                                        </div>
                                      ) : null
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            
                        {activeItem?.customDesign?.backDesign?.previewImage && (
                              <div className="design-preview-item">
                                <div className="design-preview-label">Back Design</div>
                            <div className="design-preview-container" onClick={() => openImageZoom(activeItem.customDesign!.backDesign!.previewImage!)}>
                                  <img 
                                src={activeItem.customDesign.backDesign.previewImage}
                                    alt="Back Design" 
                                    className="design-preview-image"
                                  />
                                  <div className="zoom-overlay">
                                    <span className="zoom-icon">🔍</span>
                                  </div>
                                </div>
                            {activeItem.customDesign.backDesign?.designLayers && activeItem.customDesign.backDesign.designLayers.length > 0 && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
                                {activeItem.customDesign.backDesign.designLayers.map((layer: any, lIdx: number) => (
                                      layer?.data?.url ? (
                                        <div key={layer.id || `back-layer-${lIdx}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                          <img
                                            src={layer.data.url}
                                            alt={`Back layer ${lIdx + 1}`}
                                            style={{ width: 60, height: 60, objectFit: 'contain', borderRadius: 6, background: 'var(--panel)', border: '1px solid var(--border)', cursor: 'zoom-in' }}
                                            onClick={() => openImageZoom(layer.data!.url!)}
                                          />
                                          {layer.designSizeId ? (
                                            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: '500' }}>
                                              {getSizeName(layer.designSizeId)}
                                            </div>
                                          ) : (
                                            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                                              Size: Unknown
                                            </div>
                                          )}
                                          <button
                                            style={{ fontSize: 12, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--panel)', cursor: 'pointer' }}
                                            onClick={() => downloadImage(layer.data!.url!, `back-layer-${lIdx + 1}.png`)}
                                          >
                                            Download
                                          </button>
                                        </div>
                                      ) : null
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            
                        {activeItem?.customDesign?.frontDesign?.previewImage && !activeItem?.customDesign?.backDesign?.previewImage && (
                              <div className="design-preview-item">
                                <div className="design-preview-label">Back Design</div>
                                <div className="design-preview-container" style={{ background: 'var(--panel)', border: '2px dashed var(--border)' }}>
                                  <div style={{ color: 'var(--muted)', fontSize: '14px', textAlign: 'center' }}>
                                    No back design
                                  </div>
                                </div>
                              </div>
                            )}
                            
                        {!activeItem?.customDesign?.frontDesign?.previewImage && activeItem?.customDesign?.backDesign?.previewImage && (
                              <div className="design-preview-item">
                                <div className="design-preview-label">Front Design</div>
                                <div className="design-preview-container" style={{ background: 'var(--panel)', border: '2px dashed var(--border)' }}>
                                  <div style={{ color: 'var(--muted)', fontSize: '14px', textAlign: 'center' }}>
                                    No front design
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                  )}
                </div>
              )}

              {/* Customer Information */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600' }}>Customer Information</h4>
                <div className="card">
                  <div className="detail-row">
                    <span className="label">Name:</span>
                    <span className="value">{selectedOrder.user?.name || 'Unknown User'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Email:</span>
                    <span className="value">{selectedOrder.user?.email || 'No email'}</span>
                  </div>
                  {selectedOrder.user?.phone && (
                    <div className="detail-row">
                      <span className="label">Phone:</span>
                      <span className="value">{selectedOrder.user.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Order Information */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600' }}>Order Information</h4>
                <div className="card">
                  <div className="detail-row">
                    <span className="label">Order ID:</span>
                    <span className="value">{selectedOrder._id}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Status:</span>
                    <span className="value">{selectedOrder.status}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Total:</span>
                    <span className="value">₹{((selectedOrder.total || 0) / 100).toFixed(2)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Payment Method:</span>
                    <span className="value">{selectedOrder.paymentMethod?.toUpperCase()}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Order Date:</span>
                    <span className="value">{selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleDateString() : '—'}</span>
                  </div>
                </div>
              </div>

              {/* Shipping Address */}
              {selectedOrder.shippingAddress && (
                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600' }}>Shipping Address</h4>
                  <div className="card">
                    <div className="detail-row">
                      <span className="label">Name:</span>
                      <span className="value">{selectedOrder.shippingAddress.fullName}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Phone:</span>
                      <span className="value">{selectedOrder.shippingAddress.phone}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Address:</span>
                      <span className="value">
                        {selectedOrder.shippingAddress.line1}
                        {selectedOrder.shippingAddress.line2 && `, ${selectedOrder.shippingAddress.line2}`}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="label">City:</span>
                      <span className="value">{selectedOrder.shippingAddress.city}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">State:</span>
                      <span className="value">{selectedOrder.shippingAddress.state}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Postal Code:</span>
                      <span className="value">{selectedOrder.shippingAddress.postalCode}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Country:</span>
                      <span className="value">{selectedOrder.shippingAddress.country}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Shipping Label */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600' }}>UPS Shipping & Tracking</h4>
                <div className="card">
                  <div className="detail-row">
                    <span className="label">Shipment Status:</span>
                    <span
                      className="value"
                      style={{ color: shipmentStatusMeta.color, fontWeight: 600, textTransform: 'capitalize' }}
                    >
                      {shipmentStatusMeta.label}
                    </span>
                  </div>
                  {hasStoredLabel ? (
                    <>
                      <div className="detail-row">
                        <span className="label">Tracking Number:</span>
                        <span className="value" style={{ wordBreak: 'break-all' }}>
                          {selectedOrder.trackingNumber || 'Unavailable'}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Label File:</span>
                        {labelDownloadPath ? (
                          <a
                            href={`${fileBase}${labelDownloadPath}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                            className="value"
                            style={{ color: 'var(--accent, #5b21b6)', fontWeight: 600 }}
                          >
                            Download UPS Label
                          </a>
                        ) : (
                          <span className="value">Not available</span>
                        )}
                      </div>
                      {selectedOrder?.status !== 'shipped' && (
                        <button
                          className="primary-btn"
                          style={{ marginTop: '12px' }}
                          onClick={handleGenerateLabel}
                          disabled={labelLoading}
                        >
                          {labelLoading ? 'Generating...' : 'Re-generate Label'}
                        </button>
                      )}
                    </>
                  ) : showGenerateForm ? (
                    <>
                      <div
                        className="grid"
                        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}
                      >
                        {PACKAGE_FIELDS.map((field) => (
                          <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <label style={{ fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>{field}</label>
                            <input
                              type="number"
                              min="0.1"
                              step="0.1"
                              value={packageForm[field]}
                              onChange={(e) =>
                                setPackageForm((prev) => ({
                                  ...prev,
                                  [field]: e.target.value,
                                }))
                              }
                              style={{
                                padding: '8px 10px',
                                borderRadius: 8,
                                border: '1px solid var(--border)',
                                fontSize: 14,
                              }}
                            />
                          </div>
                        ))}
                      </div>
                      <button
                        className="primary-btn"
                        style={{ marginTop: '16px' }}
                        onClick={handleGenerateLabel}
                        disabled={labelLoading}
                      >
                        {labelLoading ? 'Generating...' : 'Generate UPS Label'}
                      </button>
                    </>
                  ) : (
                    <div className="detail-row">
                      <span className="label">Label Status:</span>
                      <span className="value">Order marked as shipped. Label information not available.</span>
                    </div>
                  )}

                  {trackingSummary && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                      <h5 style={{ margin: '0 0 12px 0', fontSize: 15, fontWeight: 600 }}>Latest UPS Scan</h5>
                      <div className="detail-row">
                        <span className="label">Message:</span>
                        <span className="value">{trackingSummary.description || '—'}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Last Location:</span>
                        <span className="value">{trackingSummary.lastLocation || '—'}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Estimated Delivery:</span>
                        <span className="value">{formatDateTime(trackingSummary.estimatedDelivery)}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Last Update:</span>
                        <span className="value">{formatDateTime(trackingSummary.updatedAt)}</span>
                      </div>
                    </div>
                  )}

                  {selectedOrder?.trackingNumber && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
                      {canMarkHandoff && (
                        <button
                          className="primary-btn"
                          onClick={handleHandoffToUps}
                          disabled={handoffLoading}
                        >
                          {handoffLoading ? 'Saving...' : 'Mark Handed to UPS'}
                        </button>
                      )}
                      <button
                        className="primary-btn"
                        style={{ background: '#f5f5f5', color: '#111', border: '1px solid var(--border)' }}
                        onClick={handleRefreshTracking}
                        disabled={trackingLoading}
                      >
                        {trackingLoading ? 'Syncing...' : 'Refresh Tracking'}
                      </button>
                      <a
                        href={`${storefrontUrl}/track/${selectedOrder.trackingNumber}`}
                        target="_blank"
                        rel="noreferrer"
                        className="primary-btn"
                        style={{
                          textDecoration: 'none',
                          background: '#0f172a',
                          color: '#fff',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        Open Tracking Page →
                      </a>
                    </div>
                  )}

                  <div style={{ marginTop: 20 }}>
                    <h5 style={{ margin: '0 0 12px 0', fontSize: 15, fontWeight: 600 }}>Fulfillment Progress</h5>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {SHIPMENT_STAGES.map((stage, index) => {
                        const isActive = index <= shipmentStageIndex
                        const marker = index < shipmentStageIndex ? '✓' : index === shipmentStageIndex ? '●' : '○'
                        return (
                          <li
                            key={stage.key}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 12,
                              marginBottom: 10,
                              color: isActive ? '#111' : '#94a3b8',
                            }}
                          >
                            <span style={{ fontWeight: 700, minWidth: 18 }}>{marker}</span>
                            <div>
                              <div style={{ fontWeight: 600 }}>{stage.title}</div>
                              <div style={{ fontSize: 12, color: '#64748b' }}>{stage.hint}</div>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>

                  <div style={{ marginTop: 20 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 12,
                      }}
                    >
                      <h5 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>UPS Tracking Timeline</h5>
                      {selectedOrder?.trackingNumber && (
                        <button
                          className="primary-btn"
                          style={{ background: '#f5f5f5', color: '#111', border: '1px solid var(--border)' }}
                          onClick={handleRefreshTracking}
                          disabled={trackingLoading}
                        >
                          {trackingLoading ? 'Syncing...' : 'Refresh'}
                        </button>
                      )}
                    </div>
                    {trackingTimeline.length ? (
                      <div style={{ maxHeight: 260, overflowY: 'auto', paddingRight: 4 }}>
                        {trackingTimeline.map((event, index) => (
                          <div
                            key={`${event.date}-${event.code}-${index}`}
                            style={{
                              padding: '10px 12px',
                              borderRadius: 10,
                              border: '1px solid var(--border)',
                              marginBottom: 10,
                              background: 'var(--panel)',
                            }}
                          >
                            <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>
                              {formatDateTime(event.date)}
                            </div>
                            <div style={{ fontWeight: 600 }}>
                              {event.description || event.status || 'Status update'}
                            </div>
                            {event.location && (
                              <div style={{ fontSize: 12, color: '#475569' }}>{event.location}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ margin: 0, fontSize: 14, color: '#475569' }}>
                        No UPS scans yet. Refresh after the first carrier scan.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600' }}>Order Items</h4>
                {selectedOrder.items?.map((item, index) => {
                  const isActive = activeItemIndex === index
                  const casualPreview = !item.customDesign
                    ? item.productImage || item.product?.images?.[0]?.url
                    : null;
                  const displayProductName = item.product?.name || item.productName || `Item ${index + 1}`;
                  const displayColor = item.customDesign?.selectedColor || item.selectedColor;
                  const displaySize = item.customDesign?.selectedSize || item.selectedSize;

                  return (
                    <div
                      key={index}
                      className="card"
                      onClick={() => setActiveItemIndex(index)}
                      style={{
                        marginBottom: '12px',
                        border: isActive ? '2px solid var(--accent, #5b21b6)' : undefined,
                        cursor: 'pointer',
                      }}
                    >
                      {casualPreview && (
                        <div
                          style={{
                            marginBottom: 12,
                            borderRadius: 12,
                            overflow: 'hidden',
                            border: '1px solid var(--border)',
                            maxWidth: 220,
                          }}
                        >
                          <img
                            src={casualPreview}
                            alt={displayProductName}
                            style={{ width: '100%', height: 'auto', display: 'block' }}
                          />
                        </div>
                      )}

                      <div className="detail-row">
                        <span className="label">Product:</span>
                        <span className="value">{displayProductName}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Quantity:</span>
                        <span className="value">{item.quantity}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Price:</span>
                        <span className="value">₹{(item.price / 100).toFixed(2)}</span>
                      </div>
                      {displayColor && (
                        <div className="detail-row">
                          <span className="label">Color:</span>
                          <span className="value">{displayColor}</span>
                        </div>
                      )}
                      {displaySize && (
                        <div className="detail-row">
                          <span className="label">Size:</span>
                          <span className="value">{displaySize}</span>
                        </div>
                      )}
                      {item.instruction && (
                        <div className="detail-row">
                          <span className="label">Instruction:</span>
                          <span className="value" style={{ whiteSpace: 'pre-wrap' }}>{item.instruction}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <div className="modal-overlay" onClick={closeImageZoom} style={{ zIndex: 2000 }}>
          <div className="image-zoom-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={closeImageZoom} style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 2001 }}>×</button>
            <img 
              src={zoomedImage} 
              alt="Zoomed Design" 
              className="zoomed-image"
            />
          </div>
        </div>
      )}
    </section>
  )
}


