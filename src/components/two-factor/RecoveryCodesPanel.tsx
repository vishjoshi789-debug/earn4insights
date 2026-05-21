'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Check, Copy, Download } from 'lucide-react'
import { toast } from 'sonner'

/**
 * Displays a set of recovery codes with copy-all and download-as-text
 * actions. Reused by the setup wizard (step 3) and the regenerate flow.
 */
export function RecoveryCodesPanel({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false)
  const asText = codes.join('\n')

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(asText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success('Recovery codes copied')
    } catch {
      toast.error('Could not copy — select the codes and copy manually')
    }
  }

  function download() {
    const content =
      'Earn4Insights — Two-Factor Recovery Codes\n' +
      'Keep these somewhere safe. Each code works only once.\n\n' +
      `${asText}\n`
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'earn4insights-recovery-codes.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-4">
        {codes.map((code) => (
          <code
            key={code}
            className="rounded bg-background px-3 py-2 text-center font-mono text-sm tracking-wider"
          >
            {code}
          </code>
        ))}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={copyAll}>
          {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
          {copied ? 'Copied' : 'Copy all'}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={download}>
          <Download className="mr-1.5 h-4 w-4" />
          Download .txt
        </Button>
      </div>
    </div>
  )
}
