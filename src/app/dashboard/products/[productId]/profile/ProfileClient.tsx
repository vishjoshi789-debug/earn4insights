'use client'

// React & Next.js
import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Types
import type { ProductProfile } from '@/lib/types/product'

// Actions
import { 
  saveStep1ProductType, 
  saveStep2Audience, 
  saveStep3Channels, 
  completeProfile 
} from './actions'

// UI Components
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

// Icons
import {
  Building2,
  Package,
  Wrench,
  Smartphone,
  Users,
  Building,
  GraduationCap,
  ShoppingCart,
} from 'lucide-react'

const TOTAL_STEPS = 4

type ProductType = 'saas' | 'physical' | 'service' | 'mobile' | null
type AudienceType = 'b2b' | 'b2c' | 'b2b2c' | 'education' | null

export default function ProfileClient({
  productId,
  profile,
}: {
  productId: string
  profile: ProductProfile
}) {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize from persisted profile data
  const [currentStep, setCurrentStep] = useState(profile.currentStep)

  // STEP 1: Product Type
  const [productType, setProductType] = useState<ProductType>(
    (profile.data.productType as ProductType) ?? null
  )

  // STEP 2: Target Audience
  const [audienceType, setAudienceType] = useState<AudienceType>(
    (profile.data.audienceType as AudienceType) ?? null
  )
  const [targetDescription, setTargetDescription] = useState(
    profile.data.targetDescription || ''
  )

  // STEP 3: Feedback Channels
  const [feedbackChannels, setFeedbackChannels] = useState<string[]>(
    profile.data.feedbackChannels || []
  )

  // STEP 4: Primary Goal
  const [primaryGoal, setPrimaryGoal] = useState(
    profile.data.primaryGoal || ''
  )

  // Validation logic for each step
  const canProceed = () => {
    if (currentStep === 1) return productType !== null
    if (currentStep === 2) return audienceType !== null
    if (currentStep === 3) return feedbackChannels.length > 0
    if (currentStep === 4) return primaryGoal.trim().length > 0
    return false
  }

  // Save and proceed to next step
  const goNext = async () => {
    if (!canProceed() || isSaving) return

    setError(null)

    try {
      // Save current step data to server
      if (currentStep === 1 && productType) {
        await saveStep1ProductType(productId, productType)
      } else if (currentStep === 2 && audienceType) {
        await saveStep2Audience(productId, audienceType, targetDescription)
      } else if (currentStep === 3 && feedbackChannels.length > 0) {
        await saveStep3Channels(productId, feedbackChannels)
      }

      // Move to next step
      if (currentStep < TOTAL_STEPS) {
        setCurrentStep((s) => s + 1)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save. Please try again.'
      console.error('Failed to save step:', err)
      setError(errorMessage)
    } finally {
      setIsSaving(false)
    }
  }

  const goBack = () => {
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1)
    }
  }

  const toggleChannel = (channel: string) => {
    setFeedbackChannels((prev) =>
      prev.includes(channel)
        ? prev.filter((c) => c !== channel)
        : [...prev, channel]
    )
  }

  const handleFinish = async () => {
    if (!canProceed() || isSaving) return

    setIsSaving(true)
    setError(null)

    try {
      await completeProfile(productId, primaryGoal)
      
      // Redirect back to product overview
      router.push(`/dashboard/products/${productId}`)
      router.refresh()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to complete profile. Please try again.'
      console.error('Failed to complete profile:', err)
      setError(errorMessage)
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Complete Product Profile</h1>
        <p className="text-muted-foreground mt-1">
          Help us understand your product better to provide tailored insights
        </p>
      </div>

      {/* Progress Bar */}
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((step) => (
          <div
            key={step}
            className={`flex-1 h-2 rounded-full transition-colors ${
              step === currentStep
                ? 'bg-primary'
                : step < currentStep
                ? 'bg-primary/50'
                : 'bg-muted'
            }`}
          />
        ))}
      </div>

      <div className="text-sm text-muted-foreground">
        Step {currentStep} of {TOTAL_STEPS}
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive rounded-lg">
          <p className="text-sm text-destructive font-medium">{error}</p>
        </div>
      )}

      {/* Step Content Card */}
      <Card className="p-6 min-h-[400px]">
        {/* ========== STEP 1: PRODUCT TYPE ========== */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">What type of product is this?</h2>
              <p className="text-sm text-muted-foreground mt-1">
                This helps us customize feedback collection and analytics
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setProductType('saas')}
                className={`p-6 border-2 rounded-lg text-left transition-all hover:border-primary ${
                  productType === 'saas'
                    ? 'border-primary bg-primary/5'
                    : 'border-border'
                }`}
              >
                <Building2 className="w-8 h-8 mb-3 text-primary" />
                <h3 className="font-semibold">SaaS / Software</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Web or desktop applications
                </p>
              </button>

              <button
                onClick={() => setProductType('mobile')}
                className={`p-6 border-2 rounded-lg text-left transition-all hover:border-primary ${
                  productType === 'mobile'
                    ? 'border-primary bg-primary/5'
                    : 'border-border'
                }`}
              >
                <Smartphone className="w-8 h-8 mb-3 text-primary" />
                <h3 className="font-semibold">Mobile App</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  iOS, Android, or cross-platform
                </p>
              </button>

              <button
                onClick={() => setProductType('physical')}
                className={`p-6 border-2 rounded-lg text-left transition-all hover:border-primary ${
                  productType === 'physical'
                    ? 'border-primary bg-primary/5'
                    : 'border-border'
                }`}
              >
                <Package className="w-8 h-8 mb-3 text-primary" />
                <h3 className="font-semibold">Physical Product</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Tangible goods or hardware
                </p>
              </button>

              <button
                onClick={() => setProductType('service')}
                className={`p-6 border-2 rounded-lg text-left transition-all hover:border-primary ${
                  productType === 'service'
                    ? 'border-primary bg-primary/5'
                    : 'border-border'
                }`}
              >
                <Wrench className="w-8 h-8 mb-3 text-primary" />
                <h3 className="font-semibold">Service</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Consulting, support, or professional services
                </p>
              </button>
            </div>
          </div>
        )}

        {/* ========== STEP 2: TARGET AUDIENCE ========== */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">Who is your target audience?</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Understanding your users helps us categorize and analyze feedback
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setAudienceType('b2b')}
                className={`p-6 border-2 rounded-lg text-left transition-all hover:border-primary ${
                  audienceType === 'b2b'
                    ? 'border-primary bg-primary/5'
                    : 'border-border'
                }`}
              >
                <Building className="w-8 h-8 mb-3 text-primary" />
                <h3 className="font-semibold">B2B (Business)</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Selling to other companies
                </p>
              </button>

              <button
                onClick={() => setAudienceType('b2c')}
                className={`p-6 border-2 rounded-lg text-left transition-all hover:border-primary ${
                  audienceType === 'b2c'
                    ? 'border-primary bg-primary/5'
                    : 'border-border'
                }`}
              >
                <Users className="w-8 h-8 mb-3 text-primary" />
                <h3 className="font-semibold">B2C (Consumers)</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Direct to individual users
                </p>
              </button>

              <button
                onClick={() => setAudienceType('b2b2c')}
                className={`p-6 border-2 rounded-lg text-left transition-all hover:border-primary ${
                  audienceType === 'b2b2c'
                    ? 'border-primary bg-primary/5'
                    : 'border-border'
                }`}
              >
                <ShoppingCart className="w-8 h-8 mb-3 text-primary" />
                <h3 className="font-semibold">B2B2C (Hybrid)</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Business that serves consumers
                </p>
              </button>

              <button
                onClick={() => setAudienceType('education')}
                className={`p-6 border-2 rounded-lg text-left transition-all hover:border-primary ${
                  audienceType === 'education'
                    ? 'border-primary bg-primary/5'
                    : 'border-border'
                }`}
              >
                <GraduationCap className="w-8 h-8 mb-3 text-primary" />
                <h3 className="font-semibold">Education</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Schools, students, or educators
                </p>
              </button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="target-desc">
                Describe your ideal user (optional)
              </Label>
              <Textarea
                id="target-desc"
                placeholder="e.g., Small business owners in the healthcare industry..."
                value={targetDescription}
                onChange={(e) => setTargetDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        )}

        {/* ========== STEP 3: FEEDBACK CHANNELS ========== */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">Where will feedback come from?</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Select all channels you plan to use (you can add more later)
              </p>
            </div>

            <div className="space-y-3">
              {[
                { id: 'in-app', label: 'In-App Feedback Widget', desc: 'Embedded in your product' },
                { id: 'email', label: 'Email Surveys', desc: 'Sent to your user base' },
                { id: 'social', label: 'Social Media Monitoring', desc: 'Twitter, Reddit, etc.' },
                { id: 'reviews', label: 'App Store / Review Sites', desc: 'G2, Capterra, App Store reviews' },
                { id: 'support', label: 'Customer Support Tickets', desc: 'Zendesk, Intercom, etc.' },
                { id: 'community', label: 'Community Forums', desc: 'Discord, Slack, forums' },
              ].map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => toggleChannel(channel.id)}
                  className={`w-full p-4 border-2 rounded-lg text-left transition-all hover:border-primary ${
                    feedbackChannels.includes(channel.id)
                      ? 'border-primary bg-primary/5'
                      : 'border-border'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        feedbackChannels.includes(channel.id)
                          ? 'bg-primary border-primary'
                          : 'border-muted-foreground'
                      }`}
                    >
                      {feedbackChannels.includes(channel.id) && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                          <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{channel.label}</h3>
                      <p className="text-sm text-muted-foreground">{channel.desc}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ========== STEP 4: GOALS & REVIEW ========== */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">What's your primary goal?</h2>
              <p className="text-sm text-muted-foreground mt-1">
                This helps us prioritize insights and recommendations
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="goal">Primary Goal</Label>
              <Input
                id="goal"
                placeholder="e.g., Improve user retention, Increase NPS score, Reduce churn..."
                value={primaryGoal}
                onChange={(e) => setPrimaryGoal(e.target.value)}
              />
            </div>

            <div className="border rounded-lg p-4 bg-muted/50 space-y-3">
              <h3 className="font-semibold text-sm">Profile Summary</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Product Type:</span>
                  <p className="font-medium capitalize">{productType || '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Audience:</span>
                  <p className="font-medium uppercase">{audienceType || '—'}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Feedback Channels:</span>
                  <p className="font-medium">{feedbackChannels.length} selected</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          disabled={currentStep === 1 || isSaving}
          onClick={goBack}
        >
          Back
        </Button>

        {currentStep < TOTAL_STEPS ? (
          <Button
            disabled={!canProceed() || isSaving}
            onClick={goNext}
          >
            {isSaving ? 'Saving...' : 'Continue'}
          </Button>
        ) : (
          <Button
            disabled={!canProceed() || isSaving}
            onClick={handleFinish}
          >
            {isSaving ? 'Completing...' : 'Complete Profile'}
          </Button>
        )}
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Product ID: {productId}
      </p>
    </div>
  )
}