'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowRight, CheckCircle, AlertCircle, Columns, Eye } from 'lucide-react'

// Target fields the user can map columns to
const TARGET_FIELDS = [
  { key: 'productId', label: 'Product ID', required: true, description: 'Product identifier' },
  { key: 'feedbackText', label: 'Feedback Text', required: true, description: 'The feedback content' },
  { key: 'rating', label: 'Rating (1-5)', required: false, description: 'Star rating' },
  { key: 'userName', label: 'User Name', required: false, description: 'Who left the feedback' },
  { key: 'userEmail', label: 'User Email', required: false, description: 'User email address' },
  { key: 'category', label: 'Category', required: false, description: 'Feedback category' },
] as const

type TargetFieldKey = typeof TARGET_FIELDS[number]['key']

// Auto-detect column mapping based on header names
function autoDetectMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {}
  const lowerHeaders = headers.map(h => h.toLowerCase().trim())

  const patterns: Record<TargetFieldKey, RegExp[]> = {
    productId: [/^product.?id$/i, /^product$/i, /^prod.?id$/i, /^item.?id$/i, /^sku$/i],
    feedbackText: [/^feedback.?text$/i, /^feedback$/i, /^text$/i, /^comment$/i, /^review$/i, /^review.?text$/i, /^message$/i, /^body$/i, /^content$/i, /^description$/i, /^response$/i],
    rating: [/^rating$/i, /^stars?$/i, /^score$/i, /^star.?rating$/i, /^review.?rating$/i, /^nps$/i],
    userName: [/^user.?name$/i, /^name$/i, /^author$/i, /^reviewer$/i, /^customer$/i, /^customer.?name$/i, /^submitted.?by$/i, /^respondent$/i],
    userEmail: [/^user.?email$/i, /^email$/i, /^e.?mail$/i, /^customer.?email$/i],
    category: [/^category$/i, /^type$/i, /^feedback.?type$/i, /^topic$/i, /^tag$/i, /^label$/i],
  }

  for (const [field, regexes] of Object.entries(patterns)) {
    for (const regex of regexes) {
      const idx = lowerHeaders.findIndex(h => regex.test(h))
      if (idx !== -1 && !Object.values(mapping).includes(headers[idx])) {
        mapping[field] = headers[idx]
        break
      }
    }
  }

  return mapping
}

interface ColumnMapperProps {
  headers: string[]
  previewRows: Record<string, string>[]
  onConfirm: (mapping: Record<string, string>, defaultProductId?: string) => void
  onCancel: () => void
  products: { id: string; name: string }[]
  isUploading: boolean
}

export function ColumnMapper({ headers, previewRows, onConfirm, onCancel, products, isUploading }: ColumnMapperProps) {
  const autoMapping = useMemo(() => autoDetectMapping(headers), [headers])
  const [mapping, setMapping] = useState<Record<string, string>>(autoMapping)
  const [defaultProductId, setDefaultProductId] = useState<string>('')
  const [showPreview, setShowPreview] = useState(true)

  const updateMapping = (targetField: string, sourceColumn: string) => {
    setMapping(prev => {
      const updated = { ...prev }
      // Remove any existing mapping to this source column
      for (const key of Object.keys(updated)) {
        if (updated[key] === sourceColumn && key !== targetField) {
          delete updated[key]
        }
      }
      if (sourceColumn === '__none__') {
        delete updated[targetField]
      } else {
        updated[targetField] = sourceColumn
      }
      return updated
    })
  }

  // Determine if productId is needed by checking if there's a mapping or a default
  const hasProductId = !!mapping.productId || !!defaultProductId
  const hasFeedbackText = !!mapping.feedbackText
  const canConfirm = hasProductId && hasFeedbackText

  // Get already-mapped source columns
  const usedColumns = new Set(Object.values(mapping))

  // Preview data with the mapping applied
  const mappedPreview = previewRows.slice(0, 5).map(row => {
    const mapped: Record<string, string> = {}
    for (const [targetField, sourceCol] of Object.entries(mapping)) {
      mapped[targetField] = row[sourceCol] || ''
    }
    if (defaultProductId && !mapped.productId) {
      mapped.productId = defaultProductId
    }
    return mapped
  })

  return (
    <div className="space-y-4">
      {/* Mapping Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Columns className="h-5 w-5" />
            Map Your Columns
          </CardTitle>
          <CardDescription>
            Match your CSV columns to our fields. We auto-detected what we could.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {TARGET_FIELDS.map(field => {
            const currentMapping = mapping[field.key]
            const isAutoDetected = autoMapping[field.key] === currentMapping && !!currentMapping
            
            return (
              <div key={field.key} className="flex items-center gap-3">
                <div className="w-40 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium">{field.label}</span>
                    {field.required && <span className="text-red-500 text-xs">*</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{field.description}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <Select
                    value={currentMapping || '__none__'}
                    onValueChange={(v) => updateMapping(field.key, v)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select column..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Skip this field —</SelectItem>
                      {headers.map(h => (
                        <SelectItem 
                          key={h} 
                          value={h}
                          disabled={usedColumns.has(h) && mapping[field.key] !== h}
                        >
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {isAutoDetected && (
                  <Badge variant="secondary" className="text-xs shrink-0">Auto</Badge>
                )}
                {currentMapping && (
                  <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                )}
              </div>
            )
          })}

          {/* Default Product ID — if not mapped from CSV */}
          {!mapping.productId && (
            <div className="mt-4 p-3 rounded-lg border border-amber-500/30 bg-amber-50 dark:bg-amber-950/20">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">
                No Product ID column mapped — assign all rows to a product:
              </p>
              <Select value={defaultProductId} onValueChange={setDefaultProductId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select a product..." />
                </SelectTrigger>
                <SelectContent>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Preview */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Eye className="h-5 w-5" />
              Data Preview ({previewRows.length > 5 ? '5' : previewRows.length} sample rows)
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowPreview(!showPreview)}>
              {showPreview ? 'Hide' : 'Show'}
            </Button>
          </div>
        </CardHeader>
        {showPreview && (
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {TARGET_FIELDS.filter(f => mapping[f.key] || (f.key === 'productId' && defaultProductId)).map(f => (
                      <TableHead key={f.key} className="text-xs whitespace-nowrap">
                        {f.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappedPreview.map((row, i) => (
                    <TableRow key={i}>
                      {TARGET_FIELDS.filter(f => mapping[f.key] || (f.key === 'productId' && defaultProductId)).map(f => (
                        <TableCell key={f.key} className="text-xs max-w-[200px] truncate">
                          {row[f.key] || '—'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Validation & Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          {canConfirm ? (
            <>
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-green-700 dark:text-green-400">Ready to import</span>
            </>
          ) : (
            <>
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <span className="text-amber-700 dark:text-amber-400">
                Map required fields: {!hasFeedbackText && '"Feedback Text"'}
                {!hasProductId && !hasFeedbackText && ' and '}
                {!hasProductId && '"Product ID" (or select a default product)'}
              </span>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isUploading}>Cancel</Button>
          <Button 
            onClick={() => onConfirm(mapping, defaultProductId || undefined)} 
            disabled={!canConfirm || isUploading}
          >
            {isUploading ? 'Importing...' : 'Confirm & Import'}
          </Button>
        </div>
      </div>
    </div>
  )
}
