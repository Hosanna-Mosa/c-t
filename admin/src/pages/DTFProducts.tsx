import { useEffect, useMemo, useState } from 'react'
import api from '@/lib/api'

type DTFProduct = {
  _id: string
  title: string
  slug: string
  description?: string
  cost: number
  image?: {
    url: string
    public_id?: string
  }
  createdAt: string
  updatedAt: string
}

type FormState = {
  title: string
  slug: string
  description: string
  cost: string
}

const DEFAULT_FORM: FormState = {
  title: '',
  slug: '',
  description: '',
  cost: '',
}

export function DTFProducts() {
  const [products, setProducts] = useState<DTFProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formState, setFormState] = useState<FormState>(DEFAULT_FORM)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingProduct, setEditingProduct] = useState<DTFProduct | null>(null)

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    try {
      setLoading(true)
      const res = await api.getDTFProducts()
      setProducts(res.data || [])
      setError(null)
    } catch (e: any) {
      setError(e.message || 'Failed to load DTF products')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenCreate = () => {
    setFormState(DEFAULT_FORM)
    setImageFile(null)
    setImagePreview(null)
    setEditingProduct(null)
    setDialogOpen(true)
  }

  const handleOpenEdit = (product: DTFProduct) => {
    setEditingProduct(product)
    setFormState({
      title: product.title,
      slug: product.slug,
      description: product.description || '',
      cost: product.cost.toString(),
    })
    setImageFile(null)
    setImagePreview(product.image?.url || null)
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    if (saving) return
    setDialogOpen(false)
    setEditingProduct(null)
    setImageFile(null)
    setImagePreview(null)
    setFormState(DEFAULT_FORM)
  }

  const slugified = useMemo(() => {
    if (formState.slug.trim()) return formState.slug.trim()
    return formState.title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }, [formState.title, formState.slug])

  const handleImageChange = (file: File | null) => {
    if (!file) {
      setImageFile(null)
      setImagePreview(null)
      return
    }
    setImageFile(file)
    const preview = URL.createObjectURL(file)
    setImagePreview(preview)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!formState.title.trim()) {
      setError('Title is required')
      return
    }

    if (!formState.cost.trim() || Number.isNaN(Number(formState.cost))) {
      setError('Cost must be a valid number')
      return
    }

    if (!editingProduct && !imageFile) {
      setError('An image is required for new DTF products')
      return
    }

    try {
      setSaving(true)
      setError(null)

      const formData = new FormData()
      formData.append('title', formState.title.trim())
      formData.append('slug', slugified)
      if (formState.description.trim()) {
        formData.append('description', formState.description.trim())
      }
      formData.append('cost', Number(formState.cost).toString())
      if (imageFile) {
        formData.append('image', imageFile)
      }

      if (editingProduct) {
        const res = await api.updateDTFProduct(editingProduct._id, formData)
        setProducts((prev) =>
          prev.map((item) => (item._id === editingProduct._id ? res.data : item)),
        )
      } else {
        const res = await api.createDTFProduct(formData)
        setProducts((prev) => [res.data, ...prev])
      }

      handleCloseDialog()
    } catch (e: any) {
      setError(e.message || 'Failed to save DTF product')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this DTF product permanently?')) return
    try {
      setDeletingId(id)
      await api.deleteDTFProduct(id)
      setProducts((prev) => prev.filter((product) => product._id !== id))
    } catch (e: any) {
      setError(e.message || 'Failed to delete product')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <section>
        <h2>DTF Products</h2>
        <div className="loading">Loading DTF catalog...</div>
      </section>
    )
  }

  return (
    <section>
      <div className="section-header">
        <h2>DTF Products</h2>
        <button className="primary" onClick={handleOpenCreate}>
          Add New
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {products.length === 0 ? (
        <div className="empty-state">
          <p>No DTF products yet</p>
          <button className="primary" onClick={handleOpenCreate}>
            Add First DTF Product
          </button>
        </div>
      ) : (
        <div className="products-grid">
          {products.map((product) => (
            <div key={product._id} className="product-card">
              {product.image?.url && (
                <div className="dtf-card-media">
                  <img src={product.image.url} alt={product.title} />
                </div>
              )}
              <div className="product-header">
                <h3 className="product-name">{product.title}</h3>
                <div className="product-actions">
                  <button className="edit-btn" onClick={() => handleOpenEdit(product)} title="Edit">
                    ✏️
                  </button>
                  <button
                    className="delete-btn"
                    onClick={() => handleDelete(product._id)}
                    disabled={deletingId === product._id}
                    title="Delete"
                  >
                    {deletingId === product._id ? '⏳' : '🗑️'}
                  </button>
                </div>
              </div>
              <div className="product-details" style={{ gap: 12 }}>
                <div className="detail-row">
                  <span className="label">Slug:</span>
                  <span className="value">{product.slug}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Cost:</span>
                  <span className="value">${product.cost.toFixed(2)}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Created:</span>
                  <span className="value">
                    {new Date(product.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="label">Description:</span>
                  <span className="value">
                    {product.description
                      ? product.description.length > 140
                        ? `${product.description.slice(0, 140)}…`
                        : product.description
                      : '—'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {dialogOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>{editingProduct ? 'Edit DTF Product' : 'Add DTF Product'}</h3>
              <button className="close-btn" onClick={handleCloseDialog}>
                ×
              </button>
            </div>

            <form className="product-form" onSubmit={handleSubmit}>
              <label>
                Title *
                <input
                  type="text"
                  value={formState.title}
                  onChange={(e) => setFormState({ ...formState, title: e.target.value })}
                  required
                  placeholder="Example: Neon Splash Sheet"
                />
              </label>

              <div className="form-row">
                <label>
                  Slug
                  <input
                    type="text"
                    value={formState.slug}
                    onChange={(e) => setFormState({ ...formState, slug: e.target.value })}
                    placeholder="auto-generated if empty"
                  />
                </label>
                <label>
                  Cost (USD) *
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formState.cost}
                    onChange={(e) => setFormState({ ...formState, cost: e.target.value })}
                    required
                  />
                </label>
              </div>

              <label>
                Description
                <textarea
                  rows={4}
                  value={formState.description}
                  onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                  placeholder="Short summary about this DTF-ready artwork."
                />
              </label>

              <label>
                Product Image {editingProduct ? '(leave empty to keep current)' : '*'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageChange(e.target.files?.[0] || null)}
                />
              </label>

              {imagePreview && (
                <div className="image-preview">
                  <img src={imagePreview} alt="Selected preview" />
                </div>
              )}

              <div className="form-actions">
                <button type="button" className="secondary" onClick={handleCloseDialog}>
                  Cancel
                </button>
                <button type="submit" className="primary" disabled={saving}>
                  {saving ? (
                    <>
                      <span className="loading-spinner" />
                      Saving...
                    </>
                  ) : editingProduct ? (
                    'Update Product'
                  ) : (
                    'Create Product'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}


