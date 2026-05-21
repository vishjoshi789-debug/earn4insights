'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Trash2,
  Monitor,
  KeyRound,
  Lock,
} from 'lucide-react'
import { toast } from 'sonner'
import { apiPost, apiDelete } from '@/lib/api-client'
import { OtpInput } from './OtpInput'
import { RecoveryCodesPanel } from './RecoveryCodesPanel'

type Status = {
  enabled: boolean
  passwordSet: boolean
  verifiedAt: string | null
  lastUsedAt: string | null
  recoveryCodesRemaining: number
}

type TrustedDevice = {
  id: string
  deviceName: string
  lastUsedAt: string
  expiresAt: string
  isCurrent: boolean
}

type Panel = 'none' | 'devices' | 'regenerate' | 'disable'

/**
 * "Two-Factor Authentication" section for the settings page. Shows
 * enable CTA when off, or manage actions (trusted devices, regenerate
 * recovery codes, disable) when on.
 */
export function SecuritySettingsCard() {
  const { data: session } = useSession()
  const isBrand = (session?.user as any)?.role === 'brand'

  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(true)
  const [panel, setPanel] = useState<Panel>('none')

  const [devices, setDevices] = useState<TrustedDevice[]>([])
  const [devicesLoading, setDevicesLoading] = useState(false)

  const [regenCode, setRegenCode] = useState('')
  const [regenBusy, setRegenBusy] = useState(false)
  const [newCodes, setNewCodes] = useState<string[] | null>(null)

  const [disablePassword, setDisablePassword] = useState('')
  const [disableBusy, setDisableBusy] = useState(false)

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/2fa/status')
      if (res.ok) setStatus(await res.json())
    } catch {
      /* ignore — card just stays in loading-failed state */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  async function loadDevices() {
    setDevicesLoading(true)
    try {
      const res = await fetch('/api/auth/2fa/trusted-devices')
      if (res.ok) {
        const data = await res.json()
        setDevices(data.devices || [])
      }
    } catch {
      /* ignore */
    } finally {
      setDevicesLoading(false)
    }
  }

  function togglePanel(target: Exclude<Panel, 'none'>) {
    setPanel((current) => {
      const next = current === target ? 'none' : target
      if (next === 'devices') loadDevices()
      if (next !== 'regenerate') {
        setRegenCode('')
        setNewCodes(null)
      }
      if (next !== 'disable') setDisablePassword('')
      return next
    })
  }

  async function removeDevice(id: string) {
    try {
      const res = await apiDelete(`/api/auth/2fa/trusted-devices/${id}`)
      if (!res.ok) throw new Error('Failed to remove device')
      setDevices((list) => list.filter((d) => d.id !== id))
      toast.success('Device removed')
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove device')
    }
  }

  async function regenerate(code: string) {
    if (code.length !== 6 || regenBusy) return
    setRegenBusy(true)
    try {
      const res = await apiPost('/api/auth/2fa/regenerate-codes', { code })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not regenerate codes')
      setNewCodes(data.recoveryCodes || [])
      setRegenCode('')
      toast.success('New recovery codes generated')
      loadStatus()
    } catch (err: any) {
      toast.error(err.message || 'Could not regenerate codes')
      setRegenCode('')
    } finally {
      setRegenBusy(false)
    }
  }

  async function disable() {
    if (!disablePassword || disableBusy) return
    setDisableBusy(true)
    try {
      const res = await apiPost('/api/auth/2fa/disable', { password: disablePassword })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not disable 2FA')
      toast.success('Two-factor authentication disabled')
      setDisablePassword('')
      setPanel('none')
      loadStatus()
    } catch (err: any) {
      toast.error(err.message || 'Could not disable 2FA')
    } finally {
      setDisableBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-purple-600" />
          Two-Factor Authentication
        </CardTitle>
        <CardDescription>
          Require a code from your authenticator app when signing in on a new device.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !status ? (
          <p className="text-sm text-muted-foreground">
            Couldn&apos;t load 2FA status. Refresh the page to try again.
          </p>
        ) : !status.enabled ? (
          // ── Disabled state ──────────────────────────────────────
          !status.passwordSet ? (
            <div className="flex gap-3 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
              <Lock className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                Your account signs in with Google. Two-factor authentication via an
                authenticator app is managed in your Google account settings.
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">Add an extra layer of security</p>
                  {isBrand && (
                    <Badge variant="secondary" className="text-[10px]">
                      Recommended
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Two-factor authentication is currently off.
                </p>
              </div>
              <Button asChild>
                <Link href="/dashboard/settings/two-factor">Enable 2FA</Link>
              </Button>
            </div>
          )
        ) : (
          // ── Enabled state ───────────────────────────────────────
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50/60 p-3 dark:border-green-900 dark:bg-green-950/20">
              <ShieldCheck className="h-5 w-5 shrink-0 text-green-600" />
              <div className="text-sm">
                <p className="font-medium text-green-900 dark:text-green-100">
                  Two-factor authentication is active
                </p>
                <p className="text-xs text-muted-foreground">
                  {status.lastUsedAt
                    ? `Last used ${new Date(status.lastUsedAt).toLocaleDateString()}`
                    : 'Not used yet'}
                  {' · '}
                  <span
                    className={
                      status.recoveryCodesRemaining <= 3 ? 'text-amber-600 font-medium' : ''
                    }
                  >
                    {status.recoveryCodesRemaining} recovery code
                    {status.recoveryCodesRemaining === 1 ? '' : 's'} left
                  </span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => togglePanel('devices')}>
                <Monitor className="mr-1.5 h-4 w-4" />
                Trusted Devices
              </Button>
              <Button variant="outline" size="sm" onClick={() => togglePanel('regenerate')}>
                <KeyRound className="mr-1.5 h-4 w-4" />
                Regenerate Recovery Codes
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => togglePanel('disable')}
                className="text-destructive hover:bg-destructive/10"
              >
                <ShieldAlert className="mr-1.5 h-4 w-4" />
                Disable 2FA
              </Button>
            </div>

            {/* ── Trusted devices panel ── */}
            {panel === 'devices' && (
              <div className="rounded-lg border p-3">
                {devicesLoading ? (
                  <div className="flex justify-center py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : devices.length === 0 ? (
                  <p className="py-2 text-sm text-muted-foreground">
                    No trusted devices. Devices appear here when you choose &quot;trust
                    this device&quot; during a 2FA challenge.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {devices.map((d) => (
                      <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {d.deviceName}
                            {d.isCurrent && (
                              <span className="ml-2 text-xs text-green-600">(this device)</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Last used {new Date(d.lastUsedAt).toLocaleDateString()} · expires{' '}
                            {new Date(d.expiresAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDevice(d.id)}
                          className="shrink-0 text-destructive hover:bg-destructive/10"
                          aria-label={`Remove ${d.deviceName}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* ── Regenerate recovery codes panel ── */}
            {panel === 'regenerate' && (
              <div className="space-y-3 rounded-lg border p-3">
                {newCodes ? (
                  <>
                    <p className="text-sm font-medium">
                      Your previous codes no longer work. Save these new ones:
                    </p>
                    <RecoveryCodesPanel codes={newCodes} />
                    <Button size="sm" onClick={() => togglePanel('regenerate')}>
                      Done
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Enter a code from your authenticator app to generate 10 fresh
                      recovery codes. This invalidates your current codes.
                    </p>
                    <OtpInput
                      value={regenCode}
                      onChange={setRegenCode}
                      onComplete={regenerate}
                      disabled={regenBusy}
                    />
                    <Button
                      size="sm"
                      onClick={() => regenerate(regenCode)}
                      disabled={regenBusy || regenCode.length !== 6}
                    >
                      {regenBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Generate New Codes
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* ── Disable 2FA panel ── */}
            {panel === 'disable' && (
              <div className="space-y-3 rounded-lg border border-destructive/30 p-3">
                <p className="text-sm text-muted-foreground">
                  Enter your account password to turn off two-factor authentication.
                  This also removes all trusted devices.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="disable-2fa-password">Password</Label>
                  <Input
                    id="disable-2fa-password"
                    type="password"
                    autoComplete="current-password"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                  />
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={disable}
                  disabled={disableBusy || !disablePassword}
                >
                  {disableBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Disable 2FA
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
