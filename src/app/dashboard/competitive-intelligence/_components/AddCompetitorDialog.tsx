'use client'

import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const CATEGORIES = [
  'Electronics', 'Fashion', 'Food & Beverage', 'Health & Beauty',
  'Home & Living', 'Travel', 'Entertainment', 'Education',
  'Finance', 'Sports', 'Automotive', 'Other',
]

export function AddCompetitorDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [website, setWebsite] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function reset() {
    setName('')
    setCategory('')
    setWebsite('')
    setNotes('')
  }

  async function handleSubmit() {
    if (!name.trim() || !category) {
      toast.error('Name and category are required.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/brand/competitive-intelligence/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          competitorName: name.trim(),
          category,
          competitorType: 'off_platform',
          competitorWebsite: website.trim() || null,
          notes: notes.trim() || null,
        }),
      })
      if (res.status === 409) {
        toast.error('You already track a competitor with this name.')
        return
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to add competitor')
      }
      toast.success('Competitor added')
      reset()
      onOpenChange(false)
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add competitor')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) onOpenChange(v) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add competitor</DialogTitle>
          <DialogDescription>
            Track a brand you compete with. Only the brand name and category you enter are stored —
            no consumer data is ever attributed to a specific competitor.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ci-name">Competitor name *</Label>
            <Input
              id="ci-name"
              value={name}
              maxLength={200}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Corp"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ci-category">Category *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="ci-category">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ci-website">Website</Label>
            <Input
              id="ci-website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ci-notes">Notes</Label>
            <Textarea
              id="ci-notes"
              value={notes}
              maxLength={500}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why are you tracking this competitor?"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add competitor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
