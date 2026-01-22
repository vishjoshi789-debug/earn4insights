'use client'

import { useState, useEffect } from 'react'
import { Survey, SurveyResponse } from '@/lib/survey-types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatDistanceToNow } from 'date-fns'
import { ThumbsUp, ThumbsDown, Minus, ChevronDown, ChevronUp } from 'lucide-react'
import { analyzeSentiment } from '@/server/sentimentService'

type SentimentData = {
  sentiment: 'positive' | 'negative' | 'neutral'
  score: number
  confidence: number
}

type ResponsesTableProps = {
  responses: SurveyResponse[]
  survey: Survey
}

export default function ResponsesTable({ responses, survey }: ResponsesTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [sentiments, setSentiments] = useState<Map<string, SentimentData>>(new Map())
  
  // Analyze sentiment for text responses
  useEffect(() => {
    const analyzeResponses = async () => {
      const newSentiments = new Map<string, SentimentData>()
      
      for (const response of responses) {
        // Find first text answer
        const textQuestion = survey.questions.find(q => q.type === 'text')
        if (textQuestion && typeof response.answers[textQuestion.id] === 'string') {
          const text = String(response.answers[textQuestion.id])
          if (text.trim()) {
            try {
              const sentiment = await analyzeSentiment(text)
              newSentiments.set(response.id, sentiment)
            } catch (err) {
              console.error('Sentiment analysis failed:', err)
   

  const getSentimentBadge = (sentiment: SentimentData) => {
    const colors = {
      positive: 'bg-green-100 text-green-800 border-green-200',
      negative: 'bg-red-100 text-red-800 border-red-200',
      neutral: 'bg-gray-100 text-gray-800 border-gray-200',
    }
    
    const emojis = {
      positive: '😊',
      negative: '😞',
      neutral: '😐',
    }
    
    return (
      <Badge className={colors[sentiment.sentiment]} variant="outline">
        {emojis[sentiment.sentiment]} {sentiment.sentiment}
      </Badge>
    )
  }         }
          }
        }
      }
      
      setSentiments(newSentiments)
    }
    
    if (responses.length > 0) {
      analyzeResponses()
    }
  }, [responses, survey.questions])
  const [sentiments, setSentiments] = useState<Map<string, SentimentData>>(new Map())
  
  if (responses.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No responses yet</p>
      </const sentiment = sentiments.get(response.id)
        div>
    )
  }

  const getNPSCategory = (rating: number) => {
    if (rating >= 9) return { label: 'Promoter', color: 'bg-green-100 text-green-800 border-green-200', icon: ThumbsUp }
    if (rating >= 7) return { label: 'Passive', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Minus }
    return { label: 'Detractor', color: 'bg-red-100 text-red-800 border-red-200', icon: ThumbsDown }
  }

  const getRatingQuestion = () => {
    return survey.questions.find(q => q.type === 'rating')
  }

  return (
    <div className="space-y-3">
      {responses.map((response) => {
        const isExpanded = expandedId === response.id
        const ratingQuestion = getRatingQuestion()
        const rating = ratingQuestion ? Number(response.answers[ratingQuestion.id]) : null
        
        let category = null
        if (survey.type === 'nps' && rating !== null) {
          category = getNPSCategory(rating)
        }

        return (
          <Card key={response.id} className="p-4">
            <div classSentiment Badge */}
                  {sentiment && getSentimentBadge(sentiment)}
                  
                  {/* Name="flex items-start justify-between">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  {/* Rating Display */}
                  {rating !== null && (
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold">{rating}</span>
                      <span className="text-sm text-muted-foreground">
                        / {survey.type === 'nps' ? '10' : '5'}
                      </span>
                    </div>
                  )}
                  
                  {/* NPS Category Badge */}
                  {category && (
                    <Badge className={category.color} variant="outline">
                      <category.icon className="w-3 h-3 mr-1" />
                      {category.label}
                    </Badge>
                  )}
                  
                  {/* Timestamp */}
                  <span className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(response.submittedAt), { addSuffix: true })}
                  </span>
                </div>

                {/* User Info */}
                {(response.userEmail || response.userName) && (
                  <div className="text-sm text-muted-foreground">
                    {response.userName && <span className="font-medium">{response.userName}</span>}
                    {response.userName && response.userEmail && <span> • </span>}
                    {response.userEmail && <span>{response.userEmail}</span>}
                  </div>
                )}

                {/* Preview of first text answer */}
                {!isExpanded && (
                  <>
                    {Object.entries(response.answers).map(([questionId, answer]) => {
                      const question = survey.questions.find(q => q.id === questionId)
                      if (question?.type === 'text' && typeof answer === 'string' && answer.trim()) {
                        return (
                          <p key={questionId} className="text-sm text-muted-foreground line-clamp-2">
                            "{answer}"
                          </p>
                        )
                      }
                      return null
                    }).filter(Boolean)[0]}
                  </>
                )}

                {/* Expanded View - All Answers */}
                {isExpanded && (
                  <div className="mt-4 space-y-4 border-t pt-4">
                    {survey.questions.map((question) => {
                      const answer = response.answers[question.id]
                      if (!answer) return null

                      return (
                        <div key={question.id}>
                          <p className="text-sm font-medium mb-1">{question.text}</p>
                          <p className="text-sm text-muted-foreground">
                            {typeof answer === 'string' ? answer : JSON.stringify(answer)}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Expand/Collapse Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpandedId(isExpanded ? null : response.id)}
              >
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
