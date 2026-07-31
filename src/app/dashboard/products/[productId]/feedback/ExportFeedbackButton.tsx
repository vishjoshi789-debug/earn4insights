'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Loader2 } from 'lucide-react'
import { exportFeedbackToCSV } from '@/server/feedback/feedbackExportService'
import type { FeedbackSearchParams } from '@/lib/feedback/filterParams'

type Props = {
  productId: string
  productName: string
  /** Raw query params, re-parsed server-side so the export matches the list. */
  searchParams: FeedbackSearchParams
  /** Rows the current filters match — 0 disables the button. */
  filteredCount: number
}

export default function ExportFeedbackButton({
  productId,
  productName,
  searchParams,
  filteredCount,
}: Props) {
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleExport = async () => {
    setIsExporting(true)
    setError(null)
    let objectUrl: string | null = null
    try {
      const csv = await exportFeedbackToCSV(productId, searchParams)

      // BOM so Excel opens UTF-8 correctly — without it, non-English feedback
      // (a first-class case here: text is auto-translated from any language)
      // renders as mojibake on Windows.
      const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
      objectUrl = URL.createObjectURL(blob)

      const slug = productName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = `feedback-${slug || productId}-${new Date().toISOString().split('T')[0]}.csv`
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      // The action throws a deliberately generic message on auth failure.
      setError(err instanceof Error ? err.message : 'Export failed. Please try again.')
    } finally {
      // Always revoke, even on failure, or the blob leaks for the tab's life.
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      setIsExporting(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        onClick={handleExport}
        disabled={isExporting || filteredCount === 0}
        variant="outline"
        size="sm"
      >
        {isExporting ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Download className="w-4 h-4 mr-2" />
        )}
        {isExporting ? 'Exporting…' : 'Export CSV'}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
