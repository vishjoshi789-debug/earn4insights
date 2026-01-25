'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup } from '@/components/ui/radio-group'
import { Star } from 'lucide-react'
import { submitSurveyResponse } from '@/server/surveys/responseService'
import { trackSurveyStartAction, trackSurveyCompleteAction } from '@/app/survey/[surveyId]/actions'
import type { Survey, SurveyQuestion } from '@/lib/survey-types'

type SurveyResponseFormProps = {
  survey: Survey
}

export default function SurveyResponseForm({ survey }: SurveyResponseFormProps) {
  const router = useRouter()
  
  const [answers, setAnswers] = useState<Record<string, string | number>>({})
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Track survey start when component mounts
  useEffect(() => {
    trackSurveyStartAction(survey.id).catch(console.error)
  }, [survey.id])

  const handleAnswerChange = (questionId: string, value: string | number) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
    setError(null)
  }

  const validateForm = () => {
    // Check all required questions are answered
    const requiredQuestions = survey.questions.filter(q => q.required)
    for (const question of requiredQuestions) {
      if (!(question.id in answers) || answers[question.id] === undefined || answers[question.id] === '') {
        setError(`Please answer: "${question.question}"`)
        return false
      }
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setIsSubmitting(true)
    setError(null)

    try {
      await submitSurveyResponse(
        survey.id,
        answers,
        userName || undefined,
        userEmail || undefined
      )

      // Track survey completion
      await trackSurveyCompleteAction(survey.id)

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
              Your response has been recorded successfully.
            </p>
          </div>
        </CardContent>
      </Card>
    )
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
          {/* Render each question */}
          {survey.questions.map((question, index) => (
            <QuestionRenderer
              key={question.id}
              question={question}
              questionNumber={index + 1}
              value={answers[question.id]}
              onChange={(value) => handleAnswerChange(question.id, value)}
            />
          ))}

          {/* Optional user info */}
          {Object.keys(answers).length > 0 && (
            <div className="space-y-4 pt-4 border-t">
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
            disabled={isSubmitting}
            className="w-full"
            size="lg"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Response'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// Question renderer component
function QuestionRenderer({
  question,
  questionNumber,
  value,
  onChange,
}: {
  question: SurveyQuestion
  questionNumber: number
  value: string | number | undefined
  onChange: (value: string | number) => void
}) {
  if (question.type === 'rating') {
    return (
      <div className="space-y-3">
        <Label className="text-base font-semibold">
          {questionNumber}. {question.question}
          {question.required && <span className="text-red-500 ml-1">*</span>}
        </Label>

        {question.scale === 10 ? (
          // NPS-style 0-10 rating
          <div className="space-y-3">
            <div className="grid grid-cols-11 gap-2">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => onChange(rating)}
                  className={`
                    aspect-square rounded-lg border-2 font-semibold text-lg
                    transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary
                    ${
                      value === rating
                        ? 'bg-primary text-primary-foreground border-primary shadow-md scale-105'
                        : 'bg-background border-border hover:border-primary'
                    }
                  `}
                >
                  {rating}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground px-1">
              <span>Not likely</span>
              <span>Very likely</span>
            </div>
          </div>
        ) : (
          // CSAT-style 1-5 star rating
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                type="button"
                onClick={() => onChange(rating)}
                className="focus:outline-none transition-transform hover:scale-110"
              >
                <Star
                  className={`w-10 h-10 ${
                    value && Number(value) >= rating
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300'
                  }`}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (question.type === 'multiple-choice') {
    return (
      <div className="space-y-3">
        <Label className="text-base font-semibold">
          {questionNumber}. {question.question}
          {question.required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        <div className="space-y-2">
          {question.options?.map((option, index) => (
            <button
              key={index}
              type="button"
              onClick={() => onChange(option)}
              className={`
                w-full p-3 border-2 rounded-lg text-left transition-all
                ${
                  value === option
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    value === option
                      ? 'border-primary bg-primary'
                      : 'border-muted-foreground'
                  }`}
                >
                  {value === option && (
                    <div className="w-2 h-2 bg-white rounded-full" />
                  )}
                </div>
                <span>{option}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Text question
  return (
    <div className="space-y-2">
      <Label htmlFor={question.id} className="text-base font-semibold">
        {questionNumber}. {question.question}
        {question.required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      <Textarea
        id={question.id}
        placeholder="Your answer..."
        value={value as string || ''}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="resize-none"
      />
    </div>
  )
}
