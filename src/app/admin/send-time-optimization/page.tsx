'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface SendTimeStats {
  hour: number
  emailsSent: number
  emailsClicked: number
  clickRate: number
  avgTimeToClick: number | null
}

interface DemographicStats {
  segmentType: string
  segmentValue: string
  emailsSent: number
  clickRate: number
  optimalSendHour: number | null
}

interface AnalysisResults {
  variance: number
  optimizationEnabled: boolean
  recommendation: string
  hourlyStats: SendTimeStats[]
  demographicStats: DemographicStats[]
}

export default function SendTimeOptimizationDashboard() {
  const [stats, setStats] = useState<AnalysisResults | null>(null)
  const [loading, setLoading] = useState(true)
  const [runningAnalysis, setRunningAnalysis] = useState(false)

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    try {
      const res = await fetch('/api/admin/send-time-stats')
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoading(false)
    }
  }

  async function runAnalysis() {
    setRunningAnalysis(true)
    try {
      const res = await fetch('/api/admin/run-send-time-analysis', {
        method: 'POST',
      })
      if (res.ok) {
        await loadStats()
      }
    } catch (error) {
      console.error('Error running analysis:', error)
    } finally {
      setRunningAnalysis(false)
    }
  }

  if (loading) {
    return <div className="p-8">Loading send-time analytics...</div>
  }

  if (!stats) {
    return (
      <div className="p-8">
        <Card>
          <CardHeader>
            <CardTitle>Send-Time Optimization</CardTitle>
            <CardDescription>
              Insufficient data for analysis. Send at least 100 emails across multiple hours.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const variance = stats.variance * 100
  const thresholdColor = 
    variance > 30 ? 'text-green-600' : 
    variance < 15 ? 'text-blue-600' : 
    'text-yellow-600'

  return (
    <div className="container mx-auto p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Send-Time Optimization Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Analyze email engagement by send time and demographics
          </p>
        </div>
        <Button onClick={runAnalysis} disabled={runningAnalysis}>
          {runningAnalysis ? 'Running Analysis...' : 'Run Analysis Now'}
        </Button>
      </div>

      {/* Overall Status */}
      <Card>
        <CardHeader>
          <CardTitle>Optimization Status</CardTitle>
          <CardDescription>
            Click-rate variance across send times
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold">{variance.toFixed(1)}%</span>
              <span className="text-gray-500">variance</span>
            </div>
            
            <div className={`text-lg font-medium ${thresholdColor}`}>
              {stats.optimizationEnabled ? '✅ OPTIMIZATION ENABLED' : '⏸️ OPTIMIZATION DISABLED'}
            </div>
            
            <p className="text-gray-700 text-sm border-l-4 border-blue-500 pl-4 py-2">
              {stats.recommendation}
            </p>

            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="border rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">
                  &gt;30%
                </div>
                <div className="text-sm text-gray-600">
                  Enable optimization (high variance)
                </div>
              </div>
              
              <div className="border rounded-lg p-4">
                <div className="text-2xl font-bold text-yellow-600">
                  15-30%
                </div>
                <div className="text-sm text-gray-600">
                  Monitor (moderate variance)
                </div>
              </div>
              
              <div className="border rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">
                  &lt;15%
                </div>
                <div className="text-sm text-gray-600">
                  Random timing OK (low variance)
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hourly Click Rates */}
      <Card>
        <CardHeader>
          <CardTitle>Click Rates by Hour</CardTitle>
          <CardDescription>
            Engagement metrics for each hour of the day
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats.hourlyStats
              .filter(h => h.emailsSent >= 10)
              .sort((a, b) => b.clickRate - a.clickRate)
              .map((hourData) => (
                <div key={hourData.hour} className="flex items-center gap-4 p-3 border rounded-lg hover:bg-gray-50">
                  <div className="w-16 text-sm font-medium">
                    {hourData.hour}:00
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div 
                        className="h-6 bg-blue-500 rounded" 
                        style={{ width: `${hourData.clickRate * 100}%` }}
                      />
                      <span className="text-sm font-bold">
                        {(hourData.clickRate * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {hourData.emailsSent} emails • {hourData.emailsClicked} clicks
                      {hourData.avgTimeToClick && ` • ${hourData.avgTimeToClick.toFixed(0)}min avg`}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Demographic Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Demographic Segment Performance</CardTitle>
          <CardDescription>
            Click rates by industry, age, and income
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Group by segment type */}
            {['industry', 'age', 'income'].map((segmentType) => {
              const segments = stats.demographicStats.filter(
                d => d.segmentType === segmentType && d.emailsSent >= 20
              )
              
              if (segments.length === 0) return null
              
              return (
                <div key={segmentType}>
                  <h3 className="font-semibold mb-3 capitalize">{segmentType}</h3>
                  <div className="space-y-2">
                    {segments
                      .sort((a, b) => b.clickRate - a.clickRate)
                      .map((seg) => (
                        <div key={seg.segmentValue} className="flex items-center gap-4 p-3 border rounded-lg">
                          <div className="w-32 text-sm font-medium truncate">
                            {seg.segmentValue}
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <div 
                                className="h-5 bg-green-500 rounded" 
                                style={{ width: `${seg.clickRate * 100}%` }}
                              />
                              <span className="text-sm font-bold">
                                {(seg.clickRate * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div className="text-xs text-gray-500">
                              {seg.emailsSent} emails
                              {seg.optimalSendHour !== null && (
                                <span className="ml-2">• Best time: {seg.optimalSendHour}:00</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Testing Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-gray-700">
          <div>
            <h4 className="font-semibold mb-2">📊 Data Collection</h4>
            <p>Every email sent is tracked with send time, demographics, and engagement metrics (opens, clicks, conversions).</p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2">🧪 A/B Testing</h4>
            <p>Users are assigned to cohorts (morning, lunch, afternoon, evening, night, control) for testing different send times.</p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2">📈 Daily Analysis</h4>
            <p>
              Runs daily at 3am UTC to calculate:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Click rates by hour of day</li>
              <li>Variance across send times</li>
              <li>Optimal send times for demographic segments</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2">🎯 Decision Logic</h4>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Variance &gt;30%:</strong> Enable optimization - personalized send times will improve engagement</li>
              <li><strong>Variance 15-30%:</strong> Monitor - collect more data before deciding</li>
              <li><strong>Variance &lt;15%:</strong> Random timing is fine - no optimization needed</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2">💡 Minimum Requirements</h4>
            <ul className="list-disc pl-6 space-y-1">
              <li>At least 100 emails per hour for statistical significance</li>
              <li>At least 3 hours with 100+ emails for variance calculation</li>
              <li>At least 20 emails per demographic segment for segment analysis</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
