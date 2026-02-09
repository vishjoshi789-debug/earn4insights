'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sparkles, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function ExtractThemesButton({ productId }: { productId: string }) {
  const [isExtracting, setIsExtracting] = useState(false)
  const router = useRouter()

  const handleExtract = async () => {
    setIsExtracting(true)
    try {
      const res = await fetch(`/api/dashboard/products/${productId}/extract-themes`, { method: 'POST' })
      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'Failed to extract themes')
      }
    } catch {
      alert('Failed to extract themes. Please try again.')
    } finally {
      setIsExtracting(false)
    }
  }

  return (
    <Button onClick={handleExtract} disabled={isExtracting} className="gap-2">
      {isExtracting ? (
        <><Loader2 className="w-4 h-4 animate-spin" /> Extracting...</>
      ) : (
        <><Sparkles className="w-4 h-4" /> Extract Themes</>
      )}
    </Button>
  )
}
