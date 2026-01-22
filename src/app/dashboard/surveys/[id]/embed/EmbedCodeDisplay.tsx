'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Check, Copy } from 'lucide-react'

type EmbedCodeDisplayProps = {
  code: string
  language: 'html' | 'text'
}

export default function EmbedCodeDisplay({ code, language }: EmbedCodeDisplayProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative">
      <pre className="bg-slate-950 text-slate-50 p-4 rounded-lg overflow-x-auto text-sm">
        <code>{code}</code>
      </pre>
      <Button
        size="sm"
        variant="secondary"
        className="absolute top-2 right-2"
        onClick={handleCopy}
      >
        {copied ? (
          <>
            <Check className="w-3 h-3 mr-2" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="w-3 h-3 mr-2" />
            Copy
          </>
        )}
      </Button>
    </div>
  )
}
