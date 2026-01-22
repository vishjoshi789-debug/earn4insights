'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, Star, MessageSquare, CheckSquare } from 'lucide-react'
import { createSurvey } from '@/server/surveys/surveyService'
import type { SurveyQuestion, SurveyType, QuestionType, RatingScale } from '@/lib/survey-types'

type SurveyCreationFormProps = {
  productId: string
}

export default function SurveyCreationForm({ productId }: SurveyCreationFormProps) {
  const router = useRouter()
  
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [surveyType, setSurveyType] = useState<SurveyType>('nps')
  const [questions, setQuestions] = useState<Omit<SurveyQuestion, 'id'>[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        type: 'text',
        question: '',
        required: false,
      },
    ])
  }

  const updateQuestion = (index: number, updates: Partial<Omit<SurveyQuestion, 'id'>>) => {
    const updated = [...questions]
    updated[index] = { ...updated[index], ...updates }
    setQuestions(updated)
  }

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index))
  }

  const addOption = (questionIndex: number) => {
    const updated = [...questions]
    const options = updated[questionIndex].options || []
    updated[questionIndex].options = [...options, '']
    setQuestions(updated)
  }

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    const updated = [...questions]
    const options = [...(updated[questionIndex].options || [])]
    options[optionIndex] = value
    updated[questionIndex].options = options
    setQuestions(updated)
  }

  const removeOption = (questionIndex: number, optionIndex: number) => {
    const updated = [...questions]
    const options = updated[questionIndex].options || []
    updated[questionIndex].options = options.filter((_, i) => i !== optionIndex)
    setQuestions(updated)
  }

  const validateForm = () => {
    if (!title.trim()) {
      setError('Survey title is required')
      return false
    }

    if (surveyType === 'custom') {
      if (questions.length === 0) {
        setError('At least one question is required for custom surveys')
        return false
      }

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i]
        if (!q.question.trim()) {
          setError(`Question ${i + 1} text is required`)
          return false
        }

        if (q.type === 'multiple-choice') {
          if (!q.options || q.options.length < 2) {
            setError(`Question ${i + 1} must have at least 2 options`)
            return false
          }
          if (q.options.some(opt => !opt.trim())) {
            setError(`All options in question ${i + 1} must have text`)
            return false
          }
        }
      }
    }

    setError(null)
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsSaving(true)
    setError(null)

    try {
      // Add IDs to questions for custom surveys
      const questionsWithIds = questions.map((q, index) => ({
        ...q,
        id: `q_${index + 1}`,
      }))

      await createSurvey(
        productId,
        title,
        description || undefined,
        surveyType,
        questionsWithIds
      )

      // Redirect to surveys list
      router.push('/dashboard/surveys')
      router.refresh()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create survey'
      console.error('Failed to create survey:', err)
      setError(errorMessage)
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Survey Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Survey Title *</Label>
            <Input
              id="title"
              placeholder="e.g., Customer Satisfaction Survey"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Help users understand what this survey is about..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Survey Type *</Label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setSurveyType('nps')}
                className={`p-4 border-2 rounded-lg text-left transition-all hover:border-primary ${
                  surveyType === 'nps' ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <Star className="w-6 h-6 mb-2 text-primary" />
                <h4 className="font-semibold">NPS</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  0-10 recommendation score
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSurveyType('csat')}
                className={`p-4 border-2 rounded-lg text-left transition-all hover:border-primary ${
                  surveyType === 'csat' ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <Star className="w-6 h-6 mb-2 text-primary" />
                <h4 className="font-semibold">CSAT</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  1-5 satisfaction rating
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSurveyType('custom')}
                className={`p-4 border-2 rounded-lg text-left transition-all hover:border-primary ${
                  surveyType === 'custom' ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <CheckSquare className="w-6 h-6 mb-2 text-primary" />
                <h4 className="font-semibold">Custom</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Build your own questions
                </p>
              </button>
            </div>
          </div>

          {surveyType === 'nps' && (
            <div className="border rounded-lg p-4 bg-muted/30">
              <p className="text-sm font-medium mb-2">Auto-generated NPS Questions:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• On a scale of 0-10, how likely are you to recommend our product?</li>
                <li>• What is the main reason for your score?</li>
              </ul>
            </div>
          )}

          {surveyType === 'csat' && (
            <div className="border rounded-lg p-4 bg-muted/30">
              <p className="text-sm font-medium mb-2">Auto-generated CSAT Questions:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• How satisfied are you with our product? (1-5 rating)</li>
                <li>• What could we improve?</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Custom Questions */}
      {surveyType === 'custom' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Questions</CardTitle>
              <Button type="button" onClick={addQuestion} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Question
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {questions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No questions yet. Click "Add Question" to get started.</p>
              </div>
            ) : (
              questions.map((question, qIndex) => (
                <div key={qIndex} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-start justify-between">
                    <h4 className="font-semibold">Question {qIndex + 1}</h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeQuestion(qIndex)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Question Text *</Label>
                      <Input
                        placeholder="Enter your question..."
                        value={question.question}
                        onChange={(e) => updateQuestion(qIndex, { question: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Question Type</Label>
                        <Select
                          value={question.type}
                          onValueChange={(value: QuestionType) => {
                            const updates: Partial<Omit<SurveyQuestion, 'id'>> = { type: value }
                            
                            if (value === 'rating') {
                              updates.scale = 5
                              updates.options = undefined
                            } else if (value === 'multiple-choice') {
                              updates.options = ['', '']
                              updates.scale = undefined
                            } else {
                              updates.scale = undefined
                              updates.options = undefined
                            }
                            
                            updateQuestion(qIndex, updates)
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Text Response</SelectItem>
                            <SelectItem value="rating">Rating Scale</SelectItem>
                            <SelectItem value="multiple-choice">Multiple Choice</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {question.type === 'rating' && (
                        <div className="space-y-2">
                          <Label>Rating Scale</Label>
                          <Select
                            value={String(question.scale || 5)}
                            onValueChange={(value) =>
                              updateQuestion(qIndex, { scale: Number(value) as RatingScale })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="5">1-5</SelectItem>
                              <SelectItem value="10">1-10</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    {question.type === 'multiple-choice' && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Answer Options</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addOption(qIndex)}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add Option
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {(question.options || []).map((option, oIndex) => (
                            <div key={oIndex} className="flex items-center gap-2">
                              <Input
                                placeholder={`Option ${oIndex + 1}`}
                                value={option}
                                onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                              />
                              {(question.options?.length || 0) > 2 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeOption(qIndex, oIndex)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`required-${qIndex}`}
                        checked={question.required || false}
                        onChange={(e) => updateQuestion(qIndex, { required: e.target.checked })}
                        className="rounded"
                      />
                      <Label htmlFor={`required-${qIndex}`} className="cursor-pointer">
                        Required question
                      </Label>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive rounded-lg">
          <p className="text-sm text-destructive font-medium">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Creating...' : 'Create Survey'}
        </Button>
      </div>
    </form>
  )
}
