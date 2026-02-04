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
import { Download, Trash2, AlertTriangle, Info, CheckCircle2, Shield } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

interface PrivacySettingsProps {
  userId: string
  initialProfile: UserProfile
}

export function PrivacySettings({ userId, initialProfile }: PrivacySettingsProps) {
  const [consent, setConsent] = useState<any>(initialProfile.consent || {})
  const [notificationPrefs, setNotificationPrefs] = useState<any>(initialProfile.notificationPreferences || {})
  const [saving, setSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deletionReason, setDeletionReason] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

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

  const handleExportData = async () => {
    setIsExporting(true)
    try {
      const response = await fetch('/api/user/export-data')
      
      if (!response.ok) {
        throw new Error('Failed to export data')
      }

      // Download the file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `earn4insights-data-export-${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast.success('Data exported successfully!')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export data. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleDeleteAccount = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch('/api/user/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: deletionReason })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete account')
      }

      toast.success('Account deletion scheduled', {
        description: `Your account will be deleted on ${new Date(data.deletionScheduledFor).toLocaleDateString()}. You can cancel anytime before then.`
      })

      setShowDeleteDialog(false)
      
      // Redirect to sign out after 2 seconds
      setTimeout(() => {
        window.location.href = '/api/auth/signout'
      }, 2000)

    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Failed to schedule deletion. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* GDPR Compliance Banner */}
      <Alert className="bg-blue-900/50 border-blue-700">
        <Shield className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-900 dark:text-blue-100">
          GDPR Compliant
        </AlertTitle>
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          We respect your privacy rights under GDPR, CCPA, and other data protection laws.
          You have full control over your personal data.
        </AlertDescription>
      </Alert>

      {/* Data Export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Download Your Data
          </CardTitle>
          <CardDescription>
            Export all your personal data in JSON format
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-2">
            <h4 className="font-semibold text-sm">What's included:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Profile information (demographics, interests, preferences)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Activity history (product views, survey completions)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Survey responses and feedback
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Notification history
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Consent records
              </li>
            </ul>
          </div>

          <Button 
            onClick={handleExportData} 
            disabled={isExporting}
            className="w-full sm:w-auto"
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Download My Data'}
          </Button>

          <p className="text-xs text-muted-foreground">
            <Info className="h-3 w-3 inline mr-1" />
            Data export complies with GDPR Article 20 (Right to Data Portability)
          </p>
        </CardContent>
      </Card>

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
              onCheckedChange={(checked: boolean) => handleConsentChange('tracking', checked)}
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
              onCheckedChange={(checked: boolean) => handleConsentChange('personalization', checked)}
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
              onCheckedChange={(checked: boolean) => handleConsentChange('analytics', checked)}
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
              onCheckedChange={(checked: boolean) => handleConsentChange('marketing', checked)}
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
              onCheckedChange={(checked: boolean) => handleChannelToggle('email', checked)}
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

      {/* Account Deletion */}
      <Card className="border-red-200 dark:border-red-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="h-5 w-5" />
            Delete My Account
          </CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Warning: This action is permanent</AlertTitle>
            <AlertDescription>
              Once deleted, your account cannot be recovered. You will lose all:
              <ul className="mt-2 space-y-1 text-sm">
                <li>• Profile data and preferences</li>
                <li>• Survey responses and feedback history</li>
                <li>• Earned points and rewards</li>
                <li>• Activity and engagement records</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900 rounded-lg p-4">
            <h4 className="font-semibold text-sm text-yellow-900 dark:text-yellow-100 mb-2">
              30-Day Grace Period
            </h4>
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Your account will be scheduled for deletion in 30 days. You can cancel anytime
              within this period by logging back in.
            </p>
          </div>

          <Button 
            variant="destructive"
            onClick={() => setShowDeleteDialog(true)}
            className="w-full sm:w-auto"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete My Account
          </Button>

          <p className="text-xs text-muted-foreground">
            <Info className="h-3 w-3 inline mr-1" />
            Account deletion complies with GDPR Article 17 (Right to be Forgotten)
          </p>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Confirm Account Deletion
            </DialogTitle>
            <DialogDescription>
              This will permanently delete your account and all associated data after 30 days.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Why are you leaving? (Optional)
              </label>
              <Textarea
                placeholder="Help us improve by sharing your feedback..."
                value={deletionReason}
                onChange={(e) => setDeletionReason(e.target.value)}
                rows={4}
              />
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                You'll receive a confirmation email and can cancel the deletion within 30 days
                by logging back in.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={isDeleting}
            >
              {isDeleting ? 'Processing...' : 'Yes, Delete My Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
