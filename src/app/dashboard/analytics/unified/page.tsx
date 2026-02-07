import { requireAuth } from '@/server/auth/authHelpers'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MessageSquare, Mic, Video, TrendingUp, Lock, ArrowUpRight } from 'lucide-react'
import { getUnifiedMetricsForBrand, getUnifiedFeedbackForBrand } from '@/server/analytics/unifiedAnalyticsService'
import { getBrandSubscription, getTierDisplayName } from '@/server/subscriptions/subscriptionService'
import Link from 'next/link'
import UnifiedFeedbackList from './UnifiedFeedbackList'
import UpgradePrompt from './UpgradePrompt'

/**
 * Unified Analytics Dashboard
 * 
 * Aggregates feedback from ALL sources (surveys, direct feedback, future: reviews, social)
 * Demonstrates tier-based access control
 * 
 * FREE tier: Aggregate metrics only
 * PRO tier: Individual feedback access
 */

interface PageProps {
  searchParams: { [key: string]: string | string[] | undefined }
}

export default async function UnifiedAnalyticsPage({ searchParams }: PageProps) {
  const session = await auth()
  
  if (!session) {
    redirect('/auth/signin')
  }

  const userId = session.user?.id
  if (!userId) {
    redirect('/auth/signin')
  }
  
  // Get brand subscription
  const subscription = await getBrandSubscription(userId)
  
  // Get brand's products
  // TODO: Add brand ownership link - for now showing all products (demo)
  const brandProducts = await db
    .select({ id: products.id })
    .from(products)
    .limit(10)
  
  const productIds = brandProducts.map(p => p.id)
  
  if (productIds.length === 0) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Unified Analytics</h1>
            <p className="text-muted-foreground mt-1">
              All feedback sources in one place
            </p>
          </div>
          <Badge variant="outline" className="text-sm">
            {getTierDisplayName(subscription.tier)}
          </Badge>
        </div>
        
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No products yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first product to start collecting feedback
              </p>
              <Button asChild>
                <Link href="/dashboard/products/new">Create Product</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Apply filters from search params
  const dateFrom = searchParams.dateFrom 
    ? new Date(searchParams.dateFrom as string) 
    : undefined
  const dateTo = searchParams.dateTo 
    ? new Date(searchParams.dateTo as string) 
    : undefined

  // Fetch unified metrics (always available)
  const metrics = await getUnifiedMetricsForBrand(productIds, {
    dateFrom,
    dateTo,
  })

  // Fetch individual feedback only if allowed
  let feedbackItems: any[] = []
  if (subscription.features.canViewIndividual) {
    feedbackItems = await getUnifiedFeedbackForBrand(productIds, {
      dateFrom,
      dateTo,
      limit: 50,
    })
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Unified Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Feedback from surveys, direct submissions, and more
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          {getTierDisplayName(subscription.tier)}
        </Badge>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Feedback
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.totalFeedback}</div>
            <p className="text-xs text-muted-foreground mt-1">
              All sources combined
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Survey Responses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.bySource.survey}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.totalFeedback > 0
                ? ((metrics.bySource.survey / metrics.totalFeedback) * 100).toFixed(1)
                : 0}
              % of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Direct Feedback
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.bySource.feedback}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.totalFeedback > 0
                ? ((metrics.bySource.feedback / metrics.totalFeedback) * 100).toFixed(1)
                : 0}
              % of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Sentiment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-green-600">Positive</span>
                <span className="font-semibold">{metrics.bySentiment.positive}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-yellow-600">Neutral</span>
                <span className="font-semibold">{metrics.bySentiment.neutral}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-red-600">Negative</span>
                <span className="font-semibold">{metrics.bySentiment.negative}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modality Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Feedback by Type</CardTitle>
          <CardDescription>
            How customers are sharing their feedback
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <MessageSquare className="w-8 h-8 mx-auto text-blue-500 mb-2" />
              <div className="text-2xl font-bold">{metrics.byModality.text}</div>
              <p className="text-xs text-muted-foreground">Text</p>
            </div>
            <div className="text-center">
              <Mic className="w-8 h-8 mx-auto text-purple-500 mb-2" />
              <div className="text-2xl font-bold">{metrics.byModality.audio}</div>
              <p className="text-xs text-muted-foreground">Audio</p>
            </div>
            <div className="text-center">
              <Video className="w-8 h-8 mx-auto text-pink-500 mb-2" />
              <div className="text-2xl font-bold">{metrics.byModality.video}</div>
              <p className="text-xs text-muted-foreground">Video</p>
            </div>
            <div className="text-center">
              <svg className="w-8 h-8 mx-auto text-amber-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <div className="text-2xl font-bold">{metrics.byModality.image}</div>
              <p className="text-xs text-muted-foreground">Image</p>
            </div>
            <div className="text-center">
              <div className="w-8 h-8 mx-auto mb-2 flex items-center justify-center text-green-500">
                <span className="text-2xl">📊</span>
              </div>
              <div className="text-2xl font-bold">{metrics.byModality.mixed}</div>
              <p className="text-xs text-muted-foreground">Mixed</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual Feedback Section */}
      {subscription.features.canViewIndividual ? (
        <Card>
          <CardHeader>
            <CardTitle>Individual Feedback</CardTitle>
            <CardDescription>
              View detailed feedback from all sources
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UnifiedFeedbackList items={feedbackItems} />
          </CardContent>
        </Card>
      ) : (
        <UpgradePrompt
          title="Unlock Individual Feedback"
          description="Upgrade to Pro to view detailed feedback, play audio/video, and export data"
          currentTier={subscription.tier}
          features={[
            'View full feedback text and transcripts',
            'Play audio and video recordings',
            'See customer contact details',
            'Export all data to CSV',
            'Advanced filters and search',
          ]}
        />
      )}
    </div>
  )
}
