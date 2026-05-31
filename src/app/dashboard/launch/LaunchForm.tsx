'use client'

import { useMemo, useState, useEffect } from 'react'
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

// Best-effort IANA timezone detection. Modern browsers in Node 18+
// always return a real zone (e.g. "Asia/Kolkata"). The empty-string
// fallback triggers the server's UTC fallback path with a logged
// warning (see launch.actions.ts).
function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''
  } catch {
    return ''
  }
}

export default function LaunchForm() {
  const [launchType, setLaunchType] = useState<'instant' | 'scheduled'>('instant')
  const minScheduled = useMemo(() => nowPlusOneHourLocal(), [])
  const [scheduledAt, setScheduledAt] = useState(minScheduled)
  // Captured on mount, sent as a hidden form field. We avoid useMemo
  // for this so SSR renders an empty string (matches client first paint
  // for hydration), then the effect populates it after mount.
  const [tz, setTz] = useState('')
  useEffect(() => { setTz(detectTimezone()) }, [])

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
            {/* Captured-once-on-mount IANA timezone. Server uses this to
                interpret the naive datetime-local string in the brand's
                wall-clock and convert correctly to UTC. Empty value falls
                back server-side to UTC interpretation (logged warning).
                Audit ref: A5 / Pass 2 C2. */}
            <input type="hidden" name="scheduledAtTz" value={tz} />
            <p className="text-xs text-muted-foreground">
              {tz
                ? <>Interpreted in <span className="font-semibold text-foreground">{tz}</span> (your device timezone). Cron pickup runs every 15 minutes after the chosen time.</>
                : <>Timezone detection unavailable — time will be interpreted as UTC. Cron pickup runs every 15 minutes after the chosen time.</>
              }
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
