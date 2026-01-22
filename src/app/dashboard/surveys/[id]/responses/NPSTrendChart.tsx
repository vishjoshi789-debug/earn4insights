'use client'

import { Survey, SurveyResponse } from '@/lib/survey-types'
import { Card } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { format, parseISO, startOfDay } from 'date-fns'

type NPSTrendChartProps = {
  responses: SurveyResponse[]
  survey: Survey
}

export default function NPSTrendChart({ responses, survey }: NPSTrendChartProps) {
  const ratingQuestion = survey.questions.find(q => q.type === 'rating')
  if (!ratingQuestion) return null

  // Group responses by day and calculate NPS for each day
  const responsesByDay = new Map<string, SurveyResponse[]>()
  
  responses.forEach(response => {
    const dayKey = format(startOfDay(new Date(response.submittedAt)), 'yyyy-MM-dd')
    if (!responsesByDay.has(dayKey)) {
      responsesByDay.set(dayKey, [])
    }
    responsesByDay.get(dayKey)!.push(response)
  })

  // Calculate NPS for each day
  const chartData = Array.from(responsesByDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, dayResponses]) => {
      const ratings = dayResponses
        .map(r => Number(r.answers[ratingQuestion.id]))
        .filter(r => !isNaN(r))
      
      const promoters = ratings.filter(r => r >= 9).length
      const passives = ratings.filter(r => r >= 7 && r < 9).length
      const detractors = ratings.filter(r => r < 7).length
      const total = ratings.length
      
      const nps = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0
      
      return {
        date: format(parseISO(date), 'MMM d'),
        nps,
        promoters,
        passives,
        detractors,
        total
      }
    })

  if (chartData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        No data available for chart
      </div>
    )
  }

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12 }}
          />
          <YAxis 
            domain={[-100, 100]}
            tick={{ fontSize: 12 }}
            label={{ value: 'NPS Score', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip 
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload
                return (
                  <Card className="p-3 shadow-lg">
                    <p className="font-semibold mb-2">{data.date}</p>
                    <p className="text-sm">
                      <span className="font-medium">NPS:</span> {data.nps}
                    </p>
                    <div className="text-xs mt-2 space-y-1">
                      <p className="text-green-600">Promoters: {data.promoters}</p>
                      <p className="text-yellow-600">Passives: {data.passives}</p>
                      <p className="text-red-600">Detractors: {data.detractors}</p>
                      <p className="text-muted-foreground">Total: {data.total}</p>
                    </div>
                  </Card>
                )
              }
              return null
            }}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="nps" 
            stroke="#2563eb" 
            strokeWidth={2}
            name="NPS Score"
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
