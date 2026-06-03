'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { signUpAction } from '@/lib/actions/auth.actions'
import { signIn } from 'next-auth/react'
import { Loader2, AlertCircle } from 'lucide-react'
import { Logo } from '@/components/logo'
import { apiPost } from '@/lib/api-client'

export default function SignupPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // 3.5B — three first-class signup roles. Admin is intentionally not
  // self-assignable (enforced by signupIntent.ts ALLOWED_SIGNUP_ROLES).
  const [role, setRole] = useState<'brand' | 'consumer' | 'influencer'>('consumer')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false)

  // Single source of truth for the post-signup landing path. Brand
  // lands on the brand dashboard; consumer browses products;
  // influencer enters the dedicated wizard at /onboarding (3.5C).
  const getRedirectUrl = (r: typeof role): string => {
    if (r === 'brand') return '/dashboard'
    if (r === 'influencer') return '/onboarding'
    return '/top-products'
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    const formData = new FormData(event.currentTarget)
    formData.set('role', role)
    formData.set('acceptedTerms', acceptedTerms.toString())
    formData.set('acceptedPrivacy', acceptedPrivacy.toString())

    const result = await signUpAction(formData)
    
    if (result?.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    // Account created — now sign in using client-side signIn
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    
    try {
      const signInResult = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (signInResult?.ok) {
        router.push(getRedirectUrl(role))
        router.refresh()
      } else {
        // Account created but sign-in failed — send to login page
        router.push('/login')
      }
    } catch {
      router.push('/login')
    }
  }

  async function handleGoogleSignup() {
    setLoading(true)
    setError('')

    // Mint the signed `e4i-signup-intent` cookie BEFORE handing off to Google.
    // The auth.config signIn callback reads + verifies it after the OAuth
    // round-trip and creates the user at this role. If we skipped this step,
    // the callback would reject a brand-new Google identity with
    // `/login?error=no_account` (intentional — see auth.config decision matrix).
    try {
      const res = await apiPost('/api/auth/signup-intent', { role })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data?.error ?? 'Could not prepare Google signup. Please try again.')
        setLoading(false)
        return
      }
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
      return
    }

    // Per-role redirect — same destinations as the email/password path.
    // Influencer lands on the existing profile registration page until
    // 3.5C ships the dedicated onboarding wizard.
    signIn('google', { callbackUrl: getRedirectUrl(role) })
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12 bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-background dark:to-violet-950/30">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3">
          <div className="flex flex-col items-center gap-1">
            <Logo size={56} />
            <span className="font-headline font-bold text-lg">Earn4Insights</span>
            <span className="text-[10px] text-muted-foreground text-center max-w-[16rem] leading-tight">
              The Intelligence Operating System for Brands, Consumers and Influencers
            </span>
          </div>
          <CardTitle className="text-2xl font-bold text-center">Create an account</CardTitle>
          <CardDescription className="text-center">
            Choose your account type and get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role Selection — 3 first-class options (3.5B) */}
            <div className="space-y-2">
              <Label>I am a...</Label>
              <RadioGroup
                value={role}
                onValueChange={(value) =>
                  setRole(value as 'brand' | 'consumer' | 'influencer')
                }
              >
                <div
                  className={`flex items-start space-x-2 rounded-lg border p-3 transition-colors ${
                    role === 'brand' ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'
                  }`}
                >
                  <RadioGroupItem value="brand" id="brand" className="mt-1" />
                  <Label htmlFor="brand" className="flex-1 cursor-pointer">
                    <div className="font-medium flex items-center gap-1.5">
                      <span>🏢</span>
                      <span>I&apos;m a Brand</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 leading-snug">
                      Get hyper-personalized feedback and intelligence on your products.
                    </div>
                  </Label>
                </div>
                <div
                  className={`flex items-start space-x-2 rounded-lg border p-3 transition-colors ${
                    role === 'consumer' ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'
                  }`}
                >
                  <RadioGroupItem value="consumer" id="consumer" className="mt-1" />
                  <Label htmlFor="consumer" className="flex-1 cursor-pointer">
                    <div className="font-medium flex items-center gap-1.5">
                      <span>🛍️</span>
                      <span>I&apos;m a Consumer</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 leading-snug">
                      Earn rewards by sharing honest feedback on products you love.
                    </div>
                  </Label>
                </div>
                <div
                  className={`flex items-start space-x-2 rounded-lg border p-3 transition-colors ${
                    role === 'influencer'
                      ? 'border-violet-500 bg-violet-500/5'
                      : 'hover:bg-muted/40'
                  }`}
                >
                  <RadioGroupItem value="influencer" id="influencer" className="mt-1" />
                  <Label htmlFor="influencer" className="flex-1 cursor-pointer">
                    <div className="font-medium flex items-center gap-1.5">
                      <span>🎯</span>
                      <span>I&apos;m an Influencer</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 leading-snug">
                      Get paid for genuine campaigns with brands that match your audience.
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="John Doe"
                required
                disabled={loading}
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                minLength={8}
                required
                disabled={loading}
              />
              <p className="text-xs text-gray-500">At least 8 characters</p>
            </div>

            {/* Consent Checkboxes */}
            <div className="space-y-3 pt-2">
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="terms"
                  checked={acceptedTerms}
                  onCheckedChange={(checked) => setAcceptedTerms(checked as boolean)}
                  disabled={loading}
                  required
                />
                <Label htmlFor="terms" className="text-sm leading-tight cursor-pointer">
                  I accept the{' '}
                  <Link href="/terms-of-service" target="_blank" className="text-blue-600 hover:underline">
                    Terms of Service
                  </Link>
                </Label>
              </div>

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="privacy"
                  checked={acceptedPrivacy}
                  onCheckedChange={(checked) => setAcceptedPrivacy(checked as boolean)}
                  disabled={loading}
                  required
                />
                <Label htmlFor="privacy" className="text-sm leading-tight cursor-pointer">
                  I accept the{' '}
                  <Link href="/privacy-policy" target="_blank" className="text-blue-600 hover:underline">
                    Privacy Policy
                  </Link>
                </Label>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !acceptedTerms || !acceptedPrivacy}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Account
            </Button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-3 text-muted-foreground">or continue with</span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignup}
            disabled={loading || !acceptedTerms || !acceptedPrivacy}
            type="button"
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Sign up with Google
          </Button>

          <p className="mt-4 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-600 hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
