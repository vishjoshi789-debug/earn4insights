'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Shield, Info } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'

interface ConsentRenewalModalProps {
  userId: string
  currentConsent: any
  consentGrantedAt: string | null
  onRenewed: () => void
}

export function ConsentRenewalModal({
  userId,
  currentConsent,
  consentGrantedAt,
  onRenewed
}: ConsentRenewalModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [consents, setConsents] = useState({
    tracking: currentConsent?.tracking || false,
    personalization: currentConsent?.personalization || false,
    analytics: currentConsent?.analytics || false,
    marketing: currentConsent?.marketing || false
  })
  const [isRenewing, setIsRenewing] = useState(false)

  useEffect(() => {
    // Check if consent needs renewal (>12 months old)
    if (!consentGrantedAt) {
      // No consent date means this is a legacy user, show renewal
      setIsOpen(true)
      return
    }

    const consentDate = new Date(consentGrantedAt)
    const monthsSinceConsent = (Date.now() - consentDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
    
    if (monthsSinceConsent > 12) {
      console.log('[ConsentRenewal] Consent is', Math.floor(monthsSinceConsent), 'months old - renewal required')
      setIsOpen(true)
    }
  }, [consentGrantedAt])

  const handleRenewConsent = async () => {
    setIsRenewing(true)
    try {
      const response = await fetch('/api/user/renew-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consents })
      })

      if (!response.ok) {
        throw new Error('Failed to renew consent')
      }

      toast.success('Privacy preferences updated')
      setIsOpen(false)
      onRenewed()
    } catch (error) {
      console.error('Consent renewal error:', error)
      toast.error('Failed to update preferences. Please try again.')
    } finally {
      setIsRenewing(false)
    }
  }

  const handleDeclineAll = async () => {
    setIsRenewing(true)
    const declinedConsents = {
      tracking: false,
      personalization: false,
      analytics: false,
      marketing: false
    }
    
    try {
      const response = await fetch('/api/user/renew-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consents: declinedConsents })
      })

      if (!response.ok) {
        throw new Error('Failed to update consent')
      }

      toast.success('Privacy preferences updated - all tracking disabled')
      setIsOpen(false)
      onRenewed()
    } catch (error) {
      console.error('Consent decline error:', error)
      toast.error('Failed to update preferences. Please try again.')
    } finally {
      setIsRenewing(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      // Don't allow closing without making a choice
      if (!open) {
        toast.error('Please review and update your privacy preferences')
      }
    }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Shield className="h-6 w-6 text-blue-600" />
            Time to Review Your Privacy Settings
          </DialogTitle>
          <DialogDescription className="text-base">
            It's been over a year since you last updated your privacy preferences. 
            Please review and confirm your choices below.
          </DialogDescription>
        </DialogHeader>

        <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            <strong>Why we're asking:</strong> Under GDPR regulations, we must periodically 
            re-confirm your consent to process your personal data. This ensures you remain 
            in control of your information.
          </AlertDescription>
        </Alert>

        <div className="space-y-4 py-4">
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-lg border bg-card">
              <Checkbox
                id="tracking"
                checked={consents.tracking}
                onCheckedChange={(checked: boolean) =>
                  setConsents({ ...consents, tracking: checked })
                }
              />
              <div className="flex-1 space-y-1">
                <Label htmlFor="tracking" className="text-base font-semibold cursor-pointer">
                  Activity Tracking
                </Label>
                <p className="text-sm text-muted-foreground">
                  Track your interactions (page views, clicks, time spent) to show you surveys 
                  and products that match your interests. This helps personalize your experience.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-lg border bg-card">
              <Checkbox
                id="personalization"
                checked={consents.personalization}
                onCheckedChange={(checked: boolean) =>
                  setConsents({ ...consents, personalization: checked })
                }
              />
              <div className="flex-1 space-y-1">
                <Label htmlFor="personalization" className="text-base font-semibold cursor-pointer">
                  Personalization
                </Label>
                <p className="text-sm text-muted-foreground">
                  Use your profile data (demographics, interests, preferences) to recommend 
                  relevant content. This includes personalized product recommendations and 
                  survey suggestions.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-lg border bg-card">
              <Checkbox
                id="analytics"
                checked={consents.analytics}
                onCheckedChange={(checked: boolean) =>
                  setConsents({ ...consents, analytics: checked })
                }
              />
              <div className="flex-1 space-y-1">
                <Label htmlFor="analytics" className="text-base font-semibold cursor-pointer">
                  Analytics & Insights
                </Label>
                <p className="text-sm text-muted-foreground">
                  Allow brands to see aggregated, anonymized trends (never your personal data). 
                  This helps companies understand their target audience and improve their products.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-lg border bg-card">
              <Checkbox
                id="marketing"
                checked={consents.marketing}
                onCheckedChange={(checked: boolean) =>
                  setConsents({ ...consents, marketing: checked })
                }
              />
              <div className="flex-1 space-y-1">
                <Label htmlFor="marketing" className="text-base font-semibold cursor-pointer">
                  Marketing Communications
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive occasional emails about new features, survey opportunities, promotions, 
                  and product launches. You can unsubscribe anytime.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-muted rounded-lg p-4 text-sm">
            <p className="font-semibold mb-2">Your Data Rights:</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• You can change these preferences anytime in Settings → Privacy</li>
              <li>• You can export all your data at any time</li>
              <li>• You can delete your account and all data with 30-day grace period</li>
              <li>• We never sell your personal data to third parties</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleDeclineAll}
            disabled={isRenewing}
          >
            Decline All
          </Button>
          <Button
            onClick={handleRenewConsent}
            disabled={isRenewing}
          >
            {isRenewing ? 'Updating...' : 'Confirm My Choices'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
