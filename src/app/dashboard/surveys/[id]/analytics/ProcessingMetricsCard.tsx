'use client'

import { ProcessingMetrics } from '@/server/surveys/analyticsService'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Mic, Video, TrendingUp, AlertCircle, CheckCircle, Clock } from 'lucide-react'

type Props = {
  metrics: ProcessingMetrics
}

export default function ProcessingMetricsCard({ metrics }: Props) {
  const formatSuccessRate = (rate: number) => {
    return rate.toFixed(1) + '%'
  }

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 90) return 'text-green-600'
    if (rate >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Audio Processing Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="w-5 h-5" />
            Audio Processing Metrics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Success Rate</span>
            <span className={`text-2xl font-bold ${getSuccessRateColor(metrics.audio.successRate)}`}>
              {formatSuccessRate(metrics.audio.successRate)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="w-4 h-4 text-green-600" />
                Ready
              </div>
              <div className="text-2xl font-bold">{metrics.audio.ready}</div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="w-4 h-4 text-red-600" />
                Failed
              </div>
              <div className="text-2xl font-bold">{metrics.audio.failed}</div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4 text-blue-600" />
                Processing
              </div>
              <div className="text-2xl font-bold">{metrics.audio.processing}</div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="w-4 h-4 text-gray-600" />
                Uploaded
              </div>
              <div className="text-2xl font-bold">{metrics.audio.uploaded}</div>
            </div>
          </div>

          <div className="pt-2 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total Audio Files</span>
              <Badge variant="outline" className="font-mono">{metrics.audio.total}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Video Processing Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="w-5 h-5" />
            Video Processing Metrics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Success Rate</span>
            <span className={`text-2xl font-bold ${getSuccessRateColor(metrics.video.successRate)}`}>
              {formatSuccessRate(metrics.video.successRate)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="w-4 h-4 text-green-600" />
                Ready
              </div>
              <div className="text-2xl font-bold">{metrics.video.ready}</div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="w-4 h-4 text-red-600" />
                Failed
              </div>
              <div className="text-2xl font-bold">{metrics.video.failed}</div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4 text-blue-600" />
                Processing
              </div>
              <div className="text-2xl font-bold">{metrics.video.processing}</div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="w-4 h-4 text-gray-600" />
                Uploaded
              </div>
              <div className="text-2xl font-bold">{metrics.video.uploaded}</div>
            </div>
          </div>

          <div className="pt-2 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total Video Files</span>
              <Badge variant="outline" className="font-mono">{metrics.video.total}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
