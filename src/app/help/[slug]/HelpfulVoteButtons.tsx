'use client'

import { useState } from 'react'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { toast } from 'sonner'
import { apiPost } from '@/lib/api-client'

/**
 * Helpful / not-helpful vote buttons for a public FAQ article.
 *
 * The vote endpoint requires auth (anti-spam). Unauthenticated visitors
 * get a 401 → we show a toast suggesting they sign in. The article view
 * itself remains fully public.
 */
export function HelpfulVoteButtons({
  slug,
  initialHelpful,
  initialNotHelpful,
}: {
  slug: string
  initialHelpful: number
  initialNotHelpful: number
}) {
  const [helpful, setHelpful] = useState(initialHelpful)
  const [notHelpful, setNotHelpful] = useState(initialNotHelpful)
  const [voted, setVoted] = useState<'up' | 'down' | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const vote = async (isHelpful: boolean) => {
    if (submitting || voted) return
    setSubmitting(true)
    try {
      const res = await apiPost(`/api/support/faq/${slug}/rate`, { helpful: isHelpful })
      if (res.status === 401) {
        toast.message('Sign in to leave feedback', {
          description: 'Voting helps us improve our help articles.',
        })
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Could not record your vote')
        return
      }
      setVoted(isHelpful ? 'up' : 'down')
      if (isHelpful) setHelpful((n) => n + 1)
      else setNotHelpful((n) => n + 1)
      toast.success(isHelpful ? 'Thanks for the feedback!' : "Thanks — we'll improve this.")
    } catch (err) {
      console.error('[HelpfulVoteButtons] vote failed:', err)
      toast.error('Network error.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-xs text-muted-foreground">Was this article helpful?</span>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => vote(true)}
          disabled={submitting || !!voted}
          className={
            'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-50 ' +
            (voted === 'up'
              ? 'border-green-500/40 bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300'
              : 'border-border bg-card hover:bg-accent')
          }
          aria-label="Mark helpful"
        >
          <ThumbsUp className="h-3.5 w-3.5" />
          <span>{helpful}</span>
        </button>
        <button
          onClick={() => vote(false)}
          disabled={submitting || !!voted}
          className={
            'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-50 ' +
            (voted === 'down'
              ? 'border-red-500/40 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
              : 'border-border bg-card hover:bg-accent')
          }
          aria-label="Mark not helpful"
        >
          <ThumbsDown className="h-3.5 w-3.5" />
          <span>{notHelpful}</span>
        </button>
      </div>
    </div>
  )
}
