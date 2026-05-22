'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Check, Copy, Loader2, ShieldCheck, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { apiPost } from '@/lib/api-client'
import { OtpInput } from './OtpInput'
import { RecoveryCodesPanel } from './RecoveryCodesPanel'

type Step = 'intro' | 'qr' | 'codes'

/**
 * Three-step 2FA setup flow: introduction → scan QR + verify code →
 * save recovery codes. Lives at /dashboard/settings/two-factor.
 */
export function TwoFactorSetupWizard() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('intro')

  const [starting, setStarting] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [secretCopied, setSecretCopied] = useState(false)

  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)

  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [savedConfirmed, setSavedConfirmed] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  async function startSetup() {
    setStarting(true)
    try {
      const res = await apiPost('/api/auth/2fa/setup')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not start setup')
      setQrDataUrl(data.qrCodeDataUrl)
      setSecret(data.secret)
      setStep('qr')
    } catch (err: any) {
      toast.error(err.message || 'Could not start setup')
    } finally {
      setStarting(false)
    }
  }

  async function verifyAndEnable(submittedCode: string) {
    if (submittedCode.length !== 6 || verifying) return
    setVerifying(true)
    try {
      const res = await apiPost('/api/auth/2fa/verify-setup', { code: submittedCode })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Verification failed')
      setRecoveryCodes(data.recoveryCodes || [])
      setStep('codes')
      toast.success('Two-factor authentication enabled')
    } catch (err: any) {
      toast.error(err.message || 'Verification failed')
      setCode('')
    } finally {
      setVerifying(false)
    }
  }

  /**
   * Finish setup. The current session's JWT was minted before 2FA was
   * enabled, so it carries no `twoFactorPending` flag — the 2FA challenge
   * would never fire for it. Sign the user out and send them to /login so
   * the next login mints a fresh JWT that the middleware interlock can
   * gate. Same pattern GitHub uses after enabling 2FA.
   */
  async function finishSetup() {
    setSigningOut(true)
    toast.success('2FA is now active! Please sign in again to verify it works.')
    await signOut({ callbackUrl: '/login' })
  }

  async function copySecret() {
    try {
      await navigator.clipboard.writeText(secret)
      setSecretCopied(true)
      setTimeout(() => setSecretCopied(false), 2000)
    } catch {
      toast.error('Could not copy — select the code and copy manually')
    }
  }

  // ── Step 1: introduction ─────────────────────────────────────────
  if (step === 'intro') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-purple-600" />
            Set up two-factor authentication
          </CardTitle>
          <CardDescription>
            Secure your account with two-factor authentication. You&apos;ll need an
            authenticator app such as Google Authenticator, Authy, 1Password, or
            Microsoft Authenticator.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex gap-3 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
            <Smartphone className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              After setup, you&apos;ll enter a 6-digit code from your authenticator app
              when signing in on a new device.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => router.push('/dashboard/settings')}>
              Cancel
            </Button>
            <Button onClick={startSetup} disabled={starting} className="flex-1">
              {starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Set Up 2FA
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ── Step 2: scan QR + verify ─────────────────────────────────────
  if (step === 'qr') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Scan the QR code</CardTitle>
          <CardDescription>
            Scan this QR code with your authenticator app, then enter the 6-digit code
            it shows.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex justify-center">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt="Two-factor authentication QR code"
                className="rounded-lg border bg-white p-2"
                width={240}
                height={240}
              />
            ) : null}
          </div>

          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">
              Can&apos;t scan? Enter this code manually:
            </p>
            <div className="flex gap-2">
              <code className="flex-1 break-all rounded-md border bg-muted/40 px-3 py-2 font-mono text-sm tracking-wider">
                {secret}
              </code>
              <Button type="button" variant="outline" size="sm" onClick={copySecret}>
                {secretCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Enter the 6-digit code from your app</Label>
            <OtpInput
              value={code}
              onChange={setCode}
              onComplete={verifyAndEnable}
              disabled={verifying}
              autoFocus
            />
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('intro')} disabled={verifying}>
              Back
            </Button>
            <Button
              onClick={() => verifyAndEnable(code)}
              disabled={verifying || code.length !== 6}
              className="flex-1"
            >
              {verifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Verify and Enable
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ── Step 3: recovery codes ───────────────────────────────────────
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-green-600" />
          Save your recovery codes
        </CardTitle>
        <CardDescription>
          Save these recovery codes somewhere safe. Each code can be used only once. If
          you lose your authenticator, these are your only way back into your account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <RecoveryCodesPanel codes={recoveryCodes} />

        <div className="flex items-start gap-3">
          <Checkbox
            id="codes-saved"
            checked={savedConfirmed}
            onCheckedChange={(c) => setSavedConfirmed(c as boolean)}
          />
          <Label htmlFor="codes-saved" className="cursor-pointer text-sm leading-relaxed">
            I have saved these recovery codes in a safe place.
          </Label>
        </div>

        <Button
          onClick={finishSetup}
          disabled={!savedConfirmed || signingOut}
          className="w-full"
        >
          {signingOut ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Done
        </Button>
      </CardContent>
    </Card>
  )
}
