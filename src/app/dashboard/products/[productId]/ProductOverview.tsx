'use client'

import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Product } from '@/lib/types/product'

export default function ProductOverview({
  product,
}: {
  product: Product
}) {
  // ✅ Safety check - provide default profile if missing
  const profile = product.profile || {
    currentStep: 1,
    isComplete: false,
    data: {}
  }

  // Helper to format profile values
  const formatValue = (value: string | undefined) => {
    if (!value) return 'Not set'
    // Capitalize first letter
    return value.charAt(0).toUpperCase() + value.slice(1)
  }

  return (
    <div className="min-h-screen bg-muted/30 py-10">
      <div className="max-w-6xl mx-auto space-y-10">

        {/* =======================
            1. PRODUCT IDENTITY
        ======================== */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{product.name}</h1>
            <Badge variant="secondary">LIVE</Badge>
          </div>

          <p className="text-muted-foreground max-w-2xl">
            {product.description || 'No description added yet.'}
          </p>
        </div>

        {/* =======================
            2. PRODUCT CONTEXT
        ======================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ContextCard
            label="Product type"
            value={formatValue(profile.data.productType)}
          />
          <ContextCard
            label="Audience"
            value={formatValue(profile.data.audienceType)}
          />
          <ContextCard
            label="Maturity"
            value="Not set"
          />
          <ContextCard
            label="Primary goal"
            value={profile.data.primaryGoal || 'Not set'}
          />
        </div>

        {/* =======================
            3. ENABLED FEATURES
        ======================== */}
        <Card>
          <CardHeader>
            <CardTitle>Enabled features</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FeatureCard title="NPS" enabled={product.features.nps} />
            <FeatureCard title="Feedback" enabled={product.features.feedback} />
            <FeatureCard
              title="Social listening"
              enabled={product.features.social_listening}
            />
          </CardContent>
        </Card>

        {/* =======================
            4. NEXT ACTIONS
        ======================== */}
        <Card>
          <CardHeader>
            <CardTitle>Next steps</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col md:flex-row gap-3">
            <Button asChild>
              <Link href={`/dashboard/products/${product.id}/nps`}>
                View NPS
              </Link>
            </Button>

            <Button asChild variant="outline">
              <Link href={`/dashboard/products/${product.id}/feedback`}>
                View Feedback
              </Link>
            </Button>

            <Button asChild variant="secondary">
              <Link href={`/dashboard/products/${product.id}/social`}>
                View Social Listening
              </Link>
            </Button>

            <Button asChild variant="secondary">
              <Link href={`/dashboard/products/${product.id}/profile`}>
                {profile.isComplete
                  ? 'Edit product profile'
                  : 'Complete product profile'}
              </Link>
            </Button>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}

/* =======================
   SMALL UI HELPERS
======================= */

function ContextCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="text-xs uppercase text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium">
        {value}
      </div>
    </div>
  )
}

function FeatureCard({
  title,
  enabled,
}: {
  title: string
  enabled: boolean
}) {
  return (
    <div className="border rounded-lg p-4">
      <div className="text-sm font-medium">{title}</div>
      <div
        className={`mt-1 text-sm ${
          enabled ? 'text-green-600' : 'text-gray-400'
        }`}
      >
        {enabled ? 'Enabled' : 'Disabled'}
      </div>
    </div>
  )
}