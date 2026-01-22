'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { submitSurveyResponse } from '@/server/surveys/responseService'
import type { Survey } from '@/lib/survey-types'

type NPSResponseFormProps = {
  survey: Survey
}

export default function NPSResponseForm({ survey }: NPSResponseFormProps) {
  const router = useRouter()
  
  // Find the rating and text questions
  const ratingQuestion = survey.questions.find(q => q.type === 'rating' && q.scale === 10)
  const textQuestion = survey.questions.find(q => q.type === 'text')

  const [selectedRating, setSelectedRating] = useState<number | null>(null)
  const [textResponse, setTextResponse] = useState('')
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!ratingQuestion) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Invalid NPS survey configuration
        </CardContent>
      </Card>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (selectedRating === null) {
      setError('Please select a rating to continue')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const answers: Record<string, string | number> = {
        [ratingQuestion.id]: selectedRating,
      }

      if (textQuestion && textResponse.trim()) {
        answers[textQuestion.id] = textResponse
      }

      await submitSurveyResponse(
        survey.id,
        answers,
        userName || undefined,
        userEmail || undefined
      )

      setIsSubmitted(true)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit response'
      console.error('Failed to submit response:', err)
      setError(errorMessage)
      setIsSubmitting(false)
    }
  }

  // Success state
  if (isSubmitted) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold">Thank you for your feedback!</h3>
            <p className="text-muted-foreground">
              Your response helps us improve our product.
            </p>
            <Button
              variant="outline"
              onClick={() => router.push('/')}
              className="mt-4"
            >
              Return Home
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Get category label for visual feedback
  const getCategoryLabel = (rating: number) => {
    if (rating >= 9) return { text: 'Promoter', color: 'text-green-600' }
    if (rating >= 7) return { text: 'Passive', color: 'text-yellow-600' }
    return { text: 'Detractor', color: 'text-red-600' }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{survey.title}</CardTitle>
        {survey.description && (
          <p className="text-sm text-muted-foreground mt-2">{survey.description}</p>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Rating Question */}
          <div className="space-y-4">
            <div>
              <Label className="text-base font-semibold">
                {ratingQuestion.question}
                {ratingQuestion.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
            </div>

            {/* Rating Scale 0-10 */}
            <div className="space-y-3">
              <div className="grid grid-cols-11 gap-2">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => setSelectedRating(rating)}
                    className={`
                      aspect-square rounded-lg border-2 font-semibold text-lg
                      transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary
                      ${
                        selectedRating === rating
                          ? 'bg-primary text-primary-foreground border-primary shadow-md scale-105'
                          : 'bg-background border-border hover:border-primary'
                      }
                    `}
                    aria-label={`Rating ${rating}`}
                  >
                    {rating}
                  </button>
                ))}
              </div>

              {/* Labels */}
              <div className="flex justify-between text-xs text-muted-foreground px-1">
                <span>Not likely at all</span>
                <span>Extremely likely</span>
              </div>

              {/* Category indicator (hidden from user, just for visual feedback) */}
              {selectedRating !== null && (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    You selected: <span className="font-semibold">{selectedRating}</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Text Question - Only show after rating is selected */}
          {textQuestion && selectedRating !== null && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <Label htmlFor="text-response" className="text-base font-semibold">
                {textQuestion.question}
                {textQuestion.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <Textarea
                id="text-response"
                placeholder="Tell us what influenced your score (optional)"
                value={textResponse}
                onChange={(e) => setTextResponse(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
          )}

          {/* Optional user info */}
          {selectedRating !== null && (
            <div className="space-y-4 pt-4 border-t animate-in fade-in slide-in-from-top-2 duration-500">
              <p className="text-sm font-medium">Your details (optional)</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm">Name</Label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive rounded-lg">
              <p className="text-sm text-destructive font-medium">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={selectedRating === null || isSubmitting}
            className="w-full"
            size="lg"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
          </Button>

          {selectedRating === null && (
            <p className="text-xs text-center text-muted-foreground">
              Please select a rating to continue
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
