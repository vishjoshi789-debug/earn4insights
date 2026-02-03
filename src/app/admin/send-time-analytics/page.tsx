'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts'

interface SendTimeStats {
  variance: number
  optimizationEnabled: boolean
  recommendation: string
  hourlyData: Array<{
    hour: number
    emailsSent: number
    emailsClicked: number
    clickRate: number
  }>
  demographicData: Array<{
    segment: string
    clickRate: number
    optimalHour: number
    sampleSize: number
  }>
  cohortData: Array<{
    cohort: string
    emailsSent: number
    clickRate: number
    avgTimeToClick: number
  }>
}

export default function SendTimeAnalyticsDashboard() {
  const [stats, setStats] = useState<SendTimeStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/send-time-analytics')
      if (!response.ok) throw new Error('Failed to fetch analytics')
      const data = await response.json()
      setStats(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-red-600">Error: {error || 'No data available'}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const variancePercent = (stats.variance * 100).toFixed(1)
  const varianceColor = stats.variance > 0.30 ? 'text-green-600' : 
                        stats.variance < 0.15 ? 'text-blue-600' : 'text-yellow-600'

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Send-Time Optimization Analytics</h1>
        <p className="text-gray-600 mt-2">
          Data-driven email send-time optimization based on click-rate analysis
        </p>
      </div>

      {/* Optimization Status */}
      <Card>
        <CardHeader>
          <CardTitle>Optimization Status</CardTitle>
          <CardDescription>Current send-time strategy</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Click-Rate Variance:</span>
              <span className={`text-2xl font-bold ${varianceColor}`}>{variancePercent}%</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Optimization:</span>
              <span className={`text-lg font-semibold ${stats.optimizationEnabled ? 'text-green-600' : 'text-blue-600'}`}>
                {stats.optimizationEnabled ? '✅ ENABLED' : '⏸️ DISABLED'}
              </span>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium mb-2">Recommendation:</p>
              <p className="text-sm text-gray-700">{stats.recommendation}</p>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t">
              <div className="text-center">
                <p className="text-xs text-gray-500">Threshold</p>
                <p className="text-sm font-medium">&gt;30% = Optimize</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Monitor</p>
                <p className="text-sm font-medium">15-30% = Watch</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Random OK</p>
                <p className="text-sm font-medium">&lt;15% = Fine</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hourly Click Rates */}
      <Card>
        <CardHeader>
          <CardTitle>Click Rates by Hour of Day</CardTitle>
          <CardDescription>Email engagement by send time (last 30 days)</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={stats.hourlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="hour" 
                label={{ value: 'Hour of Day', position: 'insideBottom', offset: -5 }}
                tickFormatter={(hour) => `${hour}:00`}
              />
              <YAxis 
                yAxisId="left"
                label={{ value: 'Click Rate (%)', angle: -90, position: 'insideLeft' }}
                tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
              />
              <YAxis 
                yAxisId="right" 
                orientation="right"
                label={{ value: 'Emails Sent', angle: 90, position: 'insideRight' }}
              />
              <Tooltip 
                formatter={(value: any, name: string) => {
                  if (name === 'clickRate') return `${(value * 100).toFixed(2)}%`
                  return value
                }}
                labelFormatter={(hour) => `Hour: ${hour}:00`}
              />
              <Legend />
              <Bar yAxisId="right" dataKey="emailsSent" fill="#94a3b8" name="Emails Sent" />
              <Bar yAxisId="left" dataKey="clickRate" fill="#3b82f6" name="Click Rate" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Demographic Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Demographic Segment Performance</CardTitle>
          <CardDescription>Click rates and optimal send times by segment</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.demographicData.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No demographic data available yet. Need more email sends with demographic tracking.
              </p>
            ) : (
              <div className="grid gap-4">
                {stats.demographicData.map((segment) => (
                  <div 
                    key={segment.segment} 
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{segment.segment}</p>
                      <p className="text-sm text-gray-500">
                        Sample size: {segment.sampleSize} emails
                      </p>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Click Rate</p>
                        <p className="font-semibold text-blue-600">
                          {(segment.clickRate * 100).toFixed(1)}%
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Best Hour</p>
                        <p className="font-semibold text-green-600">
                          {segment.optimalHour}:00
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cohort Performance */}
      <Card>
        <CardHeader>
          <CardTitle>A/B Test Cohort Performance</CardTitle>
          <CardDescription>Comparing different send-time strategies</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.cohortData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="cohort" />
              <YAxis 
                label={{ value: 'Click Rate (%)', angle: -90, position: 'insideLeft' }}
                tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
              />
              <Tooltip 
                formatter={(value: any, name: string) => {
                  if (name === 'clickRate') return `${(value * 100).toFixed(2)}%`
                  if (name === 'avgTimeToClick') return `${value} min`
                  return value
                }}
              />
              <Legend />
              <Bar dataKey="clickRate" fill="#10b981" name="Click Rate" />
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-4 grid grid-cols-2 gap-4">
            {stats.cohortData.map((cohort) => (
              <div key={cohort.cohort} className="p-4 border rounded-lg">
                <p className="font-medium capitalize">{cohort.cohort}</p>
                <div className="mt-2 space-y-1 text-sm">
                  <p className="text-gray-600">
                    Sent: <span className="font-medium">{cohort.emailsSent}</span>
                  </p>
                  <p className="text-gray-600">
                    Click Rate: <span className="font-medium text-green-600">
                      {(cohort.clickRate * 100).toFixed(2)}%
                    </span>
                  </p>
                  <p className="text-gray-600">
                    Avg Time to Click: <span className="font-medium">
                      {cohort.avgTimeToClick} min
                    </span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <button
            onClick={fetchStats}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Refresh Data
          </button>
          <button
            onClick={async () => {
              if (confirm('Run send-time analysis now?')) {
                await fetch('/api/cron/send-time-analysis', {
                  headers: { 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET}` }
                })
                alert('Analysis triggered! Refresh in a few seconds.')
              }
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Run Analysis Now
          </button>
        </CardContent>
      </Card>
    </div>
  )
}
