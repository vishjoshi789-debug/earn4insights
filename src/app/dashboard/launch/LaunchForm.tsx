'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { launchProduct } from './launch.actions'

// Local datetime-local value (yyyy-MM-ddTHH:mm) one hour from now —
// used as the min attribute and as the default when the brand switches
// to "scheduled" so they can't accidentally select a past time.
function nowPlusOneHourLocal(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function LaunchForm() {
  const [launchType, setLaunchType] = useState<'instant' | 'scheduled'>('instant')
  const minScheduled = useMemo(() => nowPlusOneHourLocal(), [])
  const [scheduledAt, setScheduledAt] = useState(minScheduled)

  return (
    <form action={launchProduct} className="space-y-8">
      {/* PRODUCT BASICS */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">
          Product basics
        </h3>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-600">
            Product name *
          </label>
          <input
            name="name"
            required
            placeholder="e.g. Acme App"
            className="w-full border rounded-md px-3 py-2 bg-background text-foreground"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-600">
            Platform *
          </label>
          <select
            name="platform"
            required
            className="w-full border rounded-md px-3 py-2 bg-background text-foreground [&>option]:bg-popover [&>option]:text-popover-foreground"
          >
            <option value="">Select</option>
            <option value="web">Web</option>
            <option value="mobile">Mobile</option>
            <option value="saas">SaaS</option>
          </select>
        </div>
      </div>

      {/* PRODUCT CONTEXT */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">
          Product context
        </h3>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-600">
            Website / App URL
          </label>
          <input
            name="domain"
            placeholder="https://example.com"
            className="w-full border rounded-md px-3 py-2 bg-background text-foreground"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-600">
            Description (optional)
          </label>
          <textarea
            name="description"
            rows={3}
            placeholder="Short description"
            className="w-full border rounded-md px-3 py-2 bg-background text-foreground"
          />
        </div>
      </div>

      {/* LAUNCH TIMING */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">
          Launch timing
        </h3>

        <fieldset className="space-y-2">
          <label className="flex items-start gap-3 cursor-pointer rounded-md border border-input bg-background p-3 hover:border-primary/40">
            <input
              type="radio"
              name="launchType"
              value="instant"
              checked={launchType === 'instant'}
              onChange={() => setLaunchType('instant')}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="text-sm font-medium text-foreground">Launch now</div>
              <div className="text-xs text-muted-foreground">
                Product goes live immediately. Matching consumers are notified within minutes.
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer rounded-md border border-input bg-background p-3 hover:border-primary/40">
            <input
              type="radio"
              name="launchType"
              value="scheduled"
              checked={launchType === 'scheduled'}
              onChange={() => setLaunchType('scheduled')}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="text-sm font-medium text-foreground">Schedule for later</div>
              <div className="text-xs text-muted-foreground">
                Stays hidden until the time you pick. We publish it and notify consumers automatically.
              </div>
            </div>
          </label>
        </fieldset>

        {launchType === 'scheduled' && (
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-600">
              Launch date & time *
            </label>
            <input
              type="datetime-local"
              name="scheduledAt"
              required
              min={minScheduled}
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full border rounded-md px-3 py-2 bg-background text-foreground"
            />
            <p className="text-xs text-muted-foreground">
              Uses your device&apos;s timezone. Earliest pickup is the next cron run after this time.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <Button type="submit" className="w-full h-11 text-base">
          {launchType === 'scheduled' ? 'Schedule launch' : 'Launch product'}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          You can change settings later. Feedback starts once the product is live.
        </p>
      </div>
    </form>
  )
}
