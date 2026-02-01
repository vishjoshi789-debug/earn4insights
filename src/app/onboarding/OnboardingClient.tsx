'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { CATEGORY_VALUES, CATEGORY_KEYS } from '@/lib/categories'
import { completeOnboarding } from './actions'
import { toast } from 'sonner'
import { ProgressIndicator } from '@/components/ProgressIndicator'
import { FieldTooltip } from '@/components/FieldTooltip'

export default function OnboardingClient({ userRole }: { userRole?: string }) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  // Demographics
  const [gender, setGender] = useState<string>('')
  const [ageRange, setAgeRange] = useState<string>('')
  const [location, setLocation] = useState<string>('')
  const [language, setLanguage] = useState<string>('English')
  const [education, setEducation] = useState<string>('')
  const [culture, setCulture] = useState<string>('')
  const [aspirations, setAspirations] = useState<string[]>([])

  // Sensitive Data (opt-in)
  const [incomeRange, setIncomeRange] = useState<string>('')
  const [amazonCategories, setAmazonCategories] = useState<string[]>([])
  const [purchaseFrequency, setPurchaseFrequency] = useState<string>('')
  const [shareIncomeData, setShareIncomeData] = useState(false)
  const [sharePurchaseData, setSharePurchaseData] = useState(false)

  // Interests
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  const progressSteps = [
    { id: 1, title: 'Welcome', description: 'Get started' },
    { id: 2, title: 'About You', description: 'Demographics' },
    { id: 3, title: 'Preferences', description: 'Lifestyle & Goals' },
    { id: 4, title: 'Interests', description: 'Categories' }
  ]

  const handleCategoryToggle = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    )
  }

  const handleAspirationToggle = (aspiration: string) => {
    setAspirations(prev =>
      prev.includes(aspiration)
        ? prev.filter(a => a !== aspiration)
        : [...prev, aspiration]
    )
  }

  const handleAmazonCategoryToggle = (category: string) => {
    setAmazonCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    )
  }

  const calculateCompletion = () => {
    let filledFields = 0
    let totalFields = 7 // gender, age, location, education, language, culture, aspirations
    
    if (gender) filledFields++
    if (ageRange) filledFields++
    if (location) filledFields++
    if (education) filledFields++
    if (culture) filledFields++
    if (aspirations.length > 0) filledFields++
    filledFields++ // language always filled
    
    const demographicsPercent = (filledFields / totalFields) * 40 // 40% weight
    const lifestylePercent = (sharePurchaseData || shareIncomeData) ? 20 : 0 // 20% weight for privacy consent
    const interestsPercent = selectedCategories.length > 0 ? 40 : 0 // 40% weight
    
    return Math.round(demographicsPercent + lifestylePercent + interestsPercent)
  }

  const handleSaveForLater = async () => {
    setLoading(true)
    try {
      const demographics = {
        gender: gender || undefined,
        ageRange: ageRange || undefined,
        location: location || undefined,
        language: language || 'English',
        education: education || undefined,
        culture: culture || undefined,
        aspirations: aspirations.length > 0 ? aspirations : undefined
      }

      const interests = {
        productCategories: selectedCategories,
        topics: []
      }

      const sensitiveData = {
        incomeRange: shareIncomeData && incomeRange ? incomeRange : undefined,
        purchaseHistory: sharePurchaseData ? {
          amazonCategories: amazonCategories.length > 0 ? amazonCategories : undefined,
          frequency: purchaseFrequency || undefined
        } : undefined
      }

      console.log('[OnboardingClient] Saving progress:', { demographics, interests, sensitiveData })
      const result = await completeOnboarding({ demographics, interests, sensitiveData })
      console.log('[OnboardingClient] Save result:', result)
      
      toast.success('Progress saved! You can continue anytime.')
      
      const redirectUrl = userRole === 'brand' ? '/dashboard' : '/top-products'
      router.push(redirectUrl)
    } catch (error) {
      console.error('[OnboardingClient] Save error:', error)
      toast.error(`Failed to save progress: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const demographics = {
        gender: gender || undefined,
        ageRange: ageRange || undefined,
        location: location || undefined,
        language: language || 'English',
        education: education || undefined,
        culture: culture || undefined,
        aspirations: aspirations.length > 0 ? aspirations : undefined
      }

      const interests = {
        productCategories: selectedCategories,
        topics: []
      }

      const sensitiveData = {
        incomeRange: shareIncomeData && incomeRange ? incomeRange : undefined,
        purchaseHistory: sharePurchaseData ? {
          amazonCategories: amazonCategories.length > 0 ? amazonCategories : undefined,
          frequency: purchaseFrequency || undefined
        } : undefined
      }

      await completeOnboarding({ demographics, interests, sensitiveData })
      toast.success('Profile completed! Enjoy personalized experiences.')
      
      // Redirect based on user role
      const redirectUrl = userRole === 'brand' ? '/dashboard' : '/top-products'
      router.push(redirectUrl)
    } catch (error) {
      toast.error('Failed to save profile. Please try again.')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = () => {
    // Redirect based on user role
    const redirectUrl = userRole === 'brand' ? '/dashboard' : '/top-products'
    router.push(redirectUrl)
  }

  if (step === 1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl">Welcome to Earn4Insights! 🎉</CardTitle>
            <CardDescription className="text-lg mt-2">
              Let's personalize your experience in just 2 quick steps
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                We'll help you discover products and surveys that match your interests.
                Your data is private and you control how it's used.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="p-4 bg-purple-100 rounded-lg border border-purple-200">
                  <div className="text-2xl mb-2">🎯</div>
                  <h3 className="font-semibold mb-1 text-purple-900">Relevant Content</h3>
                  <p className="text-sm text-purple-700">
                    See products and surveys that match your interests
                  </p>
                </div>
                <div className="p-4 bg-blue-100 rounded-lg border border-blue-200">
                  <div className="text-2xl mb-2">🔔</div>
                  <h3 className="font-semibold mb-1 text-blue-900">Smart Notifications</h3>
                  <p className="text-sm text-blue-700">
                    Get notified only about things you care about
                  </p>
                </div>
                <div className="p-4 bg-green-100 rounded-lg border border-green-200">
                  <div className="text-2xl mb-2">🔒</div>
                  <h3 className="font-semibold mb-1 text-green-900">Privacy First</h3>
                  <p className="text-sm text-green-700">
                    Your data stays private and you stay in control
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-center mt-8">
              <Button variant="outline" onClick={handleSkip}>
                Skip for now
              </Button>
              <Button onClick={() => setStep(2)} size="lg" className="px-8">
                Get Started
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (step === 2) {
    const completion = calculateCompletion()
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="max-w-3xl w-full">
          <CardHeader>
            <ProgressIndicator currentStep={2} steps={progressSteps} />
            <div className="flex items-center justify-between mt-4">
              <div>
                <CardTitle className="text-2xl">Tell us about yourself (optional)</CardTitle>
                <CardDescription>
                  This helps us show you relevant products and surveys. You can skip any field.
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-purple-600">{completion}%</div>
                <div className="text-xs text-muted-foreground">Complete</div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="gender">Gender</Label>
                  <FieldTooltip content="Helps us personalize product recommendations" />
                </div>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger>
                    <SelectValue placeholder="Prefer not to say" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="non-binary">Non-binary</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="age">Age Range</Label>
                  <FieldTooltip content="Shows age-appropriate products and surveys" />
                </div>
                <Select value={ageRange} onValueChange={setAgeRange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select age range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="18-24">18-24</SelectItem>
                    <SelectItem value="25-34">25-34</SelectItem>
                    <SelectItem value="35-44">35-44</SelectItem>
                    <SelectItem value="45-54">45-54</SelectItem>
                    <SelectItem value="55-64">55-64</SelectItem>
                    <SelectItem value="65+">65+</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="location">Location</Label>
                  <FieldTooltip content="See region-specific products and opportunities" />
                </div>
                <Select value={location} onValueChange={setLocation}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="India">India</SelectItem>
                    <SelectItem value="United States">United States</SelectItem>
                    <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                    <SelectItem value="Canada">Canada</SelectItem>
                    <SelectItem value="Australia">Australia</SelectItem>
                    <SelectItem value="Singapore">Singapore</SelectItem>
                    <SelectItem value="UAE">UAE</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="education">Education</Label>
                  <FieldTooltip content="Match with relevant research and surveys" />
                </div>
                <Select value={education} onValueChange={setEducation}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select education level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high-school">High School</SelectItem>
                    <SelectItem value="bachelors">Bachelor's Degree</SelectItem>
                    <SelectItem value="masters">Master's Degree</SelectItem>
                    <SelectItem value="phd">PhD</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">Preferred Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="English">English</SelectItem>
                    <SelectItem value="Hindi">Hindi</SelectItem>
                    <SelectItem value="Spanish">Spanish</SelectItem>
                    <SelectItem value="French">French</SelectItem>
                    <SelectItem value="German">German</SelectItem>
                    <SelectItem value="Chinese">Chinese</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="culture">Cultural Background</Label>
                  <FieldTooltip content="Helps us show culturally relevant products and content" />
                </div>
                <Select value={culture} onValueChange={setCulture}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Western">Western</SelectItem>
                    <SelectItem value="Indian">Indian/South Asian</SelectItem>
                    <SelectItem value="East Asian">East Asian</SelectItem>
                    <SelectItem value="Middle Eastern">Middle Eastern</SelectItem>
                    <SelectItem value="Latin American">Latin American</SelectItem>
                    <SelectItem value="African">African</SelectItem>
                    <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button variant="ghost" onClick={handleSaveForLater} disabled={loading}>
                {loading ? 'Saving...' : 'Save for Later'}
              </Button>
              <Button onClick={() => setStep(3)} className="flex-1">
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Step 3: Preferences & Lifestyle
  if (step === 3) {
    const completion = calculateCompletion()
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="max-w-4xl w-full">
          <CardHeader>
            <ProgressIndicator currentStep={3} steps={progressSteps} />
            <div className="flex items-center justify-between mt-4">
              <div>
                <CardTitle className="text-2xl">Your Goals & Lifestyle</CardTitle>
                <CardDescription>
                  Help us understand what matters to you (all fields optional)
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-purple-600">{completion}%</div>
                <div className="text-xs text-muted-foreground">Complete</div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Aspirations */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label>What are your current goals/aspirations?</Label>
                <FieldTooltip content="We'll recommend products that align with your life goals" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { value: 'career-growth', label: '🚀 Career Growth' },
                  { value: 'financial-freedom', label: '💰 Financial Independence' },
                  { value: 'health-fitness', label: '💪 Health & Fitness' },
                  { value: 'learning-skills', label: '📚 Learning New Skills' },
                  { value: 'entrepreneurship', label: '💡 Entrepreneurship' },
                  { value: 'work-life-balance', label: '⚖️ Work-Life Balance' },
                  { value: 'family-home', label: '🏡 Family & Home' },
                  { value: 'travel-experiences', label: '✈️ Travel & Experiences' }
                ].map(aspiration => (
                  <div
                    key={aspiration.value}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      aspirations.includes(aspiration.value)
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-purple-300'
                    }`}
                    onClick={() => handleAspirationToggle(aspiration.value)}
                  >
                    <span className="text-sm font-medium">{aspiration.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Privacy-Protected Sensitive Data */}
            <div className="border-t pt-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  🔒 Optional: Better Recommendations (Privacy Protected)
                </h3>
                <p className="text-sm text-blue-700 mb-3">
                  Share additional information for more accurate product matches. This data is encrypted and never shared.
                </p>
              </div>

              {/* Income Range */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Checkbox 
                    id="share-income" 
                    checked={shareIncomeData}
                    onCheckedChange={(checked) => setShareIncomeData(checked as boolean)}
                  />
                  <Label htmlFor="share-income" className="cursor-pointer">
                    Share income range to see products that fit my budget
                  </Label>
                </div>
                
                {shareIncomeData && (
                  <Select value={incomeRange} onValueChange={setIncomeRange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select income range (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0-25k">$0 - $25,000</SelectItem>
                      <SelectItem value="25k-50k">$25,000 - $50,000</SelectItem>
                      <SelectItem value="50k-100k">$50,000 - $100,000</SelectItem>
                      <SelectItem value="100k-200k">$100,000 - $200,000</SelectItem>
                      <SelectItem value="200k+">$200,000+</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Purchase History */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Checkbox 
                    id="share-purchase" 
                    checked={sharePurchaseData}
                    onCheckedChange={(checked) => setSharePurchaseData(checked as boolean)}
                  />
                  <Label htmlFor="share-purchase" className="cursor-pointer">
                    Share my shopping preferences for better product suggestions
                  </Label>
                </div>
                
                {sharePurchaseData && (
                  <div className="space-y-3 ml-6">
                    <div className="space-y-2">
                      <Label className="text-sm">What do you typically buy on Amazon?</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {['Electronics', 'Books', 'Clothing', 'Home & Kitchen', 'Health', 'Sports'].map(cat => (
                          <div
                            key={cat}
                            className={`p-2 text-sm rounded border cursor-pointer ${
                              amazonCategories.includes(cat)
                                ? 'border-purple-500 bg-purple-50'
                                : 'border-gray-200 hover:border-purple-300'
                            }`}
                            onClick={() => handleAmazonCategoryToggle(cat)}
                          >
                            {cat}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm">How often do you shop online?</Label>
                      <Select value={purchaseFrequency} onValueChange={setPurchaseFrequency}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Every few months</SelectItem>
                          <SelectItem value="rarely">Rarely</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button variant="ghost" onClick={handleSaveForLater} disabled={loading}>
                {loading ? 'Saving...' : 'Save for Later'}
              </Button>
              <Button onClick={() => setStep(4)} className="flex-1">
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Step 4: Interests
  const completion = calculateCompletion()
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="max-w-4xl w-full">
        <CardHeader>
          <ProgressIndicator currentStep={4} steps={progressSteps} />
          <div className="flex items-center justify-between mt-4">
            <div>
              <CardTitle className="text-2xl">What interests you?</CardTitle>
              <CardDescription>
                Select product categories you'd like to see. You can change this later.
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-purple-600">{completion}%</div>
              <div className="text-xs text-muted-foreground">Complete</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CATEGORY_KEYS.map((key, index) => {
              const category = CATEGORY_VALUES[index]
              const isSelected = selectedCategories.includes(category)
              
              return (
                <div
                  key={key}
                  className={`
                    p-4 border-2 rounded-lg cursor-pointer transition-all
                    ${isSelected 
                      ? 'border-purple-500 bg-purple-50' 
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                    }
                  `}
                  onClick={() => handleCategoryToggle(category)}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleCategoryToggle(category)}
                    />
                    <div>
                      <div className="font-medium text-gray-900">{category}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {selectedCategories.length > 0 && (
            <div className="text-sm text-muted-foreground text-center">
              {selectedCategories.length} {selectedCategories.length === 1 ? 'category' : 'categories'} selected
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(3)}>
              Back
            </Button>
            <Button variant="ghost" onClick={handleSaveForLater} disabled={loading}>
              {loading ? 'Saving...' : 'Save for Later'}
            </Button>
            <Button 
              onClick={handleSubmit} 
              className="flex-1"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Complete Setup'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
