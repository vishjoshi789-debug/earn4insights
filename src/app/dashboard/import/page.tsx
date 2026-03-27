'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Upload, FileText, CheckCircle, AlertCircle, Webhook, Copy, Check, History, Clock, ArrowLeft, Download } from 'lucide-react'
import { ColumnMapper } from './column-mapper'

type ImportResult = {
  success: boolean
  jobId?: string
  imported: number
  skipped: number
  duplicates?: number
  total: number
  errors: string[]
  surveyFormat?: string | null
}

type PreviewData = {
  headers: string[]
  previewRows: Record<string, string>[]
  totalRows: number
  surveyFormat?: { type: string; questionColumns: string[] } | null
}

type ImportJob = {
  id: string
  source: string
  fileName: string | null
  status: string
  totalRows: number
  importedRows: number
  skippedRows: number
  duplicateRows: number
  errors: string[] | null
  createdAt: string
  completedAt: string | null
}

type Product = { id: string; name: string }

export default function ImportDataPage() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [copied, setCopied] = useState(false)
  const [copiedV2, setCopiedV2] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [importHistory, setImportHistory] = useState<ImportJob[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Fetch products and import history on mount
  useEffect(() => {
    fetch('/api/import/products').then(r => r.json()).then(d => setProducts(d.products || []))
    fetchHistory()
  }, [])

  const fetchHistory = useCallback(() => {
    fetch('/api/import/jobs').then(r => r.json()).then(d => setImportHistory(d.jobs || []))
  }, [])

  // Step 1: Upload file for preview (column detection)
  const handlePreview = async () => {
    if (!file) return
    setPreviewing(true)
    setResult(null)
    setPreview(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('action', 'preview')

      const res = await fetch('/api/import/csv', { method: 'POST', body: formData })
      const data = await res.json()

      if (res.ok) {
        setPreview(data)
      } else {
        setResult({ success: false, imported: 0, skipped: 0, total: 0, errors: [data.error] })
      }
    } catch {
      setResult({ success: false, imported: 0, skipped: 0, total: 0, errors: ['Preview failed'] })
    } finally {
      setPreviewing(false)
    }
  }

  // Step 2: Confirm mapping and import
  const handleConfirmImport = async (mapping: Record<string, string>, defaultProductId?: string) => {
    if (!file) return
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('action', 'import')
      formData.append('columnMapping', JSON.stringify(mapping))
      if (defaultProductId) {
        formData.append('defaultProductId', defaultProductId)
      }

      const res = await fetch('/api/import/csv', { method: 'POST', body: formData })
      const data = await res.json()

      if (res.ok) {
        setResult(data)
        setPreview(null)
        fetchHistory()
      } else {
        setResult({ success: false, imported: 0, skipped: 0, total: 0, errors: [data.error] })
      }
    } catch {
      setResult({ success: false, imported: 0, skipped: 0, total: 0, errors: ['Import failed'] })
    } finally {
      setUploading(false)
    }
  }

  const cancelMapping = () => {
    setPreview(null)
    setFile(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const webhookExample = `{
  "apiKey": "your_webhook_api_key",
  "source": "zendesk",
  "entries": [
    {
      "productId": "product_123",
      "text": "Great product, very intuitive!",
      "rating": 5,
      "author": "John Doe",
      "email": "john@example.com",
      "category": "support"
    }
  ]
}`

  const webhookV2Example = `{
  "source": "google_reviews",
  "entries": [
    {
      "productId": "prod_mobile_app",
      "text": "Checkout flow is confusing, took 3 tries to pay.",
      "rating": 2,
      "author": "Jane D.",
      "externalId": "google_review_8821",
      "sourceUrl": "https://g.co/review/8821",
      "createdAt": "2026-03-05T14:30:00Z",
      "category": "review",
      "metadata": {
        "platform": "google_business",
        "listing": "Main St Store"
      }
    },
    {
      "productId": "prod_mobile_app",
      "text": "Love the new dark mode update!",
      "rating": 5,
      "author": "Mike R.",
      "externalId": "reddit_post_t3_abc",
      "sourceUrl": "https://reddit.com/r/product/comments/abc",
      "engagement": {
        "upvotes": 142,
        "downvotes": 3,
        "comments": 28
      }
    }
  ]
}`

  const webhookV2MediaExample = `{
  "source": "youtube",
  "entries": [
    {
      "productId": "prod_smart_speaker",
      "text": "The mic quality is poor — see my test video",
      "rating": 2,
      "author": "TechReviewer",
      "externalId": "yt_comment_xyz",
      "sourceUrl": "https://youtube.com/watch?v=xyz",
      "media": [
        {
          "type": "video",
          "url": "https://cdn.example.com/review-clip.mp4",
          "mimeType": "video/mp4",
          "durationMs": 45000
        }
      ],
      "engagement": {
        "likes": 320,
        "comments": 41
      }
    }
  ]
}`

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookExample)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const copyWebhookV2 = () => {
    navigator.clipboard.writeText(webhookV2Example)
    setCopiedV2(true)
    setTimeout(() => setCopiedV2(false), 2000)
  }

  const downloadTemplate = () => {
    const csv = 'productId,feedbackText,rating,userName,userEmail,category\nprod_123,"Great product, love the UI!",5,John Doe,john@example.com,general\nprod_123,"Needs better documentation",3,Jane Smith,jane@example.com,docs'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'feedback-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Upload className="h-7 w-7 sm:h-8 sm:w-8 text-purple-500" />
            Import External Data
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Import feedback from external sources via CSV upload or webhook API
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => { setShowHistory(!showHistory); if (!showHistory) fetchHistory() }}
          className="gap-2"
        >
          <History className="h-4 w-4" />
          {showHistory ? 'Hide History' : 'Import History'}
          {importHistory.length > 0 && (
            <Badge variant="secondary" className="ml-1">{importHistory.length}</Badge>
          )}
        </Button>
      </div>

      {/* Import History */}
      {showHistory && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Imports
            </CardTitle>
          </CardHeader>
          <CardContent>
            {importHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No imports yet.</p>
            ) : (
              <div className="space-y-2">
                {importHistory.map(job => (
                  <div key={job.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                    <div className="flex items-center gap-3">
                      <Badge variant={
                        job.status === 'completed' ? 'default' :
                        job.status === 'failed' ? 'destructive' :
                        job.status === 'partial' ? 'secondary' : 'outline'
                      }>
                        {job.status}
                      </Badge>
                      <div>
                        <p className="font-medium">{job.fileName || job.source}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(job.createdAt).toLocaleDateString()} {new Date(job.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>✅ {job.importedRows}</span>
                      <span>⏭️ {job.skippedRows}</span>
                      {job.duplicateRows > 0 && <span>🔄 {job.duplicateRows} dupes</span>}
                      <span>📊 {job.totalRows} total</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* CSV Upload with Column Mapping */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            CSV Upload
          </CardTitle>
          <CardDescription>
            Upload any CSV — map your columns to our fields, preview data, then import.
            Supports Typeform, Google Forms, SurveyMonkey exports, and custom CSVs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File selection */}
          {!preview && (
            <>
              <div className="space-y-2">
                <Label htmlFor="csv-file">CSV File (max 500 rows, 5MB)</Label>
                <div className="flex gap-2">
                  <Input
                    ref={fileRef}
                    id="csv-file"
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      setFile(e.target.files?.[0] || null)
                      setResult(null)
                      setPreview(null)
                    }}
                  />
                  <Button
                    onClick={handlePreview}
                    disabled={!file || previewing}
                    className="gap-2"
                  >
                    {previewing ? (
                      <>Analyzing...</>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Upload & Map
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1 text-xs">
                  <Download className="h-3 w-3" />
                  Download Template
                </Button>
              </div>

              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-1">Supported formats:</p>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="secondary">Custom CSV</Badge>
                  <Badge variant="secondary">Google Forms</Badge>
                  <Badge variant="secondary">Typeform</Badge>
                  <Badge variant="secondary">SurveyMonkey</Badge>
                  <Badge variant="secondary">Any CSV with headers</Badge>
                </div>
              </div>
            </>
          )}

          {/* Column Mapping Step */}
          {preview && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={cancelMapping}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <span className="text-sm text-muted-foreground">
                  {preview.totalRows} rows detected in <strong>{file?.name}</strong>
                </span>
                {preview.surveyFormat && (
                  <Badge className="bg-purple-600 text-white text-xs">
                    {preview.surveyFormat.type.replace('_', ' ')} detected
                  </Badge>
                )}
              </div>
              <ColumnMapper
                headers={preview.headers}
                previewRows={preview.previewRows}
                onConfirm={handleConfirmImport}
                onCancel={cancelMapping}
                products={products}
                isUploading={uploading}
              />
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`rounded-lg border p-4 ${result.imported > 0 ? 'border-green-500/50 bg-green-50 dark:bg-green-950/20' : 'border-red-500/50 bg-red-50 dark:bg-red-950/20'}`}>
              <div className="flex items-center gap-2 mb-2">
                {result.imported > 0 ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                )}
                <span className="font-medium">
                  {result.imported > 0 ? 'Import Complete' : 'Import Failed'}
                </span>
                {result.surveyFormat && (
                  <Badge variant="secondary" className="text-xs">Survey: {result.surveyFormat}</Badge>
                )}
              </div>
              <div className="text-sm space-y-1">
                <p>✅ Imported: <strong>{result.imported}</strong></p>
                <p>⏭️ Skipped: <strong>{result.skipped}</strong></p>
                {(result.duplicates ?? 0) > 0 && (
                  <p>🔄 Duplicates: <strong>{result.duplicates}</strong></p>
                )}
                <p>📊 Total rows: <strong>{result.total}</strong></p>
                {result.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="font-medium text-red-600">Errors:</p>
                    {result.errors.map((err, i) => (
                      <p key={i} className="text-xs text-red-600">{err}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Webhook API */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Webhook API
          </CardTitle>
          <CardDescription>
            Send feedback data programmatically from external services (Zendesk, Intercom, Trustpilot, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Endpoint</Label>
            <code className="block bg-muted p-3 rounded text-sm">
              POST /api/import/webhook
            </code>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Example Payload</Label>
              <Button variant="ghost" size="sm" onClick={copyWebhook} className="gap-1 text-xs">
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <pre className="bg-muted p-3 rounded text-xs overflow-x-auto whitespace-pre">
              {webhookExample}
            </pre>
          </div>

          <div className="text-sm text-muted-foreground space-y-1">
            <p className="font-medium">Authentication:</p>
            <p>Include API key via <code className="bg-muted px-1 rounded">X-API-Key</code> header or <code className="bg-muted px-1 rounded">apiKey</code> in body.</p>
            <p>Set <code className="bg-muted px-1 rounded">IMPORT_WEBHOOK_API_KEY</code> environment variable on your deployment.</p>
          </div>

          <div className="text-sm text-muted-foreground space-y-1">
            <p className="font-medium">Supported Sources:</p>
            <div className="flex gap-2 flex-wrap mt-1">
              <Badge variant="secondary">Zendesk</Badge>
              <Badge variant="secondary">Intercom</Badge>
              <Badge variant="secondary">Trustpilot</Badge>
              <Badge variant="secondary">G2</Badge>
              <Badge variant="secondary">App Store</Badge>
              <Badge variant="secondary">Play Store</Badge>
              <Badge variant="secondary">Custom</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhook API v2 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Webhook API v2
            <Badge className="bg-purple-600 text-white text-[10px] px-1.5 py-0.5">NEW</Badge>
          </CardTitle>
          <CardDescription>
            Unified import for reviews, social media, support tickets & multimodal feedback — with deduplication, engagement metrics, and media attachments.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Endpoint</Label>
            <code className="block bg-muted p-3 rounded text-sm">
              POST /api/import/webhook/v2
            </code>
          </div>

          {/* Source taxonomy */}
          <div className="text-sm text-muted-foreground space-y-2">
            <p className="font-medium">Source Taxonomy:</p>

            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Support & Helpdesk</p>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="secondary">zendesk</Badge>
                <Badge variant="secondary">intercom</Badge>
                <Badge variant="secondary">freshdesk</Badge>
                <Badge variant="secondary">hubspot</Badge>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Review Platforms</p>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="secondary">google_reviews</Badge>
                <Badge variant="secondary">trustpilot</Badge>
                <Badge variant="secondary">g2</Badge>
                <Badge variant="secondary">capterra</Badge>
                <Badge variant="secondary">app_store</Badge>
                <Badge variant="secondary">play_store</Badge>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Social Platforms</p>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="secondary">reddit</Badge>
                <Badge variant="secondary">youtube</Badge>
                <Badge variant="secondary">twitter</Badge>
                <Badge variant="secondary">linkedin</Badge>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Other</p>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="secondary">custom</Badge>
              </div>
            </div>
          </div>

          {/* v2 example payload */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Example Payload (Review + Social)</Label>
              <Button variant="ghost" size="sm" onClick={copyWebhookV2} className="gap-1 text-xs">
                {copiedV2 ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copiedV2 ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <pre className="bg-muted p-3 rounded text-xs overflow-x-auto whitespace-pre max-h-[300px] overflow-y-auto">
              {webhookV2Example}
            </pre>
          </div>

          {/* Media example */}
          <div className="space-y-2">
            <Label>Example Payload (with Media Attachment)</Label>
            <pre className="bg-muted p-3 rounded text-xs overflow-x-auto whitespace-pre max-h-[240px] overflow-y-auto">
              {webhookV2MediaExample}
            </pre>
          </div>

          {/* v2 features */}
          <div className="text-sm text-muted-foreground space-y-1">
            <p className="font-medium">New in v2:</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs">
              <li><strong>externalId</strong> — deduplication within batch</li>
              <li><strong>sourceUrl</strong> — link back to original review/ticket/post</li>
              <li><strong>createdAt</strong> — preserve original timestamp from source</li>
              <li><strong>engagement</strong> — upvotes, likes, shares, comments for social posts</li>
              <li><strong>media[]</strong> — attach audio, video, or image URLs (auto-queued for transcription)</li>
              <li><strong>metadata</strong> — arbitrary key/value for source-specific fields</li>
              <li>Social sources (reddit, youtube, twitter, linkedin) also insert into <code className="bg-muted px-1 rounded">social_posts</code> table</li>
              <li>Batch limit raised to <strong>200 entries</strong> per call</li>
            </ul>
          </div>

          <div className="text-sm text-muted-foreground space-y-1">
            <p className="font-medium">Authentication:</p>
            <p>Same as v1 — include API key via <code className="bg-muted px-1 rounded">X-API-Key</code> header.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
