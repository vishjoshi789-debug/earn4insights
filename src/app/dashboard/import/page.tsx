'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Upload, FileText, CheckCircle, AlertCircle, Download, Webhook, Copy, Check } from 'lucide-react'

type ImportResult = {
  success: boolean
  imported: number
  skipped: number
  total: number
  errors: string[]
}

export default function ImportDataPage() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [copiedV2, setCopiedV2] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/import/csv', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (res.ok) {
        setResult(data)
      } else {
        setResult({ success: false, imported: 0, skipped: 0, total: 0, errors: [data.error] })
      }
    } catch (err) {
      setResult({ success: false, imported: 0, skipped: 0, total: 0, errors: ['Upload failed'] })
    } finally {
      setUploading(false)
    }
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

  return (
    <div className="container mx-auto px-4 py-6 sm:p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <Upload className="h-7 w-7 sm:h-8 sm:w-8 text-purple-500" />
          Import External Data
        </h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
          Import feedback from external sources via CSV upload or webhook API
        </p>
      </div>

      {/* CSV Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            CSV Upload
          </CardTitle>
          <CardDescription>
            Upload a CSV file with feedback data. Required columns: productId, feedbackText.
            Optional: rating, userName, userEmail, category.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                }}
              />
              <Button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="gap-2"
              >
                {uploading ? (
                  <>Importing...</>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Import
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* CSV Template */}
          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-1">CSV Template:</p>
            <code className="block bg-muted p-3 rounded text-xs overflow-x-auto">
              productId,feedbackText,rating,userName,userEmail,category{'\n'}
              prod_123,&quot;Great product, love the UI!&quot;,5,John Doe,john@example.com,general{'\n'}
              prod_123,&quot;Needs better documentation&quot;,3,Jane Smith,jane@example.com,docs
            </code>
          </div>

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
              </div>
              <div className="text-sm space-y-1">
                <p>✅ Imported: <strong>{result.imported}</strong></p>
                <p>⏭️ Skipped: <strong>{result.skipped}</strong></p>
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
