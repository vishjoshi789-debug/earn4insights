'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MessageCircle, Send, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function TestWhatsAppPage() {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [name, setName] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const sendTestWhatsApp = async () => {
    if (!phoneNumber) {
      alert('Please enter a phone number')
      return
    }

    if (!phoneNumber.startsWith('+')) {
      alert('Phone number must start with + and country code (e.g., +911234567890)')
      return
    }

    setSending(true)
    setResult(null)

    try {
      const response = await fetch('/api/admin/test-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, name }),
      })

      const data = await response.json()

      if (response.ok) {
        setResult({ success: true, message: data.message })
      } else {
        // Handle error - could be string or object
        let errorMessage = 'Failed to send WhatsApp'
        
        if (typeof data.error === 'string') {
          errorMessage = data.error
        } else if (data.error?.message) {
          errorMessage = data.error.message
        } else if (data.error) {
          // If error is an object, stringify it
          errorMessage = JSON.stringify(data.error)
        } else if (data.message) {
          errorMessage = data.message
        } else if (data.details) {
          errorMessage = data.details
        }
        
        setResult({ success: false, message: errorMessage })
      }
    } catch (error) {
      setResult({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Network error occurred' 
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MessageCircle className="h-8 w-8 text-green-500" />
          Test WhatsApp Notifications
        </h1>
        <p className="text-muted-foreground mt-1">
          Send a test ranking notification via WhatsApp to verify your setup
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Send Test WhatsApp Message</CardTitle>
          <CardDescription>
            This will send a sample ranking notification to your WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phoneNumber">WhatsApp Number</Label>
            <Input
              id="phoneNumber"
              type="tel"
              placeholder="+911234567890"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Must include country code (e.g., +91 for India, +1 for USA)
            </p>
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
            onClick={sendTestWhatsApp} 
            disabled={sending || !phoneNumber}
            className="w-full gap-2"
          >
            <Send className={`h-4 w-4 ${sending ? 'animate-pulse' : ''}`} />
            {sending ? 'Sending...' : 'Send Test WhatsApp'}
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
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Twilio WhatsApp requires approval and a Twilio account. Free trial available but has limitations.
            </AlertDescription>
          </Alert>

          <div className="space-y-3 text-sm">
            <div>
              <p className="font-semibold mb-1">1. Create Twilio Account</p>
              <p className="text-muted-foreground">
                Go to <a href="https://www.twilio.com/try-twilio" target="_blank" rel="noopener" className="text-blue-600 underline">twilio.com/try-twilio</a> and sign up
              </p>
            </div>

            <div>
              <p className="font-semibold mb-1">2. Get WhatsApp Sandbox Number</p>
              <p className="text-muted-foreground">
                In Twilio Console, go to Messaging → Try it out → Send a WhatsApp message
              </p>
              <p className="text-muted-foreground mt-1">
                You'll get a sandbox number like: <code>+14155238886</code>
              </p>
            </div>

            <div>
              <p className="font-semibold mb-1">3. Join Sandbox (Important!)</p>
              <p className="text-muted-foreground">
                From your WhatsApp, send the join code to the sandbox number. Example:
              </p>
              <code className="block bg-muted p-2 rounded mt-1">
                Send "join &lt;your-code&gt;" to +14155238886
              </code>
            </div>

            <div>
              <p className="font-semibold mb-1">4. Get API Credentials</p>
              <p className="text-muted-foreground">
                In Twilio Console, find:
              </p>
              <ul className="list-disc list-inside mt-1 text-muted-foreground">
                <li>Account SID</li>
                <li>Auth Token</li>
              </ul>
            </div>

            <div>
              <p className="font-semibold mb-1">5. Add to .env.local</p>
              <code className="block bg-muted p-2 rounded mt-1 text-xs">
                TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx<br />
                TWILIO_AUTH_TOKEN=your_auth_token<br />
                TWILIO_WHATSAPP_FROM=+14155238886
              </code>
            </div>

            <div>
              <p className="font-semibold mb-1">6. Test</p>
              <p className="text-muted-foreground">
                Enter your WhatsApp number above (with country code) and send test message
              </p>
            </div>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Note:</strong> Twilio sandbox is for testing only. For production, you need WhatsApp Business API approval (takes time and requires business verification).
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}
