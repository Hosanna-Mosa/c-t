import { useEffect, useMemo, useState } from 'react'
import api from '@/lib/api'

type CasualProductImage = {
  url: string
  public_id: string
}

type CasualProduct = {
  _id: string
  name: string
  slug: string
  category: string
  description?: string
  price: number
  colors: string[]
  sizes: string[]
  images: CasualProductImage[]
  createdAt: string
  metadata?: {
    material?: string
    fit?: string
    careInstructions?: string
  }
}

const parseList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry).trim().replace(/^[\"\[]+|[\"\]]+$/g, ''))
      .filter(Boolean)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return []
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed.map((entry) => String(entry).trim()).filter(Boolean)
      }
    } catch (_) {
      // fall back to manual split
    }
    return trimmed
      .replace(/^\[|\]$/g, '')
      .split(',')
      .map((entry) => entry.replace(/['"]/g, '').trim())
      .filter(Boolean)
  }
  return []
}

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
  createdAt: raw?.createdAt ?? '',
  metadata: raw?.metadata ?? {},
})

type FormState = {
  name: string
  slug: string
  category: string
  price: string
  description: string
  colors: string
  sizes: string
  material: string
  fit: string
  careInstructions: string
}

const DEFAULT_FORM: FormState = {
  name: '',
  slug: '',
  category: '',
  price: '',
  description: '',
  colors: '',
  sizes: '',
  material: '',
  fit: '',
  careInstructions: '',
}

export function CasualProducts() {
  const [products, setProducts] = useState<CasualProduct[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [formState, setFormState] = useState<FormState>(DEFAULT_FORM)
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagesToRemove, setImagesToRemove] = useState<string[]>([])
  const [editingProduct, setEditingProduct] = useState<CasualProduct | null>(null)

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    try {
      setLoading(true)
      const res = await api.getCasualProducts()
      const normalized = Array.isArray(res.data) ? res.data.map(normalizeProduct) : []
      setProducts(normalized)
      setError(null)
    } catch (e: any) {
      setError(e.message || 'Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormState(DEFAULT_FORM)
    setImageFiles([])
    setImagesToRemove([])
    setEditingProduct(null)
  }

  const openCreateModal = () => {
    resetForm()
    setShowModal(true)
  }

  const openEditModal = (product: CasualProduct) => {
    setEditingProduct(product)
    setFormState({
      name: product.name,
      slug: product.slug,
      category: product.category,
      price: String(product.price ?? ''),
      description: product.description ?? '',
      colors: product.colors.join(', ') ?? '',
      sizes: product.sizes.join(', ') ?? '',
      material: product.metadata?.material ?? '',
      fit: product.metadata?.fit ?? '',
      careInstructions: product.metadata?.careInstructions ?? '',
    })
    setImageFiles([])
    setImagesToRemove([])
    setShowModal(true)
  }

  const handleCloseModal = () => {
    if (saving) return
    setShowModal(false)
    resetForm()
  }

  const appendImages = (files: FileList | null) => {
    if (!files || !files.length) return
    const next = Array.from(files).filter((file) => file.type.startsWith('image/'))
    if (!next.length) return
    setImageFiles((prev) => [...prev, ...next])
  }

  const removePendingImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, idx) => idx !== index))
  }

  const toggleImageRemoval = (publicId: string) => {
    setImagesToRemove((prev) =>
      prev.includes(publicId) ? prev.filter((id) => id !== publicId) : [...prev, publicId],
    )
  }

  const slugified = useMemo(() => {
    if (formState.slug.trim()) return formState.slug.trim()
    return formState.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }, [formState.name, formState.slug])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!formState.name.trim() || !formState.category.trim() || !formState.price.trim()) {
      setError('Name, category and price are required')
      return
    }

    try {
      setSaving(true)
      setError(null)

      const formData = new FormData()
      formData.append('name', formState.name.trim())
      formData.append('slug', slugified)
      formData.append('category', formState.category.trim())
      formData.append('price', String(Number(formState.price)))
      if (formState.description.trim()) formData.append('description', formState.description.trim())
      if (formState.colors.trim())
        formData.append(
          'colors',
          JSON.stringify(
            formState.colors
              .split(',')
              .map((c) => c.trim())
              .filter(Boolean),
          ),
        )
      if (formState.sizes.trim())
        formData.append(
          'sizes',
          JSON.stringify(
            formState.sizes
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          ),
        )
      if (formState.material.trim()) formData.append('material', formState.material.trim())
      if (formState.fit.trim()) formData.append('fit', formState.fit.trim())
      if (formState.careInstructions.trim())
        formData.append('careInstructions', formState.careInstructions.trim())

      imageFiles.forEach((file) => {
        formData.append('images', file)
      })

      if (imagesToRemove.length) {
        formData.append('removeImageIds', JSON.stringify(imagesToRemove))
      }

      if (editingProduct) {
        const res = await api.updateCasualProduct(editingProduct._id, formData)
        const updatedProduct = normalizeProduct(res.data)
        setProducts((prev) =>
          prev.map((item) => (item._id === editingProduct._id ? updatedProduct : item)),
        )
      } else {
        const res = await api.createCasualProduct(formData)
        const newProduct = normalizeProduct(res.data)
        setProducts((prev) => [newProduct, ...prev])
      }

      setShowModal(false)
      resetForm()
    } catch (e: any) {
      setError(e.message || 'Failed to save product')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (productId: string) => {
    if (!confirm('Delete this product permanently?')) return
    try {
      setDeletingId(productId)
      await api.deleteCasualProduct(productId)
      setProducts((prev) => prev.filter((product) => product._id !== productId))
    } catch (e: any) {
      setError(e.message || 'Failed to delete product')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <section>
        <h2>Casual Products</h2>
        <div className="loading">Loading casual products...</div>
      </section>
    )
  }

  return (
    <section>
      <div className="section-header">
        <h2>Casual Products</h2>
        <button className="primary" onClick={openCreateModal}>
          Add Product
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {products.length === 0 ? (
        <div className="empty-state">
          <p>No casual products yet</p>
          <button className="primary" onClick={openCreateModal}>
            Add First Product
          </button>
        </div>
      ) : (
        <div className="products-grid">
          {products.map((product) => (
            <div key={product._id} className="product-card">
              <div className="product-header">
                <h3 className="product-name">{product.name}</h3>
                <div className="product-actions">
                  <button className="edit-btn" onClick={() => openEditModal(product)} title="Edit">
                    ✏️
                  </button>
                  <button
                    className="delete-btn"
                    onClick={() => handleDelete(product._id)}
                    disabled={deletingId === product._id}
                    title="Delete"
                  >
                    {deletingId === product._id ? <span className="loading-spinner" /> : '🗑️'}
                  </button>
                </div>
              </div>

              <div className="product-details" style={{ gap: 10 }}>
                <div className="detail-row">
                  <span className="label">Category:</span>
                  <span className="value">{product.category}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Slug:</span>
                  <span className="value">{product.slug}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Price:</span>
                  <span className="value">${product.price.toFixed(2)}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Colors:</span>
                  <span className="value">{product.colors.length ? product.colors.join(', ') : '—'}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Sizes:</span>
                  <span className="value">{product.sizes.length ? product.sizes.join(', ') : '—'}</span>
                </div>
                {product.description && (
                  <div className="detail-row">
                    <span className="label">Description:</span>
                    <span className="value">
                      {product.description.length > 120
                        ? `${product.description.slice(0, 120)}…`
                        : product.description}
                    </span>
                  </div>
                )}
                {product.images?.length > 0 && (
                  <div className="detail-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                    <span className="label">Images:</span>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {product.images.map((img) => (
                        <img
                          key={img.public_id}
                          src={img.url}
                          alt={product.name}
                          style={{
                            width: 72,
                            height: 72,
                            objectFit: 'cover',
                            borderRadius: 8,
                            border: '1px solid var(--border)',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>{editingProduct ? 'Edit Casual Product' : 'Add Casual Product'}</h3>
              <button className="close-btn" onClick={handleCloseModal}>
                ×
              </button>
            </div>

            <form className="product-form" onSubmit={handleSubmit}>
              <div className="form-row">
                <label>
                  Name *
                  <input
                    type="text"
                    value={formState.name}
                    onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                    required
                  />
                </label>
                <label>
                  Category *
                  <input
                    type="text"
                    value={formState.category}
                    onChange={(e) => setFormState({ ...formState, category: e.target.value })}
                    required
                  />
                </label>
              </div>

              <div className="form-row">
                <label>
                  Slug
                  <input
                    type="text"
                    value={formState.slug}
                    onChange={(e) => setFormState({ ...formState, slug: e.target.value })}
                    placeholder={slugified || 'auto-generated-from-name'}
                  />
                </label>
                <label>
                  Price ($) *
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formState.price}
                    onChange={(e) => setFormState({ ...formState, price: e.target.value })}
                    required
                  />
                </label>
              </div>

              <label>
                Description
                <textarea
                  value={formState.description}
                  onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                  rows={4}
                />
              </label>

              <div className="form-row">
                <label>
                  Colors (comma separated)
                  <input
                    type="text"
                    value={formState.colors}
                    onChange={(e) => setFormState({ ...formState, colors: e.target.value })}
                    placeholder="e.g., Black, White, Red"
                  />
                </label>
                <label>
                  Sizes (comma separated)
                  <input
                    type="text"
                    value={formState.sizes}
                    onChange={(e) => setFormState({ ...formState, sizes: e.target.value })}
                    placeholder="e.g., S, M, L, XL"
                  />
                </label>
              </div>

              <div className="form-row">
                <label>
                  Material
                  <input
                    type="text"
                    value={formState.material}
                    onChange={(e) => setFormState({ ...formState, material: e.target.value })}
                  />
                </label>
                <label>
                  Fit
                  <input
                    type="text"
                    value={formState.fit}
                    onChange={(e) => setFormState({ ...formState, fit: e.target.value })}
                  />
                </label>
              </div>

              <label>
                Care Instructions
                <textarea
                  value={formState.careInstructions}
                  onChange={(e) =>
                    setFormState({ ...formState, careInstructions: e.target.value })
                  }
                  rows={3}
                />
              </label>

              {editingProduct && editingProduct.images?.length > 0 && (
                <div>
                  <p style={{ margin: '0 0 8px 0', fontWeight: 500 }}>Existing Images</p>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {editingProduct.images.map((img) => {
                      const marked = imagesToRemove.includes(img.public_id)
                      return (
                        <button
                          type="button"
                          key={img.public_id}
                          onClick={() => toggleImageRemoval(img.public_id)}
                          style={{
                            position: 'relative',
                            border: marked ? '2px solid var(--danger)' : '2px solid transparent',
                            borderRadius: 10,
                            padding: 0,
                            cursor: 'pointer',
                            background: 'transparent',
                          }}
                          title={marked ? 'Undo remove' : 'Remove on save'}
                        >
                          <img
                            src={img.url}
                            alt={editingProduct.name}
                            style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8 }}
                          />
                          {marked && (
                            <span
                              style={{
                                position: 'absolute',
                                inset: 4,
                                borderRadius: 6,
                                background: 'rgba(220, 53, 69, 0.65)',
                                color: '#fff',
                                fontSize: 12,
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              Remove
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <label>
                Upload Images {editingProduct ? '(new images will be added)' : ''}
                <input type="file" accept="image/*" multiple onChange={(e) => appendImages(e.target.files)} />
              </label>

              {imageFiles.length > 0 && (
                <div>
                  <p style={{ margin: '0 0 8px 0', fontWeight: 500 }}>New Images</p>
                  <div className="image-preview-grid">
                    {imageFiles.map((file, index) => (
                      <div key={`${file.name}-${index}`} className="image-preview-item">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          className="preview-thumbnail"
                        />
                        <button
                          type="button"
                          className="remove-image-btn"
                          onClick={() => removePendingImage(index)}
                          aria-label="Remove image"
                        >
                          ×
                        </button>
                        <div className="image-name">{file.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-actions">
                <button type="button" className="secondary" onClick={handleCloseModal} disabled={saving}>
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

