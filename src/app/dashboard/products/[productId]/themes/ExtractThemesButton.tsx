'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sparkles, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function ExtractThemesButton({ productId }: { productId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleExtract() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/dashboard/products/${productId}/extract-themes`, {
        method: 'POST',
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Extraction failed')
      }

      // Refresh the page to show new themes
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        onClick={handleExtract}
        disabled={loading}
        className="bg-purple-600 hover:bg-purple-700 text-white"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Extracting…
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 mr-2" />
            Extract Themes
          </>
        )}
      </Button>
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </div>
  )
}
