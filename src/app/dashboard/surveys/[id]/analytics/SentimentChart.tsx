'use client'

import { SentimentMetrics } from '@/server/surveys/analyticsService'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

type Props = {
  metrics: SentimentMetrics
}

const SENTIMENT_COLORS = {
  positive: '#10b981', // green
  neutral: '#6b7280', // gray
  negative: '#ef4444', // red
}

export default function SentimentChart({ metrics }: Props) {
  const overallData = [
    { name: 'Positive', value: metrics.positive, fill: SENTIMENT_COLORS.positive },
    { name: 'Neutral', value: metrics.neutral, fill: SENTIMENT_COLORS.neutral },
    { name: 'Negative', value: metrics.negative, fill: SENTIMENT_COLORS.negative },
  ].filter((item) => item.value > 0)

  const modalityData = [
    {
      modality: 'Text',
      positive: metrics.byModality.text.positive,
      neutral: metrics.byModality.text.neutral,
      negative: metrics.byModality.text.negative,
    },
    {
      modality: 'Audio',
      positive: metrics.byModality.audio.positive,
      neutral: metrics.byModality.audio.neutral,
      negative: metrics.byModality.audio.negative,
    },
    {
      modality: 'Video',
      positive: metrics.byModality.video.positive,
      neutral: metrics.byModality.video.neutral,
      negative: metrics.byModality.video.negative,
    },
    {
      modality: 'Image',
      positive: metrics.byModality.image.positive,
      neutral: metrics.byModality.image.neutral,
      negative: metrics.byModality.image.negative,
    },
  ].filter((item) => item.positive + item.neutral + item.negative > 0)

  if (metrics.total === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No sentiment data available
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overall Sentiment */}
      <div>
        <h4 className="text-sm font-medium mb-3">Overall Sentiment</h4>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={overallData} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis type="number" className="text-sm" />
            <YAxis type="category" dataKey="name" className="text-sm" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
              }}
            />
            <Bar dataKey="value" radius={[0, 8, 8, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Sentiment by Modality */}
      {modalityData.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-3">Sentiment by Modality</h4>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={modalityData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="modality" className="text-sm" />
              <YAxis className="text-sm" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                }}
              />
              <Legend />
              <Bar dataKey="positive" stackId="a" fill={SENTIMENT_COLORS.positive} radius={[8, 8, 0, 0]} />
              <Bar dataKey="neutral" stackId="a" fill={SENTIMENT_COLORS.neutral} />
              <Bar dataKey="negative" stackId="a" fill={SENTIMENT_COLORS.negative} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
