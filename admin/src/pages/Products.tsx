import { useEffect, useState } from 'react'
import api from '@/lib/api'

const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:8000/api'

type Product = { 
  _id: string
  name: string
  slug: string
  description?: string
  price: number
  stock: number
  customizable?: boolean
  customizationType?: string
  variants?: Array<{
    color: string
    colorCode: string
    images: Array<{ url: string; public_id: string }>
    frontImages?: Array<{ url: string; public_id: string }>
    backImages?: Array<{ url: string; public_id: string }>
  }>
  createdAt: string
  updatedAt: string
}

type ProductFormData = {
  name: string
  slug: string
  description: string
  price: number
  stock: number
  customizable: boolean
  customizationType: string
}

type Variant = {
  color: string
  colorCode: string
  images: Array<{ url: string; public_id: string }>
  frontImages?: Array<{ url: string; public_id: string }>
  backImages?: Array<{ url: string; public_id: string }>
}

type VariantFormData = {
  color: string
  colorCode: string
}

type VariantImages = {
  front: File[]
  back: File[]
}

export function Products() {
  const [products, setProducts] = useState<Product[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    slug: '',
    description: '',
    price: 0,
    stock: 0,
    customizable: false,
    customizationType: 'both'
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showVariants, setShowVariants] = useState<string | null>(null)
  const [showVariantForm, setShowVariantForm] = useState(false)
  const [editingVariant, setEditingVariant] = useState<{ productId: string; variantIndex: number } | null>(null)
  const [variantFormData, setVariantFormData] = useState<VariantFormData>({
    color: '',
    colorCode: '#000000'
  })
  const [variantImages, setVariantImages] = useState<VariantImages>({
    front: [],
    back: []
  })
  const [uploadingImages, setUploadingImages] = useState(false)
  const [dragOver, setDragOver] = useState<{ front: boolean; back: boolean }>({
    front: false,
    back: false
  })
  const [descEditingId, setDescEditingId] = useState<string | null>(null)
  const [descText, setDescText] = useState<string>('')

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    try {
      setLoading(true)
      const res = await api.getProducts()
      setProducts(res.data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingProduct(null)
    setFormData({
      name: '',
      slug: '',
      description: '',
      price: 0,
      stock: 0,
      customizable: false,
      customizationType: 'both'
    })
    setShowForm(true)
  }

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      slug: product.slug,
      description: product.description || '',
      price: product.price,
      stock: product.stock,
      customizable: product.customizable || false,
      customizationType: product.customizationType || 'both'
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
      return
    }

    try {
      setDeleting(id)
      await api.deleteProduct(id)
      setProducts(products.filter(p => p._id !== id))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setDeleting(null)
    }
  }

  const startEditDescription = (p: Product) => {
    setDescEditingId(p._id)
    setDescText(p.description || '')
  }

  const saveDescription = async (productId: string) => {
    try {
      await api.updateProduct(productId, { description: descText })
      setProducts(products.map(p => p._id === productId ? { ...p, description: descText } : p))
      setDescEditingId(null)
      setDescText('')
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      
      if (editingProduct) {
        await api.updateProduct(editingProduct._id, formData)
        setProducts(products.map(p => 
          p._id === editingProduct._id 
            ? { ...p, ...formData }
            : p
        ))
      } else {
        const res = await api.createProduct(formData)
        setProducts([res.data, ...products])
      }
      
      setShowForm(false)
      setEditingProduct(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingProduct(null)
  }

  // Variant Management Functions
  const handleShowVariants = (productId: string) => {
    setShowVariants(showVariants === productId ? null : productId)
  }

  const handleAddVariant = (productId: string) => {
    setEditingVariant({ productId, variantIndex: -1 }) // -1 indicates new variant
    setVariantFormData({ color: '', colorCode: '#000000' })
    setVariantImages({ front: [], back: [] })
    setShowVariantForm(true)
  }

  const handleEditVariant = (productId: string, variantIndex: number, variant: Variant) => {
    setEditingVariant({ productId, variantIndex })
    setVariantFormData({
      color: variant.color,
      colorCode: variant.colorCode
    })
    setVariantImages({ front: [], back: [] })
    setShowVariantForm(true)
  }

  const handleDeleteVariant = async (productId: string, variantIndex: number) => {
    if (!confirm('Are you sure you want to delete this variant? This will also delete all associated images.')) {
      return
    }

    try {
      const product = products.find(p => p._id === productId)
      if (!product || !product.variants) return

      const updatedVariants = product.variants.filter((_, index) => index !== variantIndex)
      await api.updateProduct(productId, { variants: updatedVariants })
      
      setProducts(products.map(p => 
        p._id === productId 
          ? { ...p, variants: updatedVariants }
          : p
      ))
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleVariantSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Variant submit called, editingVariant:', editingVariant)
    
    // Determine product ID - either from editingVariant or from the current context
    let productId: string
    if (editingVariant?.productId) {
      productId = editingVariant.productId
      console.log('Using productId from editingVariant:', productId)
    } else {
      // If no editingVariant, we need to get the product ID from somewhere
      // This should not happen in normal flow, but let's handle it gracefully
      console.error('No product ID available for variant submission')
      return
    }

    try {
      setUploadingImages(true)
      const product = products.find(p => p._id === productId)
      if (!product) return

      // Create FormData for file upload
      const formData = new FormData()
      
      // Add variant data
      const variantData = {
        color: variantFormData.color,
        colorCode: variantFormData.colorCode,
        images: [] // Will be populated after upload
      }
      
      // Add front images with proper naming
      variantImages.front.forEach((file, index) => {
        formData.append(`images_${variantFormData.color}_front_${index}`, file)
      })
      
      // Add back images with proper naming
      variantImages.back.forEach((file, index) => {
        formData.append(`images_${variantFormData.color}_back_${index}`, file)
      })
      
      // Add variants data as JSON string
      formData.append('variants', JSON.stringify([variantData]))

      // Call API with FormData
      console.log('Making API call to:', `${API_BASE}/products/${productId}`)
      console.log('FormData contents:', Array.from(formData.entries()))
      
      const response = await fetch(`${API_BASE}/products/${productId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_auth_token')}`
        },
        body: formData
      })
      
      console.log('API response status:', response.status)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to update product')
      }

      const result = await response.json()
      
      // Update local state with the response
      setProducts(products.map(p => 
        p._id === productId 
          ? result.data
          : p
      ))
      
      setShowVariantForm(false)
      setEditingVariant(null)
      setVariantImages({ front: [], back: [] })
      setDragOver({ front: false, back: false })
      
    } catch (e: any) {
      setError(e.message)
    } finally {
      setUploadingImages(false)
    }
  }

  const handleVariantCancel = () => {
    setShowVariantForm(false)
    setEditingVariant(null)
    setVariantFormData({ color: '', colorCode: '#000000' })
    setVariantImages({ front: [], back: [] })
    setDragOver({ front: false, back: false })
  }

  // Drag and Drop Functions
  const handleDragOver = (e: React.DragEvent, type: 'front' | 'back') => {
    e.preventDefault()
    setDragOver(prev => ({ ...prev, [type]: true }))
  }

  const handleDragLeave = (e: React.DragEvent, type: 'front' | 'back') => {
    e.preventDefault()
    setDragOver(prev => ({ ...prev, [type]: false }))
  }

  const handleDrop = (e: React.DragEvent, type: 'front' | 'back') => {
    e.preventDefault()
    setDragOver(prev => ({ ...prev, [type]: false }))
    
    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('image/')
    )
    
    if (files.length > 0) {
      setVariantImages(prev => ({
        ...prev,
        [type]: [...prev[type], ...files]
      }))
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'front' | 'back') => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      setVariantImages(prev => ({
        ...prev,
        [type]: [...prev[type], ...files]
      }))
    }
  }

  const removeImage = (type: 'front' | 'back', index: number) => {
    setVariantImages(prev => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index)
    }))
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <section>
        <h2>Products</h2>
        <div className="loading">Loading products...</div>
      </section>
    )
  }

  return (
    <section>
      <div className="section-header">
      <h2>Products</h2>
        <button className="primary" onClick={handleCreate}>
          Add Product
        </button>
      </div>
      
      {error && <div className="error">{error}</div>}
      
      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>{editingProduct ? 'Edit Product' : 'Add Product'}</h3>
              <button className="close-btn" onClick={handleCancel}>×</button>
            </div>
            
            <form onSubmit={handleSubmit} className="product-form">
              <div className="form-row">
                <label>
                  Name *
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                  />
                </label>
                
                <label>
                  Slug *
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData({...formData, slug: e.target.value})}
                    required
                  />
                </label>
              </div>
              
              <label>
                Description
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={3}
                />
              </label>
              
              <div className="form-row">
                <label>
                  Price ($) *
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: Number(e.target.value)})}
                    required
                    min="0"
                    step="0.01"
                  />
                </label>
                
                <label>
                  Stock *
                  <input
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({...formData, stock: Number(e.target.value)})}
                    required
                    min="0"
                  />
                </label>
              </div>
              
              <div className="form-row">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.customizable}
                    onChange={(e) => setFormData({...formData, customizable: e.target.checked})}
                  />
                  Customizable
                </label>
                
                {formData.customizable && (
                  <label>
                    Customization Type
                    <select
                      value={formData.customizationType}
                      onChange={(e) => setFormData({...formData, customizationType: e.target.value})}
                    >
                      <option value="predefined">Predefined Only</option>
                      <option value="own">User Own Design</option>
                      <option value="both">Both</option>
                    </select>
                  </label>
                )}
              </div>
              
              <div className="form-actions">
                <button type="button" onClick={handleCancel} className="secondary">
                  Cancel
                </button>
                <button type="submit" className="primary" disabled={saving}>
                  {saving ? 'Saving...' : (editingProduct ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {products.length === 0 ? (
        <div className="empty-state">
          <p>No products found</p>
          <button className="primary" onClick={handleCreate}>
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
                  <button 
                    className="edit-btn" 
                    onClick={() => handleEdit(product)}
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button 
                    className="delete-btn" 
                    onClick={() => handleDelete(product._id)}
                    disabled={deleting === product._id}
                    title="Delete"
                  >
                    {deleting === product._id ? '⏳' : '🗑️'}
                  </button>
                </div>
              </div>
              
              <div className="product-details">
                <div className="detail-row">
                  <span className="label">Slug:</span>
                  <span className="value">{product.slug}</span>
                </div>
                
                <div className="detail-row">
                  <span className="label">Price:</span>
                  <span className="value">${product.price.toFixed(2)}</span>
                </div>
                
                <div className="detail-row">
                  <span className="label">Stock:</span>
                  <span className="value">{product.stock}</span>
                </div>
                
                <div className="detail-row">
                  <span className="label">Customizable:</span>
                  <span className="value">{product.customizable ? 'Yes' : 'No'}</span>
                </div>
                
                {product.customizable && (
                  <div className="detail-row">
                    <span className="label">Type:</span>
                    <span className="value">{product.customizationType}</span>
                  </div>
                )}
                
                <div className="detail-row">
                  <span className="label">Variants:</span>
                  <div className="variant-info">
                    <span className="value">{product.variants?.length || 0} colors</span>
                    <button 
                      className="variants-btn" 
                      onClick={() => handleShowVariants(product._id)}
                    >
                      {showVariants === product._id ? 'Hide' : 'Manage'} Variants
                    </button>
                  </div>
                </div>
                
                <div className="detail-row">
                  <span className="label">Created:</span>
                  <span className="value">{formatDate(product.createdAt)}</span>
                </div>

                <div className="detail-row">
                  <span className="label">Description:</span>
                  <span className="value">{product.description ? product.description.substring(0, 80) + (product.description.length > 80 ? '…' : '') : '—'}</span>
                </div>

                <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="primary" onClick={() => startEditDescription(product)}>Add Description</button>
                </div>

                {descEditingId === product._id && (
                  <div className="card" style={{ marginTop: 8 }}>
                    <label>
                      Product Description
                      <textarea
                        value={descText}
                        onChange={(e) => setDescText(e.target.value)}
                        style={{ width: '100%', minHeight: 100, borderRadius: 8, border: '1px solid var(--border)', padding: 10 }}
                      />
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="primary" onClick={() => saveDescription(product._id)}>Save</button>
                      <button className="primary" onClick={() => setDescEditingId(null)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Variants Section */}
              {showVariants === product._id && (
                <div className="variants-section">
                  <div className="variants-header">
                    <h4>Product Variants</h4>
                    <button 
                      className="add-variant-btn" 
                      onClick={() => handleAddVariant(product._id)}
                    >
                      + Add Variant
                    </button>
                  </div>
                  
                  {product.variants && product.variants.length > 0 ? (
                    <div className="variants-list">
                      {product.variants.map((variant, index) => (
                        <div key={index} className="variant-item">
                          <div className="variant-preview">
                            <div 
                              className="color-swatch" 
                              style={{ backgroundColor: variant.colorCode }}
                            />
                            <div className="variant-details">
                              <div className="variant-name">{variant.color}</div>
                              <div className="variant-code">{variant.colorCode}</div>
                              <div className="variant-images">
                                <div className="image-count">
                                  Front: {variant.frontImages?.length || 0} | Back: {variant.backImages?.length || 0}
                                </div>
                                <div className="total-images">
                                  Total: {variant.images?.length || 0} image{(variant.images?.length || 0) !== 1 ? 's' : ''}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="variant-actions">
                            <button 
                              className="edit-variant-btn"
                              onClick={() => handleEditVariant(product._id, index, variant)}
                            >
                              ✏️
                            </button>
                            <button 
                              className="delete-variant-btn"
                              onClick={() => handleDeleteVariant(product._id, index)}
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="no-variants">
                      <p>No variants added yet</p>
                      <button 
                        className="add-variant-btn" 
                        onClick={() => handleAddVariant(product._id)}
                      >
                        + Add First Variant
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Variant Form Modal */}
      {showVariantForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>{editingVariant && editingVariant.variantIndex >= 0 ? 'Edit Variant' : 'Add Variant'}</h3>
              <button className="close-btn" onClick={handleVariantCancel}>×</button>
            </div>
            
            <form onSubmit={handleVariantSubmit} className="variant-form">
              <div className="form-row">
                <label>
                  Color Name *
                  <input
                    type="text"
                    value={variantFormData.color}
                    onChange={(e) => setVariantFormData({...variantFormData, color: e.target.value})}
                    required
                    placeholder="e.g., Red, Blue, Black"
                  />
                </label>
                
                <label>
                  Color Code *
                  <input
                    type="color"
                    value={variantFormData.colorCode}
                    onChange={(e) => setVariantFormData({...variantFormData, colorCode: e.target.value})}
                    required
                  />
                </label>
              </div>
              
              <div className="image-upload-section">
                <h4>Product Images</h4>
                
                {/* Front Images */}
                <div className="image-upload-area">
                  <label className="image-upload-label">Front Images</label>
                  <div 
                    className={`drag-drop-area ${dragOver.front ? 'drag-over' : ''}`}
                    onDragOver={(e) => handleDragOver(e, 'front')}
                    onDragLeave={(e) => handleDragLeave(e, 'front')}
                    onDrop={(e) => handleDrop(e, 'front')}
                  >
                    <div className="drag-drop-content">
                      <div className="upload-icon">📷</div>
                      <p>Drag & drop front images here</p>
                      <p className="upload-hint">or click to browse</p>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => handleFileSelect(e, 'front')}
                        className="file-input"
                      />
                    </div>
                  </div>
                  
                  {variantImages.front.length > 0 && (
                    <div className="selected-images">
                      <h5>Selected Front Images:</h5>
                      <div className="image-preview-grid">
                        {variantImages.front.map((file, index) => (
                          <div key={index} className="image-preview-item">
                            <img 
                              src={URL.createObjectURL(file)} 
                              alt={`Front ${index + 1}`}
                              className="preview-thumbnail"
                            />
                            <button 
                              className="remove-image-btn"
                              onClick={() => removeImage('front', index)}
                            >
                              ×
                            </button>
                            <div className="image-name">{file.name}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Back Images */}
                <div className="image-upload-area">
                  <label className="image-upload-label">Back Images</label>
                  <div 
                    className={`drag-drop-area ${dragOver.back ? 'drag-over' : ''}`}
                    onDragOver={(e) => handleDragOver(e, 'back')}
                    onDragLeave={(e) => handleDragLeave(e, 'back')}
                    onDrop={(e) => handleDrop(e, 'back')}
                  >
                    <div className="drag-drop-content">
                      <div className="upload-icon">📷</div>
                      <p>Drag & drop back images here</p>
                      <p className="upload-hint">or click to browse</p>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => handleFileSelect(e, 'back')}
                        className="file-input"
                      />
                    </div>
                  </div>
                  
                  {variantImages.back.length > 0 && (
                    <div className="selected-images">
                      <h5>Selected Back Images:</h5>
                      <div className="image-preview-grid">
                        {variantImages.back.map((file, index) => (
                          <div key={index} className="image-preview-item">
                            <img 
                              src={URL.createObjectURL(file)} 
                              alt={`Back ${index + 1}`}
                              className="preview-thumbnail"
                            />
                            <button 
                              className="remove-image-btn"
                              onClick={() => removeImage('back', index)}
                            >
                              ×
                            </button>
                            <div className="image-name">{file.name}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="form-actions">
                <button type="button" onClick={handleVariantCancel} className="secondary">
                  Cancel
                </button>
                <button type="submit" className="primary" disabled={uploadingImages}>
                  {uploadingImages ? (
                    <>
                      <div className="loading-spinner"></div>
                      Uploading Images...
                    </>
                  ) : (
                    editingVariant && editingVariant.variantIndex >= 0 ? 'Update' : 'Add'
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


