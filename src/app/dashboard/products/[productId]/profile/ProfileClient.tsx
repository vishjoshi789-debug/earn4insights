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
  saveStep4Goal,
  saveStep5Branding,
  saveStep6Details,
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

const TOTAL_STEPS = 7

type ProductType = 'saas' | 'physical' | 'service' | 'mobile' | null
type AudienceType = 'b2b' | 'b2c' | 'b2b2c' | 'education' | null
type ProductStage = 'pre-launch' | 'recently-launched' | 'growth' | 'established' | null
type UserBase = 'under-100' | '100-1k' | '1k-10k' | '10k-100k' | '100k-plus' | null

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

  // STEP 5: Visual Identity
  const [primaryColor, setPrimaryColor] = useState(
    profile.data.branding?.primaryColor || '#3b82f6'
  )
  const [logo, setLogo] = useState<{ url: string; filename: string; size: number } | null>(
    profile.data.branding?.logo || null
  )
  const [productImages, setProductImages] = useState<Array<{ url: string; filename: string; alt?: string }>>(
    profile.data.branding?.productImages || []
  )

  // STEP 6: Product Details
  const [website, setWebsite] = useState(
    profile.data.productDetails?.website || ''
  )
  const [tagline, setTagline] = useState(
    profile.data.productDetails?.tagline || ''
  )
  const [description, setDescription] = useState(
    profile.data.productDetails?.description || ''
  )
  const [keyFeatures, setKeyFeatures] = useState<string[]>(
    profile.data.productDetails?.keyFeatures || ['', '', '']
  )

  // STEP 7: Maturity & Context
  const [productStage, setProductStage] = useState<ProductStage>(
    (profile.data.context?.productStage as ProductStage) ?? null
  )
  const [userBase, setUserBase] = useState<UserBase>(
    (profile.data.context?.userBase as UserBase) ?? null
  )
  const [twitter, setTwitter] = useState(
    profile.data.context?.socialMedia?.twitter || ''
  )
  const [linkedin, setLinkedin] = useState(
    profile.data.context?.socialMedia?.linkedin || ''
  )
  const [testimonials, setTestimonials] = useState<Array<{
    quote: string
    author: string
    role?: string
    company?: string
  }>>(profile.data.context?.testimonials || [])

  // Validation logic for each step
  const canProceed = () => {
    if (currentStep === 1) return productType !== null
    if (currentStep === 2) return audienceType !== null
    if (currentStep === 3) return feedbackChannels.length > 0
    if (currentStep === 4) return primaryGoal.trim().length > 0
    if (currentStep === 5) return true // All optional
    if (currentStep === 6) return true // All optional
    if (currentStep === 7) return productStage !== null // Required field
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
      } else if (currentStep === 4 && primaryGoal.trim().length > 0) {
        await saveStep4Goal(productId, primaryGoal)
      } else if (currentStep === 5) {
        await saveStep5Branding(productId, primaryColor, logo, productImages)
      } else if (currentStep === 6) {
        const features = keyFeatures.filter(f => f.trim().length > 0)
        await saveStep6Details(productId, website, tagline, description, features)
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
      await completeProfile(productId, productStage!, userBase, twitter, linkedin, testimonials)
      
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

  const updateFeature = (index: number, value: string) => {
    setKeyFeatures(prev => {
      const newFeatures = [...prev]
      newFeatures[index] = value
      return newFeatures
    })
  }

  // File upload handlers
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('Logo file size must be less than 2MB')
      return
    }

    // Convert to base64
    const reader = new FileReader()
    reader.onloadend = () => {
      setLogo({
        url: reader.result as string,
        filename: file.name,
        size: file.size
      })
    }
    reader.readAsDataURL(file)
  }

  const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || productImages.length >= 3) return

    const newImages: Array<{ url: string; filename: string; alt?: string }> = []

    for (let i = 0; i < Math.min(files.length, 3 - productImages.length); i++) {
      const file = files[i]
      
      // Validate file size (max 5MB per image)
      if (file.size > 5 * 1024 * 1024) {
        setError(`Image ${file.name} is too large (max 5MB)`)
        continue
      }

      await new Promise<void>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          newImages.push({
            url: reader.result as string,
            filename: file.name,
            alt: ''
          })
          resolve()
        }
        reader.readAsDataURL(file)
      })
    }

    setProductImages(prev => [...prev, ...newImages])
  }

  const removeProductImage = (index: number) => {
    setProductImages(prev => prev.filter((_, i) => i !== index))
  }

  // Testimonial handlers
  const addTestimonial = () => {
    setTestimonials(prev => [...prev, { quote: '', author: '', role: '', company: '' }])
  }

  const updateTestimonial = (index: number, field: string, value: string) => {
    setTestimonials(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const removeTestimonial = (index: number) => {
    setTestimonials(prev => prev.filter((_, i) => i !== index))
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
        {[1, 2, 3, 4, 5, 6, 7].map((step) => (
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

        {/* ========== STEP 5: VISUAL IDENTITY ========== */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">Visual Identity</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Add your brand colors and assets (all optional - you can add these later)
              </p>
            </div>

            <div className="space-y-4">
              {/* Logo Upload */}
              <div className="space-y-2">
                <Label htmlFor="logo">Product Logo</Label>
                {logo ? (
                  <div className="border rounded-lg p-4 bg-muted/30 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img 
                        src={logo.url} 
                        alt="Logo preview" 
                        className="w-16 h-16 object-contain bg-white rounded border"
                      />
                      <div>
                        <p className="text-sm font-medium">{logo.filename}</p>
                        <p className="text-xs text-muted-foreground">
                          {(logo.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setLogo(null)}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed rounded-lg p-6 text-center">
                    <input
                      type="file"
                      id="logo"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <label 
                      htmlFor="logo"
                      className="cursor-pointer flex flex-col items-center gap-2"
                    >
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Package className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Click to upload logo</p>
                        <p className="text-xs text-muted-foreground">PNG, JPG, SVG (max 2MB)</p>
                      </div>
                    </label>
                  </div>
                )}
              </div>

              {/* Product Images Upload */}
              <div className="space-y-2">
                <Label>Product Images (up to 3)</Label>
                <div className="space-y-3">
                  {productImages.map((image, index) => (
                    <div key={index} className="border rounded-lg p-3 bg-muted/30 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img 
                          src={image.url} 
                          alt={image.alt || `Product image ${index + 1}`}
                          className="w-20 h-20 object-cover rounded"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{image.filename}</p>
                          <Input
                            placeholder="Image description (optional)"
                            value={image.alt || ''}
                            onChange={(e) => {
                              const updated = [...productImages]
                              updated[index].alt = e.target.value
                              setProductImages(updated)
                            }}
                            className="mt-1 text-xs"
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeProductImage(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  
                  {productImages.length < 3 && (
                    <div className="border-2 border-dashed rounded-lg p-4 text-center">
                      <input
                        type="file"
                        id="product-images"
                        accept="image/*"
                        multiple
                        onChange={handleProductImageUpload}
                        className="hidden"
                      />
                      <label 
                        htmlFor="product-images"
                        className="cursor-pointer flex flex-col items-center gap-2"
                      >
                        <p className="text-sm font-medium">+ Add product images</p>
                        <p className="text-xs text-muted-foreground">
                          {3 - productImages.length} image{3 - productImages.length !== 1 ? 's' : ''} remaining (max 5MB each)
                        </p>
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Brand Color */}
              <div className="space-y-2">
                <Label htmlFor="color">Primary Brand Color</Label>
                <div className="flex gap-3 items-center">
                  <input
                    type="color"
                    id="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-10 w-20 rounded border cursor-pointer"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#3b82f6"
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Used for branded analytics and public product page theming
                </p>
              </div>
            </div>

            <div className="border-t pt-4 mt-4">
              <p className="text-sm text-muted-foreground">
                💡 <strong>Skip for now?</strong> You can complete this step later from your product settings
              </p>
            </div>
          </div>
        )}

        {/* ========== STEP 6: PRODUCT DETAILS ========== */}
        {currentStep === 6 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">Product Details</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Help users understand your product (optional - enhances your public product page)
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="website">Official Website</Label>
                <Input
                  id="website"
                  type="url"
                  placeholder="https://yourproduct.com"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tagline">Product Tagline</Label>
                <Input
                  id="tagline"
                  placeholder="e.g., AI-powered customer insights platform"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground">
                  {tagline.length}/100 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Product Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe what makes your product unique and valuable..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>Key Features (up to 3)</Label>
                {keyFeatures.map((feature, index) => (
                  <Input
                    key={index}
                    placeholder={`Feature ${index + 1}`}
                    value={feature}
                    onChange={(e) => updateFeature(index, e.target.value)}
                  />
                ))}
                <p className="text-xs text-muted-foreground">
                  These will be displayed on your public product page
                </p>
              </div>
            </div>

            <div className="border-t pt-4 mt-4">
              <p className="text-sm text-muted-foreground">
                💡 <strong>Skip for now?</strong> You can add these details later to improve your public product page
              </p>
            </div>
          </div>
        )}

        {/* ========== STEP 7: MATURITY & CONTEXT ========== */}
        {currentStep === 7 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">Product Maturity & Context</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Help us calibrate insights and benchmarks for your product stage
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-3">
                <Label>Product Stage *</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setProductStage('pre-launch')}
                    className={`p-4 border-2 rounded-lg text-left transition-all hover:border-primary ${
                      productStage === 'pre-launch'
                        ? 'border-primary bg-primary/5'
                        : 'border-border'
                    }`}
                  >
                    <h3 className="font-semibold text-sm">Pre-launch (Beta)</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Testing with early users
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProductStage('recently-launched')}
                    className={`p-4 border-2 rounded-lg text-left transition-all hover:border-primary ${
                      productStage === 'recently-launched'
                        ? 'border-primary bg-primary/5'
                        : 'border-border'
                    }`}
                  >
                    <h3 className="font-semibold text-sm">Recently Launched</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      0-6 months live
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProductStage('growth')}
                    className={`p-4 border-2 rounded-lg text-left transition-all hover:border-primary ${
                      productStage === 'growth'
                        ? 'border-primary bg-primary/5'
                        : 'border-border'
                    }`}
                  >
                    <h3 className="font-semibold text-sm">Growth Stage</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      6 months - 2 years
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProductStage('established')}
                    className={`p-4 border-2 rounded-lg text-left transition-all hover:border-primary ${
                      productStage === 'established'
                        ? 'border-primary bg-primary/5'
                        : 'border-border'
                    }`}
                  >
                    <h3 className="font-semibold text-sm">Established</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      2+ years live
                    </p>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="userbase">Approximate User Base (Optional)</Label>
                <select
                  id="userbase"
                  value={userBase || ''}
                  onChange={(e) => setUserBase((e.target.value || null) as UserBase)}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="">Select user base size</option>
                  <option value="under-100">&lt; 100 users</option>
                  <option value="100-1k">100 - 1,000 users</option>
                  <option value="1k-10k">1,000 - 10,000 users</option>
                  <option value="10k-100k">10,000 - 100,000 users</option>
                  <option value="100k-plus">100,000+ users</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  Helps us provide relevant benchmarks and insights
                </p>
              </div>

              <div className="space-y-2">
                <Label>Social Media (Optional)</Label>
                <div className="space-y-2">
                  <Input
                    placeholder="Twitter/X handle (e.g., @yourproduct)"
                    value={twitter}
                    onChange={(e) => setTwitter(e.target.value)}
                  />
                  <Input
                    placeholder="LinkedIn page URL"
                    value={linkedin}
                    onChange={(e) => setLinkedin(e.target.value)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Used for social listening and brand verification
                </p>
              </div>

              {/* Testimonials Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Customer Testimonials (Optional)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addTestimonial}
                    disabled={testimonials.length >= 3}
                  >
                    + Add Testimonial
                  </Button>
                </div>
                
                {testimonials.length > 0 ? (
                  <div className="space-y-3">
                    {testimonials.map((testimonial, index) => (
                      <Card key={index} className="p-4">
                        <div className="space-y-3">
                          <div className="flex justify-between items-start">
                            <Label className="text-sm">Testimonial {index + 1}</Label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeTestimonial(index)}
                            >
                              Remove
                            </Button>
                          </div>
                          
                          <Textarea
                            placeholder="Customer quote or testimonial..."
                            value={testimonial.quote}
                            onChange={(e) => updateTestimonial(index, 'quote', e.target.value)}
                            rows={2}
                          />
                          
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              placeholder="Author name *"
                              value={testimonial.author}
                              onChange={(e) => updateTestimonial(index, 'author', e.target.value)}
                            />
                            <Input
                              placeholder="Role/Title"
                              value={testimonial.role || ''}
                              onChange={(e) => updateTestimonial(index, 'role', e.target.value)}
                            />
                          </div>
                          
                          <Input
                            placeholder="Company name"
                            value={testimonial.company || ''}
                            onChange={(e) => updateTestimonial(index, 'company', e.target.value)}
                          />
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="border-2 border-dashed rounded-lg p-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      No testimonials added yet. Add customer testimonials to build trust on your public product page.
                    </p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Testimonials with social proof increase feedback submission rates by up to 40%
                </p>
              </div>
            </div>

            <div className="border rounded-lg p-4 bg-primary/5 space-y-3">
              <h3 className="font-semibold text-sm">🎉 Almost done!</h3>
              <p className="text-sm text-muted-foreground">
                After completing this step, you'll have a complete product profile with:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• Customized analytics dashboards</li>
                <li>• AI-powered feedback insights</li>
                <li>• Public product page for collecting feedback</li>
                <li>• Benchmarking against similar products</li>
              </ul>
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