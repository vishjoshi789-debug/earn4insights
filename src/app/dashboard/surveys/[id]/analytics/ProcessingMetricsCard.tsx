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

      {/* Image Uploads - Phase 3.5 */}
      {metrics.image.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Image Uploads
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total Images</span>
              <span className="text-2xl font-bold">{metrics.image.total}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Images are stored directly without processing (no STT required)
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
