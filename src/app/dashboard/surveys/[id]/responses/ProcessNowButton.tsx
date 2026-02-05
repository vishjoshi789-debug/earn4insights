'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function ProcessNowButton(props: { enabled: boolean }) {
  const router = useRouter()
  const [running, setRunning] = useState(false)

  if (!props.enabled) return null

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={running}
      onClick={async () => {
        try {
          setRunning(true)
          const res = await fetch('/api/dashboard/feedback-media/process-now', { method: 'POST' })
          if (!res.ok) {
            const payload = await res.json().catch(() => ({}))
            throw new Error(payload?.error || 'Failed to trigger processing')
          }
          router.refresh()
        } catch (e) {
          console.error(e)
          alert(e instanceof Error ? e.message : 'Failed to trigger processing')
        } finally {
          setRunning(false)
        }
      }}
    >
      {running ? 'Processing…' : 'Process now'}
    </Button>
  )
}

