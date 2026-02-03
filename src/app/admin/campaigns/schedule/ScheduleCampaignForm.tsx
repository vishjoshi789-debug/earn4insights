'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Send, Calendar, Users, Filter, TrendingUp } from 'lucide-react'
import { Separator } from '@/components/ui/separator'

interface Survey {
  id: string
  title: string
  productId: string
  productName: string
}

interface Props {
  surveys: Survey[]
}

const CATEGORIES = ['Technology', 'Fashion', 'Food & Beverage', 'Health & Wellness', 'Home & Garden', 'Sports & Fitness', 'Travel', 'Entertainment']
const AGE_RANGES = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+']
const LOCATIONS = ['USA', 'Canada', 'UK', 'Australia', 'Europe', 'Asia', 'Other']
const GENDERS = ['male', 'female', 'non-binary', 'prefer-not-to-say']

export function ScheduleCampaignForm({ surveys }: Props) {
  const [selectedSurvey, setSelectedSurvey] = useState('')
  const [scheduleType, setScheduleType] = useState<'immediate' | 'scheduled'>('immediate')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('09:00')
  
  // Targeting filters
  const [categoryFilter, setCategoryFilter] = useState('')
  const [ageRange, setAgeRange] = useState('')
  const [location, setLocation] = useState('')
  const [gender, setGender] = useState('')
  
  // Behavioral filters
  const [useBehavioralFilters, setUseBehavioralFilters] = useState(false)
  const [minEngagement, setMinEngagement] = useState('0')
  const [minCategoryInterest, setMinCategoryInterest] = useState('0')
  const [excludeInactive, setExcludeInactive] = useState(false)
  
  // Send-time optimization
  const [sendTimeOptimization, setSendTimeOptimization] = useState(true)
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setResult(null)

    try {
      // Build request payload
      const payload: any = {
        surveyId: selectedSurvey,
        scheduleType,
        sendTimeOptimization
      }

      if (scheduleType === 'scheduled') {
        payload.scheduledFor = new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
      }

      // Add category filter
      if (categoryFilter) {
        payload.categoryFilter = categoryFilter
      }

      // Add demographic filters
      if (ageRange || location || gender) {
        payload.demographicFilters = {}
        if (ageRange) payload.demographicFilters.ageRange = ageRange
        if (location) payload.demographicFilters.location = location
        if (gender) payload.demographicFilters.gender = gender
      }

      // Add behavioral filters
      if (useBehavioralFilters) {
        payload.behavioralFilters = {}
        if (parseFloat(minEngagement) > 0) {
          payload.behavioralFilters.minEngagementScore = parseFloat(minEngagement)
        }
        if (parseFloat(minCategoryInterest) > 0) {
          payload.behavioralFilters.minCategoryInterest = parseFloat(minCategoryInterest)
        }
        if (excludeInactive) {
          payload.behavioralFilters.excludeInactive = true
        }
      }

      const response = await fetch('/api/admin/campaigns/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (response.ok) {
        setResult({
          success: true,
          message: `Campaign scheduled successfully! ${data.notificationsSent} notifications queued.`
        })
        // Reset form
        setSelectedSurvey('')
        setScheduleType('immediate')
        setCategoryFilter('')
        setAgeRange('')
        setLocation('')
        setGender('')
        setUseBehavioralFilters(false)
      } else {
        setResult({
          success: false,
          message: data.error || 'Failed to schedule campaign'
        })
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Survey Selection */}
      <div className="space-y-2">
        <Label htmlFor="survey">Survey *</Label>
        <Select value={selectedSurvey} onValueChange={setSelectedSurvey} required>
          <SelectTrigger id="survey">
            <SelectValue placeholder="Select a survey to promote" />
          </SelectTrigger>
          <SelectContent>
            {surveys.map(survey => (
              <SelectItem key={survey.id} value={survey.id}>
                {survey.title} ({survey.productName})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Schedule Type */}
      <div className="space-y-2">
        <Label>Send Time</Label>
        <Select value={scheduleType} onValueChange={(v) => setScheduleType(v as any)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="immediate">Send immediately (optimal time per user)</SelectItem>
            <SelectItem value="scheduled">Schedule for specific date/time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {scheduleType === 'scheduled' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="time">Time</Label>
            <Input
              id="time"
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              required
            />
          </div>
        </div>
      )}

      <Separator />

      {/* Targeting Filters */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-purple-600" />
          <h3 className="font-semibold">Targeting Filters</h3>
        </div>

        {/* Category Filter */}
        <div className="space-y-2">
          <Label htmlFor="category">Interest Category (optional)</Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger id="category">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All categories</SelectItem>
              {CATEGORIES.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Only notify users interested in this category</p>
        </div>

        {/* Demographics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="age">Age Range</Label>
            <Select value={ageRange} onValueChange={setAgeRange}>
              <SelectTrigger id="age">
                <SelectValue placeholder="All ages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All ages</SelectItem>
                {AGE_RANGES.map(age => (
                  <SelectItem key={age} value={age}>{age}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger id="location">
                <SelectValue placeholder="All locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All locations</SelectItem>
                {LOCATIONS.map(loc => (
                  <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gender">Gender</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger id="gender">
                <SelectValue placeholder="All genders" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All genders</SelectItem>
                {GENDERS.map(g => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator />

      {/* Behavioral Filters */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold">Behavioral Filters (Advanced)</h3>
          </div>
          <Switch
            checked={useBehavioralFilters}
            onCheckedChange={setUseBehavioralFilters}
          />
        </div>

        {useBehavioralFilters && (
          <div className="space-y-4 pl-7">
            <div className="space-y-2">
              <Label htmlFor="engagement">Minimum Engagement Score (0-1)</Label>
              <Input
                id="engagement"
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={minEngagement}
                onChange={(e) => setMinEngagement(e.target.value)}
                placeholder="0.0"
              />
              <p className="text-xs text-muted-foreground">Only notify users with engagement ≥ this value</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="interest">Minimum Category Interest (0-1)</Label>
              <Input
                id="interest"
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={minCategoryInterest}
                onChange={(e) => setMinCategoryInterest(e.target.value)}
                placeholder="0.0"
              />
              <p className="text-xs text-muted-foreground">Requires categoryFilter to be set above</p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="inactive"
                checked={excludeInactive}
                onCheckedChange={setExcludeInactive}
              />
              <Label htmlFor="inactive">Exclude inactive users (&gt;30 days)</Label>
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* Send-Time Optimization */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Label htmlFor="optimize">Send-Time Optimization</Label>
          <p className="text-sm text-muted-foreground">
            Personalize send time for each user based on their engagement patterns
          </p>
        </div>
        <Switch
          id="optimize"
          checked={sendTimeOptimization}
          onCheckedChange={setSendTimeOptimization}
        />
      </div>

      {/* Result Message */}
      {result && (
        <Alert variant={result.success ? 'default' : 'destructive'}>
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      )}

      {/* Submit Button */}
      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting || !selectedSurvey} className="flex-1">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Scheduling...
            </>
          ) : scheduleType === 'immediate' ? (
            <>
              <Send className="mr-2 h-4 w-4" />
              Send Campaign Now
            </>
          ) : (
            <>
              <Calendar className="mr-2 h-4 w-4" />
              Schedule Campaign
            </>
          )}
        </Button>
      </div>

      {/* Estimated Reach */}
      <div className="bg-muted p-4 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Users className="h-4 w-4" />
          <span className="font-medium text-sm">Estimated Reach</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Campaign will be sent to users who match all selected criteria and have consented to notifications.
          Actual reach depends on active user base and targeting filters.
        </p>
      </div>
    </form>
  )
}
