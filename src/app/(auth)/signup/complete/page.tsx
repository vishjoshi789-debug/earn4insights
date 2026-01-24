'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Loader2, AlertCircle } from 'lucide-react'
import Link from 'next/link'

function CompleteSignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [role, setRole] = useState<'brand' | 'consumer'>('consumer')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false)

  const email = searchParams.get('email')
  const name = searchParams.get('name')
  const provider = searchParams.get('provider')

  useEffect(() => {
    if (!email || !name) {
      router.push('/signup')
    }
  }, [email, name, router])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/complete-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name,
          role,
          provider,
          acceptedTerms,
          acceptedPrivacy,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to complete signup')
      }

      // Redirect based on role
      router.push(role === 'brand' ? '/dashboard' : '/top-products')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  if (!email || !name) {
    return null
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Complete Your Profile</CardTitle>
          <CardDescription>
            Almost there! Just select your account type to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Display user info */}
            <div className="rounded-lg bg-gray-50 p-3 text-sm">
              <p className="font-medium">{name}</p>
              <p className="text-gray-600">{email}</p>
            </div>

            {/* Role Selection */}
            <div className="space-y-2">
              <Label>I am a...</Label>
              <RadioGroup value={role} onValueChange={(value) => setRole(value as 'brand' | 'consumer')}>
                <div className="flex items-center space-x-2 rounded-lg border p-3">
                  <RadioGroupItem value="brand" id="brand" />
                  <Label htmlFor="brand" className="flex-1 cursor-pointer">
                    <div className="font-medium">Brand</div>
                    <div className="text-sm text-gray-500">Manage products & surveys</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 rounded-lg border p-3">
                  <RadioGroupItem value="consumer" id="consumer" />
                  <Label htmlFor="consumer" className="flex-1 cursor-pointer">
                    <div className="font-medium">Consumer</div>
                    <div className="text-sm text-gray-500">Respond to surveys & earn rewards</div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Terms and Privacy */}
            <div className="space-y-3">
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
              Complete Signup
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
export default function CompleteSignupPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    }>
      <CompleteSignupForm />
    </Suspense>
  )
}