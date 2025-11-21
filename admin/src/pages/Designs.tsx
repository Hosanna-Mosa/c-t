import { useEffect, useState } from 'react'
import api from '@/lib/api'

type Design = {
  _id: string
  name?: string
  productName?: string
  selectedColor?: string
  selectedSize?: string
  totalPrice?: number
  user?: {
    name: string
    email: string
  }
  productId?: {
    name: string
    slug: string
  }
  frontDesign?: {
    previewImage?: string
    designLayers?: any[]
  }
  backDesign?: {
    previewImage?: string
    designLayers?: any[]
  }
  createdAt: string
  updatedAt: string
}

export function Designs() {
  const [designs, setDesigns] = useState<Design[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getDesigns()
      .then((res) => {
        setDesigns(res.data)
        setLoading(false)
      })
      .catch((e) => {
        setError(e.message)
        setLoading(false)
      })
  }, [])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getPreviewImages = (design: Design) => {
    const images = []
    if (design.frontDesign?.previewImage) {
      images.push({ type: 'front', image: design.frontDesign.previewImage })
    }
    if (design.backDesign?.previewImage) {
      images.push({ type: 'back', image: design.backDesign.previewImage })
    }
    return images
  }

  const getDesignLayersCount = (design: Design) => {
    const frontLayers = design.frontDesign?.designLayers?.length || 0
    const backLayers = design.backDesign?.designLayers?.length || 0
    return frontLayers + backLayers
  }

  if (loading) {
    return (
      <section>
        <h2>Designs</h2>
        <div className="loading">Loading designs...</div>
      </section>
    )
  }

  return (
    <section>
      <h2>Saved Designs</h2>
      {error && <div className="error">{error}</div>}
      
      {designs.length === 0 && !error ? (
        <div className="empty-state">
          <p>No designs found</p>
        </div>
      ) : (
        <div className="designs-grid">
          {designs.map((design) => (
            <div key={design._id} className="design-card">
              <div className="design-preview">
                {getPreviewImages(design).length > 0 ? (
                  <div className="preview-container">
                    {getPreviewImages(design).map((preview, index) => (
                      <div key={index} className="preview-item">
                        <div className="preview-label">{preview.type.toUpperCase()}</div>
                        <img 
                          src={preview.image} 
                          alt={`${preview.type} design preview`}
                          className="preview-image"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-preview">
                    <span>No Preview</span>
                  </div>
                )}
              </div>
              
              <div className="design-info">
                <h3 className="design-name">
                  {design.name || design.productName || 'Unnamed Design'}
                </h3>
                
                <div className="design-details">
                  <div className="detail-row">
                    <span className="label">Product:</span>
                    <span className="value">{design.productName || 'N/A'}</span>
                  </div>
                  
                  <div className="detail-row">
                    <span className="label">Color:</span>
                    <span className="value">{design.selectedColor || 'N/A'}</span>
                  </div>
                  
                  <div className="detail-row">
                    <span className="label">Size:</span>
                    <span className="value">{design.selectedSize || 'N/A'}</span>
                  </div>
                  
                  <div className="detail-row">
                    <span className="label">Price:</span>
                    <span className="value">${design.totalPrice?.toFixed(2) || 'N/A'}</span>
                  </div>
                  
                  <div className="detail-row">
                    <span className="label">Elements:</span>
                    <span className="value">{getDesignLayersCount(design)} layers</span>
                  </div>
                  
                  <div className="detail-row">
                    <span className="label">Customer:</span>
                    <span className="value">
                      {design.user?.name || 'Unknown'} 
                      {design.user?.email && (
                        <span className="email"> ({design.user.email})</span>
                      )}
                    </span>
                  </div>
                  
                  <div className="detail-row">
                    <span className="label">Created:</span>
                    <span className="value">{formatDate(design.createdAt)}</span>
                  </div>
                  
                  <div className="detail-row">
                    <span className="label">Updated:</span>
                    <span className="value">{formatDate(design.updatedAt)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
