'use client'

import { useState } from 'react'
import { UserProfile } from '@/db/schema'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { updateUserConsent, updateChannelPreferences } from './privacy.actions'
import { toast } from 'sonner'

interface PrivacySettingsProps {
  userId: string
  initialProfile: UserProfile
}

export function PrivacySettings({ userId, initialProfile }: PrivacySettingsProps) {
  const [consent, setConsent] = useState<any>(initialProfile.consent || {})
  const [notificationPrefs, setNotificationPrefs] = useState<any>(initialProfile.notificationPreferences || {})
  const [saving, setSaving] = useState(false)

  const handleConsentChange = async (key: string, value: boolean) => {
    setSaving(true)
    const newConsent = { ...consent, [key]: value }
    setConsent(newConsent)

    const result = await updateUserConsent(userId, { [key]: value })
    setSaving(false)

    if (result.success) {
      toast.success('Privacy settings updated')
    } else {
      toast.error('Failed to update settings')
      // Revert on error
      setConsent(consent)
    }
  }

  const handleChannelToggle = async (channel: 'email' | 'whatsapp' | 'sms', enabled: boolean) => {
    setSaving(true)
    const newPrefs = {
      ...notificationPrefs,
      [channel]: { ...notificationPrefs[channel], enabled }
    }
    setNotificationPrefs(newPrefs)

    const result = await updateChannelPreferences(userId, channel, { enabled })
    setSaving(false)

    if (result.success) {
      toast.success(`${channel.charAt(0).toUpperCase() + channel.slice(1)} notifications ${enabled ? 'enabled' : 'disabled'}`)
    } else {
      toast.error('Failed to update settings')
      setNotificationPrefs(notificationPrefs)
    }
  }

  const handleFrequencyChange = async (channel: 'email' | 'whatsapp' | 'sms', frequency: string) => {
    setSaving(true)
    const newPrefs = {
      ...notificationPrefs,
      [channel]: { ...notificationPrefs[channel], frequency }
    }
    setNotificationPrefs(newPrefs)

    const result = await updateChannelPreferences(userId, channel, { frequency: frequency as any })
    setSaving(false)

    if (result.success) {
      toast.success('Notification frequency updated')
    } else {
      toast.error('Failed to update settings')
      setNotificationPrefs(notificationPrefs)
    }
  }

  const handleQuietHoursChange = async (channel: 'email' | 'whatsapp' | 'sms', type: 'start' | 'end', value: string) => {
    const currentQuietHours = notificationPrefs[channel]?.quietHours || { start: '22:00', end: '08:00' }
    const newQuietHours = { ...currentQuietHours, [type]: value }

    setSaving(true)
    const newPrefs = {
      ...notificationPrefs,
      [channel]: { ...notificationPrefs[channel], quietHours: newQuietHours }
    }
    setNotificationPrefs(newPrefs)

    const result = await updateChannelPreferences(userId, channel, { quietHours: newQuietHours })
    setSaving(false)

    if (result.success) {
      toast.success('Quiet hours updated')
    } else {
      toast.error('Failed to update settings')
      setNotificationPrefs(notificationPrefs)
    }
  }

  return (
    <div className="space-y-6">
      {/* Consent Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Privacy Consent</CardTitle>
          <CardDescription>
            Choose what data we can collect and how we can use it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="tracking">Activity Tracking</Label>
              <p className="text-sm text-muted-foreground">
                Track your interactions to improve your experience
              </p>
            </div>
            <Switch
              id="tracking"
              checked={consent.tracking || false}
              onCheckedChange={(checked) => handleConsentChange('tracking', checked)}
              disabled={saving}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="personalization">Personalization</Label>
              <p className="text-sm text-muted-foreground">
                Receive personalized content and recommendations
              </p>
            </div>
            <Switch
              id="personalization"
              checked={consent.personalization || false}
              onCheckedChange={(checked) => handleConsentChange('personalization', checked)}
              disabled={saving}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="analytics">Analytics</Label>
              <p className="text-sm text-muted-foreground">
                Help brands understand aggregated user behavior
              </p>
            </div>
            <Switch
              id="analytics"
              checked={consent.analytics || false}
              onCheckedChange={(checked) => handleConsentChange('analytics', checked)}
              disabled={saving}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="marketing">Marketing Communications</Label>
              <p className="text-sm text-muted-foreground">
                Receive promotional offers and product updates
              </p>
            </div>
            <Switch
              id="marketing"
              checked={consent.marketing || false}
              onCheckedChange={(checked) => handleConsentChange('marketing', checked)}
              disabled={saving}
            />
          </div>
        </CardContent>
      </Card>

      {/* Email Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Email Notifications</CardTitle>
          <CardDescription>
            Configure how you receive email notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="email-enabled">Enable Email Notifications</Label>
            <Switch
              id="email-enabled"
              checked={notificationPrefs.email?.enabled || false}
              onCheckedChange={(checked) => handleChannelToggle('email', checked)}
              disabled={saving}
            />
          </div>

          {notificationPrefs.email?.enabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="email-frequency">Frequency</Label>
                <Select
                  value={notificationPrefs.email?.frequency || 'instant'}
                  onValueChange={(value) => handleFrequencyChange('email', value)}
                  disabled={saving}
                >
                  <SelectTrigger id="email-frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instant">Instant (as they happen)</SelectItem>
                    <SelectItem value="daily">Daily Digest</SelectItem>
                    <SelectItem value="weekly">Weekly Summary</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Quiet Hours</Label>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label htmlFor="email-quiet-start" className="text-sm text-muted-foreground">From</Label>
                    <Input
                      id="email-quiet-start"
                      type="time"
                      value={notificationPrefs.email?.quietHours?.start || '22:00'}
                      onChange={(e) => handleQuietHoursChange('email', 'start', e.target.value)}
                      disabled={saving}
                    />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="email-quiet-end" className="text-sm text-muted-foreground">To</Label>
                    <Input
                      id="email-quiet-end"
                      type="time"
                      value={notificationPrefs.email?.quietHours?.end || '08:00'}
                      onChange={(e) => handleQuietHoursChange('email', 'end', e.target.value)}
                      disabled={saving}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  We won't send notifications during these hours
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* WhatsApp Notifications (COMING SOON) */}
      <Card className="opacity-60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            WhatsApp Notifications
            <span className="text-xs bg-muted px-2 py-1 rounded">Coming Soon</span>
          </CardTitle>
          <CardDescription>
            Get important updates via WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            WhatsApp notifications will be available soon. We'll notify you when this feature is ready.
          </p>
        </CardContent>
      </Card>

      {/* SMS Notifications (COMING SOON) */}
      <Card className="opacity-60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            SMS Notifications
            <span className="text-xs bg-muted px-2 py-1 rounded">Coming Soon</span>
          </CardTitle>
          <CardDescription>
            Receive SMS alerts for critical updates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            SMS notifications will be available soon. We'll notify you when this feature is ready.
          </p>
        </CardContent>
      </Card>

      {/* Privacy Info */}
      <Card className="border-muted-foreground/20">
        <CardHeader>
          <CardTitle className="text-base">Why We Ask for Your Consent</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>Activity Tracking:</strong> Helps us show you surveys and products that match your interests.
          </p>
          <p>
            <strong>Personalization:</strong> Enables us to recommend relevant content and optimize your experience.
          </p>
          <p>
            <strong>Analytics:</strong> Brands can see aggregated trends (never your personal data) to improve their products.
          </p>
          <p>
            <strong>Marketing:</strong> You'll receive occasional emails about new features, promotions, and product launches.
          </p>
          <p className="pt-2">
            <strong>Your data is never sold.</strong> We only use it to improve your experience and help brands understand their audience better.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
