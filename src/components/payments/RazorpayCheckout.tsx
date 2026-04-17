'use client'

/**
 * RazorpayCheckout Component
 *
 * Displays a payment summary card and handles the full Razorpay checkout flow.
 *
 * State machine:
 *   loading_script → ready → processing → success | failed | dismissed | script_error
 *
 * Script loading:
 *   Injects <script> on mount. Falls back to script_error after 10s timeout.
 *   Reuses existing script if already loaded (window.Razorpay exists).
 *
 * Signature verification:
 *   On Razorpay success callback → POST /api/payments/verify (server-side HMAC check).
 *   Never trusts client-side success alone.
 */

import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Loader2, Lock, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'

// Extend Window for Razorpay SDK
declare global {
  interface Window {
    Razorpay: any
  }
}

type CheckoutState =
  | 'loading_script'
  | 'ready'
  | 'processing'
  | 'success'
  | 'failed'
  | 'dismissed'
  | 'script_error'

export interface RazorpayCheckoutProps {
  orderId: string           // internal UUID (our razorpay_orders.id)
  razorpayOrderId: string   // rzp_order_xxx from Razorpay
  amount: number            // paise
  currency: string
  campaignTitle: string
  platformFee: number       // paise
  influencerAmount: number  // paise
  feePercent: number        // e.g. 10
  brandName: string
  brandEmail: string
  onSuccess: (paymentId: string) => void
  onFailure: (error: string) => void
}

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js'
const SCRIPT_TIMEOUT_MS = 10_000

export function RazorpayCheckout({
  orderId,
  razorpayOrderId,
  amount,
  currency,
  campaignTitle,
  platformFee,
  influencerAmount,
  feePercent,
  brandName,
  brandEmail,
  onSuccess,
  onFailure,
}: RazorpayCheckoutProps) {
  const [state, setState] = useState<CheckoutState>('loading_script')
  const [errorMessage, setErrorMessage] = useState('')
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load Razorpay script on mount ──────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Already loaded by a previous mount
    if (window.Razorpay) {
      setState('ready')
      return
    }

    // Check if script tag already exists in DOM
    if (document.querySelector(`script[src="${RAZORPAY_SCRIPT_URL}"]`)) {
      // Script tag exists but Razorpay may not be ready yet — poll briefly
      let attempts = 0
      const poll = setInterval(() => {
        if (window.Razorpay) {
          clearInterval(poll)
          setState('ready')
        } else if (++attempts > 20) {
          clearInterval(poll)
          setState('script_error')
        }
      }, 250)
      return () => clearInterval(poll)
    }

    const script = document.createElement('script')
    script.src = RAZORPAY_SCRIPT_URL
    script.async = true

    script.onload = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      setState('ready')
    }

    script.onerror = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      setState('script_error')
    }

    timeoutRef.current = setTimeout(() => {
      setState(window.Razorpay ? 'ready' : 'script_error')
    }, SCRIPT_TIMEOUT_MS)

    document.body.appendChild(script)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  // ── Open Razorpay modal ────────────────────────────────────────
  const openRazorpay = () => {
    if (!window.Razorpay) {
      setState('script_error')
      return
    }

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
    if (!keyId) {
      setState('failed')
      setErrorMessage('Payment configuration error. Please contact support.')
      return
    }

    // Track if payment.failed fired so ondismiss doesn't override it
    let paymentFailed = false

    setState('processing')

    const rzp = new window.Razorpay({
      key: keyId,
      order_id: razorpayOrderId,
      amount,
      currency,
      name: 'Earn4Insights',
      description: campaignTitle,
      theme: { color: '#6366f1' },
      prefill: { email: brandEmail, name: brandName },
      modal: {
        ondismiss: () => {
          if (!paymentFailed) {
            setState('dismissed')
          }
        },
      },
      handler: async (response: {
        razorpay_order_id: string
        razorpay_payment_id: string
        razorpay_signature: string
      }) => {
        // Razorpay reports success — verify signature server-side
        try {
          const res = await fetch('/api/payments/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            }),
          })
          const data = await res.json()
          if (res.ok && data.success) {
            setState('success')
            onSuccess(response.razorpay_payment_id)
          } else {
            setState('failed')
            const msg = data.error ?? 'Payment verification failed. Contact support if amount was deducted.'
            setErrorMessage(msg)
            onFailure(msg)
          }
        } catch {
          setState('failed')
          const msg = 'Network error during verification. Contact support if amount was deducted.'
          setErrorMessage(msg)
          onFailure(msg)
        }
      },
    })

    rzp.on('payment.failed', (response: any) => {
      paymentFailed = true
      setState('failed')
      const msg =
        response?.error?.description ??
        response?.error?.reason ??
        'Payment failed. Please try a different payment method.'
      setErrorMessage(msg)
      onFailure(msg)
    })

    rzp.open()
  }

  const reset = () => {
    setErrorMessage('')
    setState('ready')
  }

  // ── Format amounts ─────────────────────────────────────────────
  const fmtTotal = formatCurrency(amount, currency)
  const fmtFee   = formatCurrency(platformFee, currency)
  const fmtInflu = formatCurrency(influencerAmount, currency)

  return (
    <Card className="max-w-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Lock className="h-4 w-4 text-indigo-500" />
          Payment Summary
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Campaign label */}
        <p className="text-xs text-muted-foreground">
          Campaign:{' '}
          <span className="font-medium text-foreground truncate">{campaignTitle}</span>
        </p>

        <Separator />

        {/* Fee breakdown */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Campaign budget</span>
            <span className="font-medium">{fmtTotal}</span>
          </div>
          <div className="flex justify-between text-muted-foreground text-xs">
            <span>Platform fee ({feePercent}%)</span>
            <span>{fmtFee}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-semibold">
            <span>You pay today</span>
            <span>{fmtTotal}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Influencer receives</span>
            <span>{fmtInflu}</span>
          </div>
        </div>

        <Separator />

        {/* CTA — varies by state */}
        {state === 'loading_script' && (
          <Button disabled className="w-full" size="sm">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Loading payment gateway…
          </Button>
        )}

        {state === 'ready' && (
          <Button
            onClick={openRazorpay}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
            size="sm"
          >
            <Lock className="h-3.5 w-3.5 mr-2" />
            Proceed to Secure Payment
          </Button>
        )}

        {state === 'processing' && (
          <Button disabled className="w-full" size="sm">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Verifying payment…
          </Button>
        )}

        {state === 'success' && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm">
            <CheckCircle className="h-4 w-4 flex-shrink-0" />
            <span>Payment successful! Funds are now in escrow.</span>
          </div>
        )}

        {state === 'failed' && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{errorMessage || 'Payment failed. Please try again.'}</span>
            </div>
            <Button onClick={reset} variant="outline" size="sm" className="w-full">
              <RefreshCw className="h-3.5 w-3.5 mr-2" />
              Try Again
            </Button>
          </div>
        )}

        {state === 'dismissed' && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>Payment cancelled. Your order is saved — you can retry anytime.</span>
            </div>
            <Button onClick={reset} variant="outline" size="sm" className="w-full">
              <RefreshCw className="h-3.5 w-3.5 mr-2" />
              Try Again
            </Button>
          </div>
        )}

        {state === 'script_error' && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>Payment gateway unavailable. Please refresh the page or try again later.</span>
          </div>
        )}

        {/* Trust badge */}
        <p className="text-[11px] text-center text-muted-foreground pt-1">
          🔒 Secured by Razorpay · Funds held in escrow until milestones are approved
        </p>
      </CardContent>
    </Card>
  )
}
