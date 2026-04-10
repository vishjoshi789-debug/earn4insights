'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Banknote, CircleDot, Landmark } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'

interface Aggregate {
  currency: string
  released: number
  escrowed: number
  pending: number
  refunded: number
  thisMonth: number
}

interface PaymentBreakdownProps {
  aggregates: Aggregate[]
  loading?: boolean
}

const STATUS_ROWS = [
  { key: 'escrowed' as const, label: 'Escrowed', dotColor: 'bg-blue-500', description: 'Held by platform' },
  { key: 'released' as const, label: 'Released', dotColor: 'bg-green-500', description: 'Received' },
  { key: 'pending' as const, label: 'Pending', dotColor: 'bg-yellow-500', description: 'Not yet escrowed' },
  { key: 'refunded' as const, label: 'Refunded', dotColor: 'bg-red-500', description: 'Returned to brand' },
]

function SkeletonBreakdown() {
  return (
    <Card>
      <CardHeader>
        <div className="h-5 w-36 bg-muted rounded animate-pulse" />
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="h-4 w-20 bg-muted rounded animate-pulse" />
            <div className="h-4 w-24 bg-muted rounded animate-pulse" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function PaymentBreakdown({ aggregates, loading }: PaymentBreakdownProps) {
  if (loading) return <SkeletonBreakdown />

  const hasCurrencies = aggregates.length > 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Banknote className="h-4 w-4" />
          Payment Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Status rows grouped by currency */}
        {!hasCurrencies ? (
          <p className="text-sm text-muted-foreground text-center py-4">No payment data yet</p>
        ) : (
          aggregates.map(agg => (
            <div key={agg.currency} className="space-y-2">
              {aggregates.length > 1 && (
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{agg.currency}</p>
              )}
              {STATUS_ROWS.map(row => (
                <div key={row.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CircleDot className={`h-3 w-3 ${row.dotColor.replace('bg-', 'text-')}`} />
                    <span className="text-sm">{row.label}</span>
                  </div>
                  <span className="text-sm font-medium">{formatCurrency(agg[row.key], agg.currency)}</span>
                </div>
              ))}
              {aggregates.length > 1 && <hr className="border-muted" />}
            </div>
          ))
        )}

        {/* Payout button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Button className="w-full" disabled>
                  <Banknote className="h-4 w-4 mr-2" />
                  Request Payout
                </Button>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Coming Soon — Razorpay Integration</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Bank details placeholder */}
        <div className="rounded-md border border-dashed p-3 text-center">
          <Landmark className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
          <p className="text-xs text-muted-foreground">Payment details setup coming soon</p>
        </div>

        {/* Footnote */}
        {aggregates.length > 1 && (
          <p className="text-[11px] text-muted-foreground text-center">
            Amounts in original campaign currency
          </p>
        )}
      </CardContent>
    </Card>
  )
}
