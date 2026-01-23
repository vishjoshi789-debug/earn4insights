'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Mail, Send, CheckCircle, XCircle } from 'lucide-react'

export default function TestEmailPage() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const sendTestEmail = async () => {
    if (!email) {
      alert('Please enter an email address')
      return
    }

    setSending(true)
    setResult(null)

    try {
      const response = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      })

      const data = await response.json()

      if (response.ok) {
        setResult({ success: true, message: data.message })
      } else {
        setResult({ success: false, message: data.error || 'Failed to send email' })
      }
    } catch (error) {
      setResult({ success: false, message: 'Network error occurred' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Mail className="h-8 w-8 text-blue-500" />
          Test Email Notifications
        </h1>
        <p className="text-muted-foreground mt-1">
          Send a test ranking notification email to verify your setup
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Send Test Email</CardTitle>
          <CardDescription>
            This will send a sample ranking notification to test your email configuration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name (Optional)</Label>
            <Input
              id="name"
              type="text"
              placeholder="Your Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <Button 
            onClick={sendTestEmail} 
            disabled={sending || !email}
            className="w-full gap-2"
          >
            <Send className={`h-4 w-4 ${sending ? 'animate-pulse' : ''}`} />
            {sending ? 'Sending...' : 'Send Test Email'}
          </Button>

          {result && (
            <div className={`p-4 rounded-lg border ${
              result.success 
                ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' 
                : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
            }`}>
              <div className="flex items-center gap-2">
                {result.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                )}
                <p className={result.success ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'}>
                  {result.message}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="font-semibold mb-1">1. Get Resend API Key</p>
            <p className="text-muted-foreground">
              Sign up at <a href="https://resend.com" target="_blank" rel="noopener" className="text-blue-600 underline">resend.com</a> and get your API key
            </p>
          </div>

          <div>
            <p className="font-semibold mb-1">2. Add to Environment Variables</p>
            <code className="block bg-muted p-2 rounded mt-1">
              RESEND_API_KEY=re_xxxxxxxxxxxxx<br />
              EMAIL_FROM=rankings@yourdomain.com
            </code>
          </div>

          <div>
            <p className="font-semibold mb-1">3. Test the Email</p>
            <p className="text-muted-foreground">
              Enter your email above and click "Send Test Email"
            </p>
          </div>

          <div>
            <p className="font-semibold mb-1">4. Check Your Inbox</p>
            <p className="text-muted-foreground">
              You should receive a beautiful ranking notification email!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
