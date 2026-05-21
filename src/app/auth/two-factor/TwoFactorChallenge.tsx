'use client'

import { useCallback, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { apiPost } from '@/lib/api-client'
import { OtpInput } from '@/components/two-factor/OtpInput'

/** Only allow relative, same-origin redirect targets. */
function safeCallbackUrl(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/dashboard'
  if (raw.startsWith('/login') || raw.startsWith('/auth/two-factor')) return '/dashboard'
  return raw
}

/**
 * Login 2FA challenge — shown after a correct password when the device
 * is not trusted. Accepts a TOTP code or a single-use recovery code.
 */
export function TwoFactorChallenge() {
  const searchParams = useSearchParams()
  const target = safeCallbackUrl(searchParams.get('callbackUrl'))

  const [mode, setMode] = useState<'totp' | 'recovery'>('totp')
  const [code, setCode] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [trustDevice, setTrustDevice] = useState(false)
  const [busy, setBusy] = useState(false)
  const [locked, setLocked] = useState(false)
  const [recoveryRemaining, setRecoveryRemaining] = useState<number | null>(null)

  const submitTotp = useCallback(async () => {
    if (code.length !== 6 || busy || locked) return
    setBusy(true)
    try {
      const res = await apiPost('/api/auth/2fa/verify', { code, trustDevice })
      const data = await res.json().catch(() => ({}))
      if (res.status === 429) {
        setLocked(true)
        throw new Error(data.error || 'Too many attempts.')
      }
      if (!res.ok) throw new Error(data.error || 'Invalid code')
      // Hard navigation so middleware re-evaluates with the new proof cookie.
      window.location.assign(target)
    } catch (err: any) {
      toast.error(err.message || 'Verification failed')
      setCode('')
      setBusy(false)
    }
  }, [code, busy, locked, trustDevice, target])

  async function submitRecovery() {
    const value = recoveryCode.trim()
    if (!value || busy || locked) return
    setBusy(true)
    try {
      const res = await apiPost('/api/auth/2fa/recovery', { recoveryCode: value })
      const data = await res.json().catch(() => ({}))
      if (res.status === 429) {
        setLocked(true)
        throw new Error(data.error || 'Too many attempts.')
      }
      if (!res.ok) throw new Error(data.error || 'Invalid recovery code')
      window.location.assign(target)
    } catch (err: any) {
      toast.error(err.message || 'Verification failed')
      setRecoveryCode('')
      setBusy(false)
    }
  }

  async function switchToRecovery() {
    setMode('recovery')
    try {
      const res = await fetch('/api/auth/2fa/status')
      if (res.ok) {
        const data = await res.json()
        setRecoveryRemaining(typeof data.recoveryCodesRemaining === 'number'
          ? data.recoveryCodesRemaining
          : null)
      }
    } catch {
      /* ignore — the count is informational only */
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/40">
          <ShieldCheck className="h-6 w-6 text-purple-600" />
        </div>
        <CardTitle>Two-Factor Authentication</CardTitle>
        <CardDescription>
          {locked
            ? 'Account temporarily locked'
            : mode === 'totp'
              ? 'Enter the 6-digit code from your authenticator app'
              : 'Enter one of your recovery codes'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {locked ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              Too many incorrect attempts. For your security, please wait 15 minutes
              before trying again.
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              Sign out
            </Button>
          </div>
        ) : mode === 'totp' ? (
          <>
            <div className="flex justify-center">
              <OtpInput value={code} onChange={setCode} disabled={busy} autoFocus />
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="trust-device"
                checked={trustDevice}
                onCheckedChange={(c) => setTrustDevice(c as boolean)}
                disabled={busy}
              />
              <Label htmlFor="trust-device" className="cursor-pointer text-sm leading-snug">
                Trust this device for 30 days
                <span className="block text-xs font-normal text-muted-foreground">
                  Skip 2FA on this device next time.
                </span>
              </Label>
            </div>

            <Button onClick={submitTotp} disabled={busy || code.length !== 6} className="w-full">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Verify
            </Button>

            <div className="border-t pt-4 text-center">
              <p className="text-sm text-muted-foreground">Lost your authenticator?</p>
              <button
                type="button"
                onClick={switchToRecovery}
                className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-purple-600 hover:underline"
              >
                <KeyRound className="h-3.5 w-3.5" />
                Use a recovery code instead
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="recovery-code">Recovery code</Label>
              <Input
                id="recovery-code"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitRecovery()
                }}
                placeholder="XXXX-XXXX"
                maxLength={9}
                autoComplete="one-time-code"
                disabled={busy}
                className="text-center font-mono text-lg tracking-widest"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Each code can be used only once.
                {recoveryRemaining !== null && ` ${recoveryRemaining} code${
                  recoveryRemaining === 1 ? '' : 's'
                } remaining.`}
              </p>
            </div>

            <Button
              onClick={submitRecovery}
              disabled={busy || !recoveryCode.trim()}
              className="w-full"
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Verify Recovery Code
            </Button>

            <div className="border-t pt-4 text-center">
              <button
                type="button"
                onClick={() => setMode('totp')}
                className="text-sm font-medium text-purple-600 hover:underline"
              >
                Back to authenticator code
              </button>
            </div>
          </>
        )}

        {!locked && (
          <p className="text-center text-xs text-muted-foreground">
            Not you?{' '}
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="underline hover:text-foreground"
            >
              Sign out
            </button>
          </p>
        )}
      </CardContent>
    </Card>
  )
}
