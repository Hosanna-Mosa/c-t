import { useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import { AddressSelector } from '@/components/AddressSelector'
import { createOrderFromCart, getMe, getActiveCoupons, applyCoupon, getShippingRate, getAllShippingOptions } from '@/lib/api'
import { useCart } from '@/contexts/CartContext'
import { useAuth } from '@/hooks/use-auth'
import { ShoppingBag, CreditCard, Truck, Shield, Tag, X, Clock } from 'lucide-react'
import { toast } from 'sonner'

type AppliedCoupon = {
  code: string
  description?: string
  discountType?: 'percentage' | 'fixed'
  discountValue?: number
}

export default function Checkout() {
  const navigate = useNavigate()
  const { cartItems, loading: cartLoading } = useCart()
  const { isAuthenticated } = useAuth()
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'square'>('square')
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [userAddresses, setUserAddresses] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [availableCoupons, setAvailableCoupons] = useState<any[]>([])
  const [applyingCoupon, setApplyingCoupon] = useState(false)
  const couponInputRef = useRef<HTMLInputElement>(null)
  const [shippingCost, setShippingCost] = useState(0)
  const [loadingShipping, setLoadingShipping] = useState(false)
  const [shippingError, setShippingError] = useState<string | null>(null)
  const [shippingOptions, setShippingOptions] = useState<any[]>([])
  const [selectedShippingOption, setSelectedShippingOption] = useState<string | null>(null)
  const [transitInfo, setTransitInfo] = useState<{
    transitDays?: number
    estimatedDelivery?: string
    deliveryTime?: string
    isGuaranteed?: boolean
    serviceName?: string
  } | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    
    if (cartItems.length === 0) {
      navigate('/cart')
      return
    }
  }, [isAuthenticated, cartItems.length, navigate])

  const loadUserAddresses = async () => {
    try {
      const res = await getMe()
      const addresses = (res as any).data?.addresses || []
      setUserAddresses(addresses)
      
      // Auto-select default address if available; otherwise if there is exactly one address, select it
      const defaultAddr = addresses.find((addr: any) => addr.isDefault)
      if (defaultAddr) {
        setSelectedAddressId(defaultAddr._id)
      } else if (addresses.length === 1) {
        setSelectedAddressId(addresses[0]._id)
      }
    } catch (error) {
      // User might not be logged in, that's okay
      console.error('Failed to load addresses:', error)
    }
  }

  useEffect(() => {
    // Load user addresses
    loadUserAddresses()

    // Load active coupons
    getActiveCoupons().then((coupons) => {
      setAvailableCoupons(coupons || [])
    }).catch(() => {
      // Ignore errors, coupons are optional
    })
  }, [])

  // Handle address updates - refresh addresses and recalculate shipping
  const handleAddressUpdate = async () => {
    // Store the currently selected address ID before refreshing
    const currentSelectedId = selectedAddressId
    
    // Refresh addresses from server
    try {
      const res = await getMe()
      const addresses = (res as any).data?.addresses || []
      setUserAddresses(addresses)
      
      // If we had a selected address, try to keep it selected (in case it was just updated)
      if (currentSelectedId) {
        const stillExists = addresses.find((addr: any) => addr._id === currentSelectedId)
        if (stillExists) {
          // Keep the same address selected - this will trigger shipping recalculation
          setSelectedAddressId(currentSelectedId)
          return
        }
      }
      
      // Otherwise, auto-select default or first address
      const defaultAddr = addresses.find((addr: any) => addr.isDefault)
      if (defaultAddr) {
        setSelectedAddressId(defaultAddr._id)
      } else if (addresses.length === 1) {
        setSelectedAddressId(addresses[0]._id)
      }
    } catch (error) {
      console.error('Failed to refresh addresses:', error)
    }
    // The shipping calculation useEffect will automatically trigger when userAddresses/selectedAddressId updates
  }

  // Fetch all shipping options when address is selected
  useEffect(() => {
    if (!selectedAddressId) {
      setShippingCost(0)
      setShippingError(null)
      setShippingOptions([])
      setSelectedShippingOption(null)
      setTransitInfo(null)
      return
    }

    const selectedAddress = userAddresses.find(addr => addr._id === selectedAddressId)
    if (!selectedAddress || !selectedAddress.city || !selectedAddress.postalCode) {
      setShippingCost(0)
      setShippingError(null)
      setShippingOptions([])
      setSelectedShippingOption(null)
      setTransitInfo(null)
      return
    }

    // Calculate total weight (estimate 0.5 lbs per item)
    const estimatedWeight = Math.max(1, Math.ceil(cartItems.length * 0.5))

    setLoadingShipping(true)
    setShippingError(null)
    setShippingOptions([])
    setSelectedShippingOption(null)

    getAllShippingOptions(
      {
        name: selectedAddress.fullName || 'Customer',
        addressLine: selectedAddress.line1,
        line1: selectedAddress.line1,
        line2: selectedAddress.line2,
        city: selectedAddress.city,
        state: selectedAddress.state,
        stateProvinceCode: selectedAddress.state,
        postalCode: selectedAddress.postalCode,
        country: selectedAddress.country || 'US',
        countryCode: selectedAddress.country || 'US',
      },
      estimatedWeight
    )
      .then((result) => {
        console.log('[Checkout] Shipping options response:', result) // Debug log
        const options = result?.options || []
        setShippingOptions(options)
        setShippingError(null)
        
        // Auto-select the first option (usually fastest/cheapest)
        if (options.length > 0) {
          const firstOption = options[0]
          setSelectedShippingOption(firstOption.serviceCode)
          setShippingCost(firstOption.cost || 0)
          
          // Set transit info for selected option
          if (firstOption.transitDays || firstOption.estimatedDelivery) {
            setTransitInfo({
              transitDays: firstOption.transitDays,
              estimatedDelivery: firstOption.estimatedDelivery,
              deliveryTime: firstOption.deliveryTime,
              isGuaranteed: firstOption.isGuaranteed,
              serviceName: firstOption.serviceName,
            })
          } else {
            setTransitInfo(null)
          }
        } else {
          setShippingError('No shipping options available')
          setShippingCost(0)
          setTransitInfo(null)
        }
      })
      .catch((error) => {
        console.error('Shipping options error:', error)
        
        // Extract the actual error message from the API response
        let errorMessage = 'Unable to calculate shipping. Please contact support.'
        
        if (error && typeof error === 'object') {
          if (error.message) {
            errorMessage = error.message
          } else if (error.error) {
            errorMessage = error.error
          }
        } else if (typeof error === 'string') {
          errorMessage = error
        }
        
        // Make error message more user-friendly
        errorMessage = errorMessage
          .replace(/^\[UPS\]\s*/i, '')
          .replace(/^\[Shipping\]\s*/i, '')
          .replace(/^Failed to calculate shipping rate:\s*/i, '')
          .trim()
        
        // Format common UPS error messages to be more user-friendly
        if (errorMessage.includes('postal code') && errorMessage.includes('invalid')) {
          // Extract postal code and state from error message
          const postalMatch = errorMessage.match(/postal code\s+(\d+)/i)
          const stateMatch = errorMessage.match(/for\s+([A-Z]{2})/i)
          if (postalMatch && stateMatch) {
            errorMessage = `Invalid postal code ${postalMatch[1]} for ${stateMatch[1]}. Please check your address.`
          } else {
            errorMessage = `Address validation error: ${errorMessage}`
          }
        } else if (errorMessage.includes('City and postal code are required')) {
          errorMessage = 'Please ensure your address has a valid city and postal code.'
        } else if (errorMessage.includes('Destination address is required')) {
          errorMessage = 'Please select a shipping address.'
        } else if (errorMessage.includes('Authentication') || errorMessage.includes('credentials')) {
          errorMessage = 'Shipping service temporarily unavailable. Please try again later.'
        }
        
        setShippingError(errorMessage)
        setShippingCost(0)
        setShippingOptions([])
        setSelectedShippingOption(null)
        setTransitInfo(null)
      })
      .finally(() => {
        setLoadingShipping(false)
      })
  }, [selectedAddressId, userAddresses, cartItems.length])

  // Handle shipping option selection
  const handleShippingOptionSelect = (serviceCode: string) => {
    const option = shippingOptions.find(opt => opt.serviceCode === serviceCode)
    if (option) {
      setSelectedShippingOption(serviceCode)
      setShippingCost(option.cost || 0)
      setTransitInfo({
        transitDays: option.transitDays,
        estimatedDelivery: option.estimatedDelivery,
        deliveryTime: option.deliveryTime,
        isGuaranteed: option.isGuaranteed,
        serviceName: option.serviceName,
      })
    }
  }

  const subtotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + (item.totalPrice * item.quantity), 0)
  }, [cartItems])

  const total = useMemo(() => {
    // shippingCost is in cents, convert to dollars for calculation
    const shippingInDollars = shippingCost / 100
    return Math.max(0, subtotal - discountAmount + shippingInDollars)
  }, [subtotal, discountAmount, shippingCost])

  // Format delivery date from UPS format (YYYYMMDD) to readable format
  const formatDeliveryDate = (dateStr?: string) => {
    if (!dateStr) return null
    try {
      // Handle both YYYYMMDD and YYYY-MM-DD formats
      const cleanDate = dateStr.replace(/-/g, '')
      if (cleanDate.length === 8) {
        const year = cleanDate.substring(0, 4)
        const month = cleanDate.substring(4, 6)
        const day = cleanDate.substring(6, 8)
        const date = new Date(`${year}-${month}-${day}`)
        return date.toLocaleDateString('en-US', { 
          weekday: 'short',
          month: 'short', 
          day: 'numeric',
          year: 'numeric'
        })
      }
      return dateStr
    } catch {
      return dateStr
    }
  }

  const handleApplyCoupon = async (code?: string) => {
    // If code is provided (from clicking a coupon), use it directly
    // Otherwise, get the current value from the input ref or state
    let codeToApply = code
    
    if (!codeToApply) {
      // Try to get from ref first (most current value)
      if (couponInputRef.current) {
        codeToApply = couponInputRef.current.value?.trim().toUpperCase() || ''
      }
      // Fallback to state if ref doesn't have value
      if (!codeToApply) {
        codeToApply = couponCode.trim().toUpperCase()
      }
    } else {
      // Ensure code from parameter is uppercase
      codeToApply = codeToApply.trim().toUpperCase()
    }
    
    if (!codeToApply) {
      toast.error('Please enter a coupon code')
      return
    }

    setApplyingCoupon(true)
    setErr(null)
    try {
      const result = await applyCoupon(codeToApply, subtotal)
      // Only store essential coupon data to avoid circular references
      setAppliedCoupon({
        code: result.coupon?.code || codeToApply,
        description: result.coupon?.description || '',
        discountType: result.coupon?.discountType,
        discountValue: result.coupon?.discountValue,
      })
      setDiscountAmount(result.discountAmount)
      setCouponCode('')
      toast.success(`Coupon "${result.coupon.code}" applied! Discount: $${result.discountAmount.toFixed(2)}`)
    } catch (e: any) {
      const errorMessage = typeof e === 'object' && e !== null && 'message' in e 
        ? String(e.message) 
        : 'Invalid coupon code'
      toast.error(errorMessage)
      setAppliedCoupon(null)
      setDiscountAmount(0)
    } finally {
      setApplyingCoupon(false)
    }
  }

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null)
    setDiscountAmount(0)
    setCouponCode('')
    toast.success('Coupon removed')
  }

  // Re-apply coupon when subtotal changes
  useEffect(() => {
    if (appliedCoupon?.code && subtotal > 0) {
      const couponCode = appliedCoupon.code
      applyCoupon(couponCode, subtotal)
        .then((result) => {
          setDiscountAmount(result.discountAmount)
          // Update coupon data if needed, but only store essential fields
          if (result.coupon) {
            setAppliedCoupon({
              code: result.coupon.code || couponCode,
              description: result.coupon.description || appliedCoupon.description || '',
              discountType: result.coupon.discountType,
              discountValue: result.coupon.discountValue,
            })
          }
        })
        .catch(() => {
          // If coupon becomes invalid, remove it
          setAppliedCoupon(null)
          setDiscountAmount(0)
          setCouponCode('')
        })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal, appliedCoupon?.code])

  async function placeOrder() {
    if (cartItems.length === 0 || !selectedAddressId) return
    
    // Try to find the selected address from our cached list; if missing (e.g., just added), refetch once
    let selectedAddress = userAddresses.find(addr => addr._id === selectedAddressId)
    if (!selectedAddress) {
      try {
        const res = await getMe()
        const refreshedAddresses = (res as any).data?.addresses || []
        setUserAddresses(refreshedAddresses)
        selectedAddress = refreshedAddresses.find((addr: any) => addr._id === selectedAddressId) || null
      } catch (_) {
        // ignore, we'll handle error below
      }
    }
    if (!selectedAddress) {
      setErr('Please select a valid shipping address')
      return
    }
    
    setLoading(true)
    setErr(null)
    try {
      const res = await createOrderFromCart({ 
        paymentMethod,
        shippingAddress: selectedAddress,
        couponCode: appliedCoupon?.code || null,
        discountAmount: discountAmount > 0 ? discountAmount : null,
        shippingCost: shippingCost > 0 ? shippingCost : null,
        shippingServiceCode: selectedShippingOption || null,
        shippingServiceName: transitInfo?.serviceName || null
      })
      const responseData = (res as any).data || res
      
      if (paymentMethod === 'square') {
        const checkoutUrl =
          responseData?.checkoutUrl ||
          (res as any)?.squareSession?.checkoutUrl ||
          responseData?.payment?.checkoutUrl

        if (checkoutUrl) {
          toast.success('Redirecting you to Square to complete payment...')
          window.location.href = checkoutUrl
          return
        }

        toast.error('Unable to start Square checkout. Please contact support.')
        return
      }

      const order = responseData
      toast.success('Order placed successfully!')
      navigate('/orders')
    } catch (e: any) {
      setErr(e?.message || 'Failed to place order')
      toast.error('Failed to place order')
    } finally {
      setLoading(false)
    }
  }

  if (cartLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="container mx-auto p-6 flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading checkout...</p>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="container mx-auto p-6 flex-1 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardContent className="p-6 text-center">
              <h2 className="text-xl font-semibold mb-2">Your Cart is Empty</h2>
              <p className="text-muted-foreground mb-4">Add some items to your cart to proceed with checkout.</p>
              <Button onClick={() => navigate('/cart')}>View Cart</Button>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/20">
      <Navbar />
      
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-8 flex-1">
        <div className="max-w-5xl mx-auto">
          <div className="mb-4 sm:mb-6 md:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">Checkout</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Complete your order securely</p>
          </div>

          {err && (
            <Card className="mb-4 sm:mb-6 border-2 border-red-200 bg-red-50/50">
              <CardContent className="p-3 sm:p-4">
                <p className="text-sm sm:text-base text-red-600">{err}</p>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col lg:flex-row lg:gap-6 xl:gap-8">
            {/* Left Column - Order Details */}
            <div className="flex-1 space-y-4 sm:space-y-5 md:space-y-6">
              {/* Coupon Section */}
              <Card className="border-2 shadow-lg">
                <CardHeader className="p-4 sm:p-6 bg-gradient-to-r from-primary/5 to-transparent">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Tag className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    Coupon Code
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 space-y-4">
                  {appliedCoupon ? (
                    <div className="p-3 sm:p-4 bg-gradient-to-br from-green-50 to-green-100/50 border-2 border-green-200 rounded-xl">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-bold text-green-800 text-sm sm:text-base">
                            Coupon Applied: {appliedCoupon.code}
                          </p>
                          <p className="text-xs sm:text-sm text-green-700 mt-1">
                            Discount: <span className="font-semibold">${discountAmount.toFixed(2)}</span>
                            {appliedCoupon.description && ` - ${appliedCoupon.description}`}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleRemoveCoupon}
                          className="text-green-700 hover:text-green-800 hover:bg-green-200/50 h-8 w-8 p-0 shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {availableCoupons.length > 0 && (
                        <div className="pt-2 border-t">
                          <p className="text-xs sm:text-sm text-muted-foreground mb-3 font-semibold">Available Coupons:</p>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {availableCoupons.map((coupon) => (
                              <div
                                key={coupon._id}
                                className="p-3 bg-gradient-to-br from-muted/50 to-muted/30 rounded-lg text-xs sm:text-sm cursor-pointer hover:bg-muted transition-all duration-200 border border-muted-foreground/10 hover:border-primary/30"
                                onClick={() => handleApplyCoupon(coupon.code)}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-bold text-foreground">{coupon.code}</span>
                                  <span className="text-primary font-semibold">
                                    {coupon.discountType === 'percentage'
                                      ? `${coupon.discountValue}% OFF`
                                      : `$${coupon.discountValue} OFF`}
                                  </span>
                                </div>
                                {coupon.description && (
                                  <p className="text-muted-foreground mt-1 text-xs">{coupon.description}</p>
                                )}
                                {coupon.minPurchase > 0 && (
                                  <p className="text-muted-foreground mt-1 text-xs">
                                    Min. purchase: ${coupon.minPurchase}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Order Summary */}
              <Card className="border-2 shadow-lg">
                <CardHeader className="p-4 sm:p-6 bg-gradient-to-r from-primary/5 to-transparent">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    Order Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 space-y-4">
                  {cartItems.map((item) => (
                    <div key={item._id} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 border-2 rounded-xl bg-gradient-to-br from-muted/30 to-muted/10 hover:shadow-md transition-all">
                      <div className="w-full sm:w-20 md:w-24 h-32 sm:h-20 md:h-24 flex-shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-muted to-muted/50 shadow-md">
                        {item.frontDesign?.previewImage || item.productImage ? (
                          <img 
                            src={item.frontDesign?.previewImage || item.productImage} 
                            alt={item.productName} 
                            className="w-full h-full object-cover" 
                          />
                        ) : (
                          <div className="w-full h-full bg-muted rounded-lg flex items-center justify-center text-muted-foreground text-xs">
                            No Preview
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 w-full sm:w-auto">
                        <h3 className="font-bold text-sm sm:text-base mb-1.5 line-clamp-2">{item.productName}</h3>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {item.selectedSize && (
                            <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">
                              Size: {item.selectedSize}
                            </span>
                          )}
                          {item.selectedColor && (
                            <span className="px-2 py-0.5 bg-secondary/50 rounded-full text-xs">
                              {item.selectedColor}
                            </span>
                          )}
                        </div>
                        <div className="text-xs sm:text-sm text-muted-foreground space-y-0.5 mb-2">
                          <p>
                            Base: <span className="font-medium text-foreground">${item.basePrice.toFixed(2)}</span>
                          </p>
                          {(item.frontCustomizationCost ?? 0) > 0 && (
                            <p>
                              Front: <span className="font-medium text-foreground">${(item.frontCustomizationCost ?? 0).toFixed(2)}</span>
                            </p>
                          )}
                          {(item.backCustomizationCost ?? 0) > 0 && (
                            <p>
                              Back: <span className="font-medium text-foreground">${(item.backCustomizationCost ?? 0).toFixed(2)}</span>
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t">
                          <Label className="text-xs sm:text-sm text-muted-foreground">
                            Qty: <span className="font-semibold text-foreground">{item.quantity}</span>
                          </Label>
                          <span className="font-bold text-primary text-base sm:text-lg">
                            ${(item.totalPrice * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <Separator className="my-4" />
                  
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center text-sm sm:text-base">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-semibold text-foreground">${Number(subtotal).toFixed(2)}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between items-center text-sm sm:text-base text-green-600">
                        <span>Discount ({appliedCoupon?.code})</span>
                        <span className="font-semibold">-${Number(discountAmount).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm sm:text-base">
                        <span className="text-muted-foreground">Shipping</span>
                        {loadingShipping ? (
                          <span className="text-muted-foreground text-xs">Calculating...</span>
                        ) : shippingError ? (
                          <div className="flex flex-col items-end">
                            <span className="text-amber-600 text-xs font-medium">Unable to calculate</span>
                            <span className="text-amber-600/80 text-[10px] mt-0.5 max-w-[200px] text-right leading-tight">
                              {shippingError}
                            </span>
                          </div>
                        ) : shippingOptions.length > 0 ? (
                          <span className="font-semibold text-foreground">${(shippingCost / 100).toFixed(2)}</span>
                        ) : null}
                      </div>
                      
                      {shippingOptions.length > 0 && (
                        <RadioGroup
                          value={selectedShippingOption || ''}
                          onValueChange={handleShippingOptionSelect}
                          className="space-y-2"
                        >
                          {shippingOptions.map((option) => (
                            <div
                              key={option.serviceCode}
                              className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                selectedShippingOption === option.serviceCode
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border hover:border-primary/50'
                              }`}
                              onClick={() => handleShippingOptionSelect(option.serviceCode)}
                            >
                              <RadioGroupItem
                                value={option.serviceCode}
                                id={`shipping-${option.serviceCode}`}
                                className="mt-0.5"
                              />
                              <label
                                htmlFor={`shipping-${option.serviceCode}`}
                                className="flex-1 cursor-pointer"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                  <div className="flex-1">
                                    <div className="font-medium text-sm">{option.serviceName}</div>
                                    {(option.transitDays || option.estimatedDelivery) && (
                                      <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        <span>
                                          {option.transitDays 
                                            ? `Est. ${option.transitDays} ${option.transitDays === 1 ? 'day' : 'days'}`
                                            : 'Est. delivery'}
                                          {option.estimatedDelivery && (
                                            <span className="ml-1">
                                              {formatDeliveryDate(option.estimatedDelivery)}
                                            </span>
                                          )}
                                          {option.isGuaranteed && (
                                            <span className="ml-1 text-green-600 font-medium">✓ Guaranteed</span>
                                          )}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="font-semibold text-sm sm:text-base">
                                    ${(option.cost / 100).toFixed(2)}
                                  </div>
                                </div>
                              </label>
                            </div>
                          ))}
                        </RadioGroup>
                      )}
                    </div>
                    <Separator className="my-3" />
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-base sm:text-lg font-bold text-foreground">Total</span>
                      <span className="text-xl sm:text-2xl font-bold text-primary">
                        ${Number(total).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Address Selection */}
              <AddressSelector 
                selectedAddressId={selectedAddressId}
                onAddressSelect={setSelectedAddressId}
                onAddressUpdate={handleAddressUpdate}
              />

              {/* Payment Method */}
              <Card className="border-2 shadow-lg">
                <CardHeader className="p-4 sm:p-6 bg-gradient-to-r from-primary/5 to-transparent">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    Payment Method
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  <RadioGroup value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as 'cod' | 'square')}>
                    <div className="flex items-center space-x-3 p-4 border-2 rounded-xl hover:bg-muted/50 transition-all cursor-pointer">
                      <RadioGroupItem value="cod" id="cod" />
                      <Label htmlFor="cod" className="flex items-center gap-2 cursor-pointer flex-1">
                        <Truck className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span className="text-sm sm:text-base font-medium">Cash on Delivery</span>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3 p-4 border-2 rounded-xl hover:bg-muted/50 transition-all cursor-pointer mt-3">
                      <RadioGroupItem value="square" id="square" />
                      <Label htmlFor="square" className="flex items-center gap-2 cursor-pointer flex-1">
                        <CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span className="text-sm sm:text-base font-medium">Square Secure Checkout</span>
                      </Label>
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Order Actions */}
            <div className="lg:w-80 xl:w-96 lg:sticky lg:top-24 lg:self-start mt-4 lg:mt-0">
              <Card className="border-2 shadow-xl">
                <CardHeader className="p-4 sm:p-6 bg-gradient-to-r from-primary/5 to-transparent">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    Secure Checkout
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 space-y-4">
                  <div className="space-y-2.5 text-xs sm:text-sm text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <span className="text-green-600 mt-0.5">✓</span>
                      <p>Your payment information is secure and encrypted</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-green-600 mt-0.5">✓</span>
                      <p>Free shipping on all orders</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-green-600 mt-0.5">✓</span>
                      <p>30-day return policy</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-green-600 mt-0.5">✓</span>
                      <p>24/7 customer support</p>
                    </div>
                  </div>
                  
                  {!selectedAddressId && (
                    <div className="p-3 bg-amber-50 border-2 border-amber-200 rounded-xl">
                      <p className="text-xs sm:text-sm text-amber-700 font-medium">
                        ⚠️ Please select a shipping address to continue
                      </p>
                    </div>
                  )}
                  
                  <Button 
                    onClick={placeOrder} 
                    disabled={loading || cartItems.length === 0 || !selectedAddressId}
                    className="w-full h-11 sm:h-12 text-sm sm:text-base font-semibold gradient-hero shadow-lg hover:shadow-xl transition-all duration-200"
                    size="lg"
                  >
                    {loading ? 'Placing Order...' : 'Place Order'}
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    onClick={() => navigate('/products')}
                    className="w-full h-10 sm:h-11 text-sm sm:text-base border-2"
                  >
                    Continue Shopping
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}


