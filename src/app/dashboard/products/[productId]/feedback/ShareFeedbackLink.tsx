'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ExternalLink, Copy, Check } from 'lucide-react'

interface Props {
  productId: string
  productName: string
}

/**
 * Shareable feedback link widget.
 * Brands copy this URL and share with consumers so they can
 * submit feedback directly for this product (no search needed).
 */
export default function ShareFeedbackLink({ productId, productName }: Props) {
  const [copied, setCopied] = useState(false)

  // Build the shareable URL (works on any domain)
  const feedbackUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/submit-feedback/${productId}`
      : `/submit-feedback/${productId}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(feedbackUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input')
      input.value = feedbackUrl
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Card className="bg-primary/5 border-primary/20">
      <CardContent className="pt-6">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium">
              Share this link with consumers to collect feedback for{' '}
              <strong>{productName}</strong>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Consumers can rate, write, record voice, and upload photos
            </p>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Input
              readOnly
              value={feedbackUrl}
              className="text-xs bg-background font-mono md:w-80"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="gap-1 flex-shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-green-600" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  Copy
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="flex-shrink-0"
            >
              <a href={feedbackUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3 h-3" />
              </a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
