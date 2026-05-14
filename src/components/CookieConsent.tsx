'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { readConsent, writeConsent, CONSENT_VERSION } from '@/lib/cookie-consent'

export function CookieConsent() {
  const [visible, setVisible] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [analytics, setAnalytics] = useState(false)
  const [preferences, setPreferences] = useState(false)

  // Decide whether to show after mount (localStorage is client-only)
  useEffect(() => {
    const existing = readConsent()
    if (!existing || existing.version < CONSENT_VERSION) {
      setVisible(true)
    }
  }, [])

  if (!visible) return null

  const handleAcceptAll = () => {
    writeConsent({ analytics: true, preferences: true })
    setVisible(false)
  }

  const handleSavePreferences = () => {
    writeConsent({ analytics, preferences })
    setVisible(false)
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-card/95 shadow-lg backdrop-blur-sm"
    >
      <div className="mx-auto max-w-6xl px-4 py-4 md:px-6 md:py-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl text-sm text-muted-foreground">
            <p className="font-medium text-foreground">We use cookies</p>
            <p className="mt-1">
              We use cookies to provide a secure and personalized experience. By
              continuing, you accept our use of cookies. See our{' '}
              <Link href="/privacy-policy" className="underline hover:text-foreground">
                Privacy Policy
              </Link>{' '}
              for details.
            </p>
          </div>

          {!expanded && (
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
              <Button
                variant="outline"
                onClick={() => setExpanded(true)}
                className="w-full md:w-auto"
              >
                Manage preferences
              </Button>
              <Button onClick={handleAcceptAll} className="w-full md:w-auto">
                Accept all
              </Button>
            </div>
          )}
        </div>

        {expanded && (
          <div className="mt-4 space-y-3 rounded-lg border bg-background/60 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-sm font-medium">Essential cookies</Label>
                <p className="text-xs text-muted-foreground">
                  Required for authentication, security (CSRF), and core site
                  functionality. Can&apos;t be disabled.
                </p>
              </div>
              <Switch checked disabled aria-label="Essential cookies (always on)" />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="cc-analytics" className="text-sm font-medium">
                  Analytics cookies
                </Label>
                <p className="text-xs text-muted-foreground">
                  Help us understand how you use the site so we can improve it.
                </p>
              </div>
              <Switch
                id="cc-analytics"
                checked={analytics}
                onCheckedChange={setAnalytics}
                aria-label="Analytics cookies"
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="cc-preferences" className="text-sm font-medium">
                  Preference cookies
                </Label>
                <p className="text-xs text-muted-foreground">
                  Remember your settings (theme, dismissed banners, etc.) across visits.
                </p>
              </div>
              <Switch
                id="cc-preferences"
                checked={preferences}
                onCheckedChange={setPreferences}
                aria-label="Preference cookies"
              />
            </div>

            <div className="flex flex-col gap-2 pt-2 md:flex-row md:justify-end md:gap-3">
              <Button
                variant="ghost"
                onClick={() => setExpanded(false)}
                className="w-full md:w-auto"
              >
                Cancel
              </Button>
              <Button onClick={handleSavePreferences} className="w-full md:w-auto">
                Save preferences
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
