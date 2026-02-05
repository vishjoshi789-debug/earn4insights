'use client'

import { LanguageMetrics } from '@/server/surveys/analyticsService'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

type Props = {
  metrics: LanguageMetrics
}

const LANGUAGE_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
  '#06b6d4', '#6366f1', '#ef4444', '#84cc16', '#a855f7',
]

export default function LanguageChart({ metrics }: Props) {
  const data = metrics.topLanguages
    .filter((lang) => lang.language !== 'unknown')
    .map((lang, idx) => ({
      ...lang,
      color: LANGUAGE_COLORS[idx % LANGUAGE_COLORS.length],
    }))

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No language data available
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="language"
            angle={-45}
            textAnchor="end"
            height={80}
            className="text-xs"
          />
          <YAxis className="text-sm" />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
            }}
            formatter={(value: number) => [value, 'Responses']}
          />
          <Bar dataKey="count" radius={[8, 8, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Language Table */}
      <div className="border rounded-lg">
        <div className="grid grid-cols-3 gap-4 p-3 bg-muted/50 font-medium text-sm border-b">
          <div>Language</div>
          <div className="text-right">Count</div>
          <div className="text-right">Percentage</div>
        </div>
        <div className="divide-y">
          {data.map((lang, idx) => (
            <div key={lang.language} className="grid grid-cols-3 gap-4 p-3 text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: lang.color }}
                />
                <span className="font-medium">{lang.language}</span>
              </div>
              <div className="text-right">{lang.count}</div>
              <div className="text-right text-muted-foreground">
                {lang.count > 0 && metrics.totalResponses > 0
                  ? ((lang.count / metrics.totalResponses) * 100).toFixed(1)
                  : 0}
                %
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
