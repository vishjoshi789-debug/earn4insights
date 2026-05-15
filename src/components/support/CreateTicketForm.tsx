'use client'

import { useState } from 'react'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { apiPost } from '@/lib/api-client'
import { Button } from '@/components/ui/button'

type Category =
  | 'account' | 'payment' | 'campaign' | 'feedback' | 'technical' | 'billing'
  | 'feature_request' | 'bug_report' | 'influencer' | 'deals' | 'community'
  | 'competitive_intel' | 'other'

const CATEGORY_OPTIONS: Array<{ value: Category; label: string }> = [
  { value: 'account', label: 'Account' },
  { value: 'payment', label: 'Payment' },
  { value: 'billing', label: 'Billing' },
  { value: 'campaign', label: 'Campaign' },
  { value: 'influencer', label: 'Influencer' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'deals', label: 'Deals' },
  { value: 'community', label: 'Community' },
  { value: 'competitive_intel', label: 'Competitive Intel' },
  { value: 'technical', label: 'Technical' },
  { value: 'bug_report', label: 'Bug report' },
  { value: 'feature_request', label: 'Feature request' },
  { value: 'other', label: 'Other' },
]

export function CreateTicketForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void
  onCreated: (ticket: { id: string; ticketNumber: string }) => void
}) {
  const [category, setCategory] = useState<Category>('account')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!subject.trim() || subject.trim().length > 200) {
      setError('Subject is required (max 200 characters).')
      return
    }
    if (!description.trim()) {
      setError('Description is required.')
      return
    }
    if (description.trim().length > 5000) {
      setError('Description must be under 5,000 characters.')
      return
    }

    setSubmitting(true)
    try {
      const res = await apiPost('/api/support/tickets', {
        category,
        subject: subject.trim(),
        description: description.trim(),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Could not create ticket')
        toast.error(data.error || 'Could not create ticket')
        return
      }
      const data = await res.json()
      onCreated({ id: data.ticket.id, ticketNumber: data.ticket.ticketNumber })
    } catch (err) {
      console.error('[CreateTicketForm] submit failed:', err)
      setError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border bg-card px-2 py-2.5">
        <button
          onClick={onCancel}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent transition-colors"
          aria-label="Back to tickets"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h3 className="text-sm font-semibold">New ticket</h3>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          <div className="space-y-1">
            <label htmlFor="ticket-category" className="text-xs font-medium text-muted-foreground">
              Category
            </label>
            <select
              id="ticket-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              disabled={submitting}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="ticket-subject" className="text-xs font-medium text-muted-foreground">
              Subject
            </label>
            <input
              id="ticket-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={submitting}
              maxLength={200}
              placeholder="Brief summary of the issue"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="ticket-description" className="text-xs font-medium text-muted-foreground">
              What's happening?
            </label>
            <textarea
              id="ticket-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              maxLength={5000}
              rows={8}
              placeholder="Tell us what went wrong, what you expected, and any steps we can repeat."
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <p className="text-[10px] text-muted-foreground text-right">{description.length}/5000</p>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-card px-4 py-3">
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={submitting || !subject.trim() || !description.trim()}>
            {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Create ticket
          </Button>
        </div>
      </form>
    </div>
  )
}
