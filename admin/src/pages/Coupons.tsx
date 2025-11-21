import { useEffect, useState } from 'react'
import api from '@/lib/api'

type Coupon = {
  _id: string
  code: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  minPurchase: number
  maxDiscount: number | null
  validFrom: string
  validTo: string
  isActive: boolean
  usageLimit: number | null
  usedCount: number
  description: string
  createdAt: string
  updatedAt: string
}

type CouponFormData = {
  code: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  minPurchase: number
  maxDiscount: number | null
  validFrom: string
  validTo: string
  isActive: boolean
  usageLimit: number | null
  description: string
}

export function Coupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null)
  const [formData, setFormData] = useState<CouponFormData>({
    code: '',
    discountType: 'percentage',
    discountValue: 10,
    minPurchase: 0,
    maxDiscount: null,
    validFrom: new Date().toISOString().split('T')[0],
    validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    isActive: true,
    usageLimit: null,
    description: '',
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    loadCoupons()
  }, [])

  const loadCoupons = async () => {
    try {
      setLoading(true)
      const res = await api.getCoupons()
      setCoupons(res.data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingCoupon(null)
    setFormData({
      code: '',
      discountType: 'percentage',
      discountValue: 10,
      minPurchase: 0,
      maxDiscount: null,
      validFrom: new Date().toISOString().split('T')[0],
      validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      isActive: true,
      usageLimit: null,
      description: '',
    })
    setShowForm(true)
  }

  const handleEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon)
    setFormData({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minPurchase: coupon.minPurchase,
      maxDiscount: coupon.maxDiscount,
      validFrom: new Date(coupon.validFrom).toISOString().split('T')[0],
      validTo: new Date(coupon.validTo).toISOString().split('T')[0],
      isActive: coupon.isActive,
      usageLimit: coupon.usageLimit,
      description: coupon.description || '',
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this coupon? This action cannot be undone.')) {
      return
    }

    try {
      setDeleting(id)
      await api.deleteCoupon(id)
      setCoupons(coupons.filter(c => c._id !== id))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setDeleting(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError(null)

      // Normalize payload: convert empty strings, 0, or undefined to null for optional fields
      const payload = {
        ...formData,
        maxDiscount: 
          formData.maxDiscount === null || 
          formData.maxDiscount === undefined || 
          formData.maxDiscount === 0
            ? null 
            : Number(formData.maxDiscount),
        usageLimit: 
          formData.usageLimit === null || 
          formData.usageLimit === undefined || 
          formData.usageLimit === 0
            ? null 
            : Number(formData.usageLimit),
        minPurchase: formData.minPurchase ? Number(formData.minPurchase) : 0,
        discountValue: Number(formData.discountValue),
      }

      if (editingCoupon) {
        await api.updateCoupon(editingCoupon._id, payload)
        setCoupons(coupons.map(c => c._id === editingCoupon._id ? { ...c, ...payload } : c))
      } else {
        const res = await api.createCoupon(payload)
        setCoupons([res.data, ...coupons])
      }

      setShowForm(false)
      setEditingCoupon(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingCoupon(null)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const isExpired = (validTo: string) => {
    return new Date(validTo) < new Date()
  }

  const isActive = (coupon: Coupon) => {
    const now = new Date()
    return (
      coupon.isActive &&
      new Date(coupon.validFrom) <= now &&
      new Date(coupon.validTo) >= now &&
      (coupon.usageLimit === null || coupon.usedCount < coupon.usageLimit)
    )
  }

  if (loading) {
    return (
      <section>
        <h2>Coupons</h2>
        <div className="loading">Loading coupons...</div>
      </section>
    )
  }

  return (
    <section>
      <div className="section-header">
        <h2>Coupons</h2>
        <button className="primary" onClick={handleCreate}>
          Add Coupon
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {showForm && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3>{editingCoupon ? 'Edit Coupon' : 'Create Coupon'}</h3>
          <form onSubmit={handleSubmit} className="form">
            <div>
              <label>Coupon Code *</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="e.g., SAVE20"
                required
                disabled={!!editingCoupon}
                style={{ textTransform: 'uppercase' }}
              />
            </div>

            <div>
              <label>Discount Type *</label>
              <select
                value={formData.discountType}
                onChange={(e) => setFormData({ ...formData, discountType: e.target.value as 'percentage' | 'fixed' })}
                required
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount ($)</option>
              </select>
            </div>

            <div>
              <label>
                Discount Value * ({formData.discountType === 'percentage' ? '%' : '$'})
              </label>
              <input
                type="number"
                value={formData.discountValue}
                onChange={(e) => setFormData({ ...formData, discountValue: parseFloat(e.target.value) || 0 })}
                min="0"
                step={formData.discountType === 'percentage' ? '0.1' : '1'}
                required
              />
            </div>

            {formData.discountType === 'percentage' && (
              <div>
                <label>Max Discount ($) - Leave empty for no limit</label>
                <input
                  type="number"
                  value={formData.maxDiscount || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maxDiscount: e.target.value ? parseFloat(e.target.value) || null : null,
                    })
                  }
                  min="0"
                  step="1"
                  placeholder="No limit"
                />
              </div>
            )}

            <div>
              <label>Minimum Purchase ($)</label>
              <input
                type="number"
                value={formData.minPurchase}
                onChange={(e) => setFormData({ ...formData, minPurchase: parseFloat(e.target.value) || 0 })}
                min="0"
                step="1"
              />
            </div>

            <div>
              <label>Valid From *</label>
              <input
                type="date"
                value={formData.validFrom}
                onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                required
              />
            </div>

            <div>
              <label>Valid To *</label>
              <input
                type="date"
                value={formData.validTo}
                onChange={(e) => setFormData({ ...formData, validTo: e.target.value })}
                required
              />
            </div>

            <div>
              <label>Usage Limit - Leave empty for unlimited</label>
              <input
                type="number"
                value={formData.usageLimit || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    usageLimit: e.target.value ? parseInt(e.target.value) || null : null,
                  })
                }
                min="1"
                step="1"
                placeholder="Unlimited"
              />
            </div>

            <div>
              <label>Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="Optional description for this coupon"
              />
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
                Active
              </label>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="primary" type="submit" disabled={saving}>
                {saving ? 'Saving...' : editingCoupon ? 'Update Coupon' : 'Create Coupon'}
              </button>
              <button type="button" onClick={handleCancel} className="secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ textAlign: 'left', padding: '12px' }}>Code</th>
              <th style={{ textAlign: 'left', padding: '12px' }}>Discount</th>
              <th style={{ textAlign: 'left', padding: '12px' }}>Min Purchase</th>
              <th style={{ textAlign: 'left', padding: '12px' }}>Valid Period</th>
              <th style={{ textAlign: 'left', padding: '12px' }}>Usage</th>
              <th style={{ textAlign: 'left', padding: '12px' }}>Status</th>
              <th style={{ textAlign: 'right', padding: '12px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {coupons.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#6b7280' }}>
                  No coupons found. Create your first coupon!
                </td>
              </tr>
            ) : (
              coupons.map((coupon) => (
                <tr key={coupon._id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '12px', fontWeight: 600 }}>{coupon.code}</td>
                  <td style={{ padding: '12px' }}>
                    {coupon.discountType === 'percentage' ? (
                      <>
                        {coupon.discountValue}%
                        {coupon.maxDiscount && ` (max $${coupon.maxDiscount})`}
                      </>
                    ) : (
                      <>${coupon.discountValue}</>
                    )}
                  </td>
                  <td style={{ padding: '12px' }}>
                    {coupon.minPurchase > 0 ? `$${coupon.minPurchase}` : 'No minimum'}
                  </td>
                  <td style={{ padding: '12px', fontSize: '14px' }}>
                    {formatDate(coupon.validFrom)} - {formatDate(coupon.validTo)}
                  </td>
                  <td style={{ padding: '12px', fontSize: '14px' }}>
                    {coupon.usageLimit ? `${coupon.usedCount}/${coupon.usageLimit}` : `${coupon.usedCount} (unlimited)`}
                  </td>
                  <td style={{ padding: '12px' }}>
                    {isExpired(coupon.validTo) ? (
                      <span style={{ color: '#ef4444' }}>Expired</span>
                    ) : isActive(coupon) ? (
                      <span style={{ color: '#10b981' }}>Active</span>
                    ) : (
                      <span style={{ color: '#f59e0b' }}>Inactive</span>
                    )}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button
                        className="secondary"
                        onClick={() => handleEdit(coupon)}
                        style={{ fontSize: '14px', padding: '6px 12px' }}
                      >
                        Edit
                      </button>
                      <button
                        className="danger"
                        onClick={() => handleDelete(coupon._id)}
                        disabled={deleting === coupon._id}
                        style={{ fontSize: '14px', padding: '6px 12px' }}
                      >
                        {deleting === coupon._id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}



