'use client'

import { useState, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ArrowUpDown, Download, Receipt } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'

interface Payment {
  id: string
  campaignId: string
  campaignTitle: string
  brandId: string
  productId: string | null
  milestoneId: string | null
  milestoneTitle: string | null
  amount: number
  currency: string
  paymentType: string
  status: string
  platformFee: number
  escrowedAt: string | null
  releasedAt: string | null
  refundedAt: string | null
  createdAt: string
}

interface EarningsTableProps {
  payments: Payment[]
  loading?: boolean
  onCampaignClick?: (campaignId: string) => void
}

type SortKey = 'amount' | 'createdAt' | 'status'
type SortDir = 'asc' | 'desc'

const STATUS_STYLES: Record<string, string> = {
  escrowed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  released: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  refunded: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  failed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
}

function SkeletonTable() {
  return (
    <Card>
      <CardHeader>
        <div className="h-5 w-32 bg-muted rounded animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function EarningsTable({ payments, loading, onCampaignClick }: EarningsTableProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('createdAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }, [sortKey])

  const filtered = useMemo(() => {
    let rows = [...payments]

    if (statusFilter !== 'all') {
      rows = rows.filter(p => p.status === statusFilter)
    }

    rows.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'amount') cmp = a.amount - b.amount
      else if (sortKey === 'status') cmp = a.status.localeCompare(b.status)
      else cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      return sortDir === 'asc' ? cmp : -cmp
    })

    return rows
  }, [payments, statusFilter, sortKey, sortDir])

  const exportCsv = useCallback(() => {
    const headers = ['Campaign', 'Brand ID', 'Amount', 'Currency', 'Status', 'Milestone', 'Date']
    const rows = filtered.map(p => [
      p.campaignTitle,
      p.brandId,
      (p.amount / 100).toFixed(2),
      p.currency,
      p.status,
      p.milestoneTitle ?? '',
      new Date(p.createdAt).toLocaleDateString(),
    ])

    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `earnings-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [filtered])

  if (loading) return <SkeletonTable />

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Earnings History
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="released">Released</SelectItem>
                <SelectItem value="escrowed">Escrowed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="h-3.5 w-3.5 mr-1" />
              CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
            <Receipt className="h-7 w-7 text-muted-foreground" />
            <p className="text-sm font-medium">No earnings yet</p>
            <p className="text-xs text-muted-foreground">
              Complete campaign milestones to start earning.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort('amount')} className="flex items-center gap-1 hover:text-foreground">
                      Amount <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort('status')} className="flex items-center gap-1 hover:text-foreground">
                      Status <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead>Milestone</TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort('createdAt')} className="flex items-center gap-1 hover:text-foreground">
                      Date <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(p => (
                  <TableRow
                    key={p.id}
                    className={onCampaignClick ? 'cursor-pointer' : ''}
                    onClick={() => onCampaignClick?.(p.campaignId)}
                  >
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {p.campaignTitle}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatCurrency(p.amount, p.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={STATUS_STYLES[p.status] ?? ''}>
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                      {p.milestoneTitle ?? '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(p.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filtered.length === 0 && payments.length > 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No payments match the current filter.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
