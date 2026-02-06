'use client'

import { ModalityMetrics } from '@/server/surveys/analyticsService'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

type Props = {
  metrics: ModalityMetrics
}

const COLORS = {
  text: '#3b82f6', // blue
  audio: '#8b5cf6', // purple
  video: '#ec4899', // pink
  image: '#f59e0b', // amber
  mixed: '#10b981', // green
}

export default function ModalityChart({ metrics }: Props) {
  const data = [
    { name: 'Text', value: metrics.text, color: COLORS.text },
    { name: 'Audio', value: metrics.audio, color: COLORS.audio },
    { name: 'Video', value: metrics.video, color: COLORS.video },
    { name: 'Image', value: metrics.image, color: COLORS.image },
    { name: 'Mixed', value: metrics.mixed, color: COLORS.mixed },
  ].filter((item) => item.value > 0)

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No feedback data available
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="name" className="text-sm" />
        <YAxis className="text-sm" />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--background))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px',
          }}
        />
        <Bar dataKey="value" radius={[8, 8, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
