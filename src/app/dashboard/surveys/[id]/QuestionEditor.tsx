'use client'

import { useState, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Star,
  MessageSquare,
  ListChecks,
  Type,
  Copy,
  Save,
  Undo2,
  Eye,
  Pencil,
} from 'lucide-react'
import { updateSurveyQuestions } from '@/server/surveys/surveyService'
import type { SurveyQuestion, QuestionType, RatingScale } from '@/lib/survey-types'

type QuestionEditorProps = {
  surveyId: string
  initialQuestions: SurveyQuestion[]
}

const QUESTION_TYPE_META: Record<QuestionType, { label: string; icon: typeof Star; description: string }> = {
  rating: { label: 'Rating Scale', icon: Star, description: 'Numeric rating (1-5 or 1-10)' },
  text: { label: 'Open Text', icon: Type, description: 'Free-form text response' },
  'multiple-choice': { label: 'Multiple Choice', icon: ListChecks, description: 'Pick from predefined options' },
}

function normalizeQuestionType(type: string): QuestionType {
  const map: Record<string, QuestionType> = {
    'multiple_choice': 'multiple-choice',
    'multiple-choice': 'multiple-choice',
    'rating': 'rating',
    'text': 'text',
  }
  return map[type] || 'text'
}

function normalizeQuestions(questions: SurveyQuestion[]): SurveyQuestion[] {
  return questions.map(q => ({ ...q, type: normalizeQuestionType(q.type) }))
}

export default function QuestionEditor({ surveyId, initialQuestions }: QuestionEditorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [questions, setQuestions] = useState<SurveyQuestion[]>(() => normalizeQuestions(initialQuestions))
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')

  const normalizedInitial = normalizeQuestions(initialQuestions)
  const hasChanges = JSON.stringify(questions) !== JSON.stringify(normalizedInitial)

  // --- Question CRUD ---
  const addQuestion = (type: QuestionType = 'text') => {
    const newQ: SurveyQuestion = {
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      question: '',
      required: false,
      ...(type === 'rating' ? { scale: 5 as RatingScale } : {}),
      ...(type === 'multiple-choice' ? { options: ['Option 1', 'Option 2'] } : {}),
    }
    setQuestions([...questions, newQ])
    setActiveIndex(questions.length)
    setMode('edit')
  }

  const duplicateQuestion = (index: number) => {
    const source = questions[index]
    const dupe: SurveyQuestion = {
      ...source,
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      question: `${source.question} (copy)`,
    }
    const updated = [...questions]
    updated.splice(index + 1, 0, dupe)
    setQuestions(updated)
    setActiveIndex(index + 1)
  }

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index))
    setActiveIndex(null)
  }

  const updateQuestion = useCallback((index: number, updates: Partial<SurveyQuestion>) => {
    setQuestions(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], ...updates }
      return updated
    })
  }, [])

  // --- Reorder ---
  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= questions.length) return
    const updated = [...questions]
    ;[updated[index], updated[target]] = [updated[target], updated[index]]
    setQuestions(updated)
    setActiveIndex(target)
  }

  // --- Options CRUD ---
  const addOption = (qIndex: number) => {
    const q = questions[qIndex]
    const options = [...(q.options || []), `Option ${(q.options?.length || 0) + 1}`]
    updateQuestion(qIndex, { options })
  }

  const updateOption = (qIndex: number, oIndex: number, value: string) => {
    const options = [...(questions[qIndex].options || [])]
    options[oIndex] = value
    updateQuestion(qIndex, { options })
  }

  const removeOption = (qIndex: number, oIndex: number) => {
    const options = (questions[qIndex].options || []).filter((_, i) => i !== oIndex)
    updateQuestion(qIndex, { options })
  }

  // --- Save ---
  const handleSave = () => {
    setError(null)
    setSuccess(false)

    // Client-side validation
    if (questions.length === 0) {
      setError('At least one question is required')
      return
    }
    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].question.trim()) {
        setError(`Question ${i + 1} text is required`)
        setActiveIndex(i)
        return
      }
      if (questions[i].type === 'multiple-choice') {
        const opts = questions[i].options || []
        if (opts.length < 2) {
          setError(`Question ${i + 1} needs at least 2 options`)
          setActiveIndex(i)
          return
        }
        if (opts.some(o => !o.trim())) {
          setError(`All options in question ${i + 1} must have text`)
          setActiveIndex(i)
          return
        }
      }
    }

    startTransition(async () => {
      try {
        await updateSurveyQuestions(surveyId, questions)
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save questions')
      }
    })
  }

  const handleReset = () => {
    setQuestions(initialQuestions)
    setActiveIndex(null)
    setError(null)
  }

  // --- Render ---
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CardTitle>Customize Questions</CardTitle>
            <Badge variant="outline" className="text-xs">
              {questions.length} question{questions.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMode(mode === 'edit' ? 'preview' : 'edit')}
            >
              {mode === 'edit' ? (
                <><Eye className="w-4 h-4 mr-1.5" />Preview</>
              ) : (
                <><Pencil className="w-4 h-4 mr-1.5" />Edit</>
              )}
            </Button>
            {hasChanges && (
              <Button type="button" variant="ghost" size="sm" onClick={handleReset}>
                <Undo2 className="w-4 h-4 mr-1.5" />Reset
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isPending || !hasChanges}
            >
              <Save className="w-4 h-4 mr-1.5" />
              {isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Success / Error banners */}
        {success && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-sm font-medium">
            ✓ Questions saved successfully
          </div>
        )}
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm font-medium">
            {error}
          </div>
        )}

        {/* Preview Mode */}
        {mode === 'preview' && (
          <div className="space-y-4">
            {questions.map((q, i) => (
              <div key={q.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <span className="text-sm font-bold text-muted-foreground mt-0.5">{i + 1}.</span>
                  <div className="flex-1 space-y-2">
                    <p className="font-medium">
                      {q.question || <span className="text-muted-foreground italic">Untitled question</span>}
                      {q.required && <span className="text-destructive ml-1">*</span>}
                    </p>
                    {q.type === 'rating' && (
                      <div className="flex gap-1.5">
                        {Array.from({ length: q.scale || 5 }, (_, n) => (
                          <div key={n} className="w-9 h-9 rounded-lg border-2 border-muted flex items-center justify-center text-sm font-medium text-muted-foreground">
                            {n + 1}
                          </div>
                        ))}
                      </div>
                    )}
                    {q.type === 'text' && (
                      <div className="border-b-2 border-muted pb-2 text-sm text-muted-foreground">
                        Long answer text…
                      </div>
                    )}
                    {q.type === 'multiple-choice' && q.options && (
                      <div className="space-y-1.5">
                        {q.options.map((opt, oi) => (
                          <div key={oi} className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full border-2 border-muted" />
                            <span className="text-sm">{opt}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Edit Mode */}
        {mode === 'edit' && (
          <>
            {questions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="w-14 h-14 mx-auto mb-4 opacity-40" />
                <p className="font-medium mb-1">No questions yet</p>
                <p className="text-sm mb-4">Add your first question to start building this survey</p>
              </div>
            ) : (
              <div className="space-y-3">
                {questions.map((question, qIndex) => {
                  const isActive = activeIndex === qIndex
                  const TypeIcon = QUESTION_TYPE_META[question.type].icon

                  return (
                    <div
                      key={question.id}
                      className={`border-2 rounded-lg transition-all ${
                        isActive
                          ? 'border-primary shadow-sm ring-1 ring-primary/20'
                          : 'border-border hover:border-muted-foreground/30'
                      }`}
                      onClick={() => setActiveIndex(qIndex)}
                    >
                      {/* Question header bar */}
                      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b rounded-t-lg">
                        <GripVertical className="w-4 h-4 text-muted-foreground shrink-0 cursor-grab" />
                        <TypeIcon className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-xs font-medium text-muted-foreground">
                          Q{qIndex + 1} · {QUESTION_TYPE_META[question.type].label}
                        </span>
                        {question.required && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Required</Badge>
                        )}
                        <div className="ml-auto flex items-center gap-0.5">
                          <Button
                            type="button" variant="ghost" size="icon"
                            className="h-7 w-7" disabled={qIndex === 0}
                            onClick={(e) => { e.stopPropagation(); moveQuestion(qIndex, 'up') }}
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            type="button" variant="ghost" size="icon"
                            className="h-7 w-7" disabled={qIndex === questions.length - 1}
                            onClick={(e) => { e.stopPropagation(); moveQuestion(qIndex, 'down') }}
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            type="button" variant="ghost" size="icon" className="h-7 w-7"
                            onClick={(e) => { e.stopPropagation(); duplicateQuestion(qIndex) }}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); removeQuestion(qIndex) }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Question body */}
                      <div className="p-4 space-y-4">
                        {/* Question text */}
                        {isActive ? (
                          <Input
                            placeholder="Enter your question…"
                            value={question.question}
                            onChange={(e) => updateQuestion(qIndex, { question: e.target.value })}
                            className="text-base font-medium border-0 border-b-2 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary"
                            autoFocus
                          />
                        ) : (
                          <p className="font-medium text-sm px-0">
                            {question.question || <span className="text-muted-foreground italic">Untitled question</span>}
                          </p>
                        )}

                        {/* Expanded editor when active */}
                        {isActive && (
                          <div className="space-y-4 pt-2">
                            {/* Type + Scale row */}
                            <div className="flex flex-wrap gap-4">
                              <div className="space-y-1.5 min-w-[160px]">
                                <Label className="text-xs text-muted-foreground">Question Type</Label>
                                <Select
                                  value={question.type}
                                  onValueChange={(value: QuestionType) => {
                                    const updates: Partial<SurveyQuestion> = { type: value }
                                    if (value === 'rating') {
                                      updates.scale = 5
                                      updates.options = undefined
                                    } else if (value === 'multiple-choice') {
                                      updates.options = question.options?.length ? question.options : ['Option 1', 'Option 2']
                                      updates.scale = undefined
                                    } else {
                                      updates.scale = undefined
                                      updates.options = undefined
                                    }
                                    updateQuestion(qIndex, updates)
                                  }}
                                >
                                  <SelectTrigger className="h-9">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(QUESTION_TYPE_META).map(([key, meta]) => (
                                      <SelectItem key={key} value={key}>
                                        <div className="flex items-center gap-2">
                                          <meta.icon className="w-3.5 h-3.5" />
                                          {meta.label}
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {question.type === 'rating' && (
                                <div className="space-y-1.5 min-w-[120px]">
                                  <Label className="text-xs text-muted-foreground">Scale</Label>
                                  <Select
                                    value={String(question.scale || 5)}
                                    onValueChange={(v) => updateQuestion(qIndex, { scale: Number(v) as RatingScale })}
                                  >
                                    <SelectTrigger className="h-9">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="5">1 – 5</SelectItem>
                                      <SelectItem value="10">1 – 10</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}

                              <div className="flex items-end gap-2 ml-auto">
                                <div className="flex items-center gap-2">
                                  <Switch
                                    id={`required-${qIndex}`}
                                    checked={question.required || false}
                                    onCheckedChange={(checked) => updateQuestion(qIndex, { required: checked })}
                                  />
                                  <Label htmlFor={`required-${qIndex}`} className="text-xs cursor-pointer">
                                    Required
                                  </Label>
                                </div>
                              </div>
                            </div>

                            {/* Rating preview */}
                            {question.type === 'rating' && (
                              <div className="flex gap-1.5 pt-1">
                                {Array.from({ length: question.scale || 5 }, (_, n) => (
                                  <div key={n} className="w-8 h-8 rounded-md border border-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                                    {n + 1}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Text preview */}
                            {question.type === 'text' && (
                              <div className="border-b border-dashed border-muted-foreground/30 pb-2 text-sm text-muted-foreground">
                                Respondent&apos;s answer will appear here…
                              </div>
                            )}

                            {/* Multiple choice options editor */}
                            {question.type === 'multiple-choice' && (
                              <div className="space-y-2">
                                {(question.options || []).map((option, oIndex) => (
                                  <div key={oIndex} className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/40 shrink-0" />
                                    <Input
                                      value={option}
                                      onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                                      placeholder={`Option ${oIndex + 1}`}
                                      className="h-8 text-sm border-0 border-b rounded-none px-1 focus-visible:ring-0 focus-visible:border-primary"
                                    />
                                    {(question.options?.length || 0) > 2 && (
                                      <Button
                                        type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                                        onClick={() => removeOption(qIndex, oIndex)}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    )}
                                  </div>
                                ))}
                                <Button
                                  type="button" variant="ghost" size="sm"
                                  className="text-primary h-8"
                                  onClick={() => addOption(qIndex)}
                                >
                                  <Plus className="w-3.5 h-3.5 mr-1" />
                                  Add option
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Add question toolbar */}
            <div className="border-2 border-dashed border-muted rounded-lg p-4">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="text-sm text-muted-foreground mr-2">Add question:</span>
                {Object.entries(QUESTION_TYPE_META).map(([key, meta]) => (
                  <Button
                    key={key}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addQuestion(key as QuestionType)}
                    className="h-8"
                  >
                    <meta.icon className="w-3.5 h-3.5 mr-1.5" />
                    {meta.label}
                  </Button>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
