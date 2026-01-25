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

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  // Demographics
  const [gender, setGender] = useState<string>('')
  const [ageRange, setAgeRange] = useState<string>('')
  const [location, setLocation] = useState<string>('')
  const [language, setLanguage] = useState<string>('English')
  const [education, setEducation] = useState<string>('')

  // Interests
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  const handleCategoryToggle = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    )
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const demographics = {
        gender: gender || undefined,
        ageRange: ageRange || undefined,
        location: location || undefined,
        language: language || 'English',
        education: education || undefined
      }

      const interests = {
        productCategories: selectedCategories,
        topics: []
      }

      await completeOnboarding({ demographics, interests })
      toast.success('Profile completed! Enjoy personalized experiences.')
      router.push('/dashboard')
    } catch (error) {
      toast.error('Failed to save profile. Please try again.')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = () => {
    router.push('/dashboard')
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
                <div className="p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl mb-2">🎯</div>
                  <h3 className="font-semibold mb-1">Relevant Content</h3>
                  <p className="text-sm text-muted-foreground">
                    See products and surveys that match your interests
                  </p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl mb-2">🔔</div>
                  <h3 className="font-semibold mb-1">Smart Notifications</h3>
                  <p className="text-sm text-muted-foreground">
                    Get notified only about things you care about
                  </p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl mb-2">🔒</div>
                  <h3 className="font-semibold mb-1">Privacy First</h3>
                  <p className="text-sm text-muted-foreground">
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
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="max-w-3xl w-full">
          <CardHeader>
            <CardTitle className="text-2xl">Tell us about yourself (optional)</CardTitle>
            <CardDescription>
              This helps us show you relevant products and surveys. You can skip any field.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
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
                <Label htmlFor="age">Age Range</Label>
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
                <Label htmlFor="location">Location</Label>
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
                <Label htmlFor="education">Education</Label>
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
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
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

  // Step 3: Interests
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="max-w-4xl w-full">
        <CardHeader>
          <CardTitle className="text-2xl">What interests you?</CardTitle>
          <CardDescription>
            Select product categories you'd like to see. You can change this later.
          </CardDescription>
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
                      <div className="font-medium">{category}</div>
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
            <Button variant="outline" onClick={() => setStep(2)}>
              Back
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
