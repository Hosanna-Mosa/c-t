import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { CheckCircle, XCircle, Loader2, ArrowLeft } from 'lucide-react'
import { verifySquarePayment } from '@/lib/api'

type Status = 'loading' | 'success' | 'failed'

export default function Payments() {
  const navigate = useNavigate()
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)

  // Square might send payment info in various query param formats
  const transactionId = searchParams.get('transactionId') || searchParams.get('payment_id') || searchParams.get('paymentId') || searchParams.get('tender_id') || searchParams.get('tenderId')
  const squareOrderId = searchParams.get('orderId') || searchParams.get('order_id') || searchParams.get('squareOrderId')
  const sessionId = searchParams.get('sessionId') || searchParams.get('session_id')
  const legacyOrderId = searchParams.get('localOrderId')
  const referenceId = sessionId || legacyOrderId

  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState('Hold tight, we are confirming your payment...')
  const [order, setOrder] = useState<any>(null)

  useEffect(() => {
    if (!referenceId) {
      setStatus('failed')
      setMessage('Missing checkout reference. Please try checking out again.')
      return
    }

    const verify = async () => {
      try {
        const payload: {
          sessionId?: string
          orderId?: string
          transactionId?: string
          squareOrderId?: string
        } = sessionId
          ? {
              sessionId,
              transactionId: transactionId || undefined,
              squareOrderId: squareOrderId || undefined,
            }
          : {
              orderId: legacyOrderId || undefined,
              transactionId: transactionId || undefined,
              squareOrderId: squareOrderId || undefined,
            }

        const result = await verifySquarePayment(payload)

        setOrder(result.order)

        if (result.paymentStatus === 'paid') {
          setStatus('success');
          setMessage('Payment completed successfully. Your order is now processing.')
        } else {
          setStatus('failed')
          setMessage('Payment was not completed. Please try again or choose another method.')
        }
      } catch (error: any) {
        setStatus('failed')
        if (error?.status === 401) {
          setMessage('Please sign in again to view your payment details.')
        } else {
          setMessage(error?.message || 'Unable to verify payment. Please try again.')
        }
      }
    }

    verify()
  }, [sessionId, legacyOrderId, referenceId, transactionId, squareOrderId])

  const summary = useMemo(() => {
    if (!order) return null
    const itemsTotal = (order.items || []).reduce(
      (sum: number, item: any) => sum + (item.price || 0) * (item.quantity || 1),
      0
    )
    const shipping = (order.shippingCost || 0) / 100
    const discount = order?.coupon?.discountAmount || 0
    const finalTotal = Math.max(0, itemsTotal - discount + shipping)

    return {
      id: order._id || referenceId,
      itemsTotal,
      shipping,
      discount,
      finalTotal,
    }
  }, [order])

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/20">
      <Navbar />

      <div className="container mx-auto px-4 py-10 flex-1">
        <div className="max-w-2xl mx-auto">
          <Button
            variant="ghost"
            className="mb-6 flex items-center gap-2"
            onClick={() => navigate('/checkout')}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Checkout
          </Button>

          <Card className="border-2 shadow-xl">
            <CardHeader className="text-center space-y-3">
              {status === 'loading' && <Loader2 className="h-10 w-10 mx-auto animate-spin text-muted-foreground" />}
              {status === 'success' && <CheckCircle className="h-10 w-10 mx-auto text-green-600" />}
              {status === 'failed' && <XCircle className="h-10 w-10 mx-auto text-red-500" />}
              <CardTitle className="text-2xl font-bold">
                {status === 'loading' && 'Verifying Payment'}
                {status === 'success' && 'Payment Successful'}
                {status === 'failed' && 'Payment Incomplete'}
              </CardTitle>
              <p className="text-sm text-muted-foreground">{message}</p>
            </CardHeader>

            <CardContent className="space-y-6">
              {summary ? (
                <div className="p-4 border rounded-xl bg-muted/50 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Order ID</span>
                    <Badge variant="secondary">{String(summary.id || '').slice(-8) || '—'}</Badge>
                  </div>
                  <Separator />
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Items total</span>
                      <span>${summary.itemsTotal.toFixed(2)}</span>
                    </div>
                    {summary.discount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount</span>
                        <span>- ${summary.discount.toFixed(2)}</span>
                      </div>
                    )}
                    {summary.shipping > 0 && (
                      <div className="flex justify-between">
                        <span>Shipping</span>
                        <span>${summary.shipping.toFixed(2)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between text-lg font-semibold">
                      <span>Final total</span>
                      <span>${summary.finalTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 border rounded-xl text-sm text-muted-foreground">
                  We will show your order summary once verification completes.
                </div>
              )}

              <div className="space-y-3">
                {status === 'success' && (
                  <Button className="w-full h-12 text-lg" onClick={() => navigate('/orders')}>
                    View My Orders
                  </Button>
                )}
                {status === 'failed' && (
                  <>
                    <Button className="w-full h-12 text-lg" onClick={() => navigate('/checkout')}>
                      Try Checkout Again
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => navigate('/cart')}
                    >
                      Review Cart
                    </Button>
                  </>
                )}
                {status === 'loading' && (
                  <Button variant="secondary" disabled className="w-full h-12 text-lg">
                    Checking payment status...
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Footer />
    </div>
  )
}


