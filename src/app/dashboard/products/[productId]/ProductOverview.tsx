'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Quote } from 'lucide-react'
import type { Product } from '@/lib/types/product'
import { ProductHealthCard } from '@/components/analytics/ProductHealthCard'

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
    // Capitalize first letter and replace hyphens with spaces
    return value.charAt(0).toUpperCase() + value.slice(1).replace(/-/g, ' ')
  }

  const formatUserBase = (value: string | undefined) => {
    if (!value) return 'Not set'
    const map: Record<string, string> = {
      'under-100': '< 100 users',
      '100-1k': '100 - 1,000 users',
      '1k-10k': '1,000 - 10,000 users',
      '10k-100k': '10,000 - 100,000 users',
      '100k-plus': '100,000+ users',
    }
    return map[value] || value
  }

  return (
    <div className="min-h-screen bg-muted/30 py-10">
      <div className="max-w-6xl mx-auto space-y-10">

        {/* =======================
            1. PRODUCT IDENTITY
        ======================== */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            {profile.data.branding?.logo && (
              <div className="relative w-12 h-12 rounded-lg overflow-hidden border bg-white">
                <Image
                  src={profile.data.branding.logo.url}
                  alt={`${product.name} logo`}
                  fill
                  className="object-contain p-1"
                />
              </div>
            )}
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
            label="Product stage"
            value={formatValue(profile.data.context?.productStage)}
          />
          <ContextCard
            label="User base"
            value={formatUserBase(profile.data.context?.userBase)}
          />
        </div>

        {/* =======================
            2.1 HEALTH SCORE & AI SUMMARY
        ======================== */}
        <ProductHealthCard productId={product.id} />

        {/* =======================
            2.5 PRODUCT DETAILS (NEW)
        ======================== */}
        {(profile.data.productDetails?.tagline || 
          profile.data.productDetails?.website ||
          profile.data.branding?.primaryColor) && (
          <Card>
            <CardHeader>
              <CardTitle>Product Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {profile.data.productDetails?.tagline && (
                <div>
                  <p className="text-sm text-muted-foreground">Tagline</p>
                  <p className="text-base font-medium">{profile.data.productDetails.tagline}</p>
                </div>
              )}
              
              {profile.data.productDetails?.description && (
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="text-sm">{profile.data.productDetails.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {profile.data.productDetails?.website && (
                  <div>
                    <p className="text-sm text-muted-foreground">Website</p>
                    <a 
                      href={profile.data.productDetails.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      {profile.data.productDetails.website}
                    </a>
                  </div>
                )}

                {profile.data.branding?.primaryColor && (
                  <div>
                    <p className="text-sm text-muted-foreground">Brand Color</p>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-6 h-6 rounded border"
                        style={{ backgroundColor: profile.data.branding.primaryColor }}
                      />
                      <span className="text-sm font-mono">{profile.data.branding.primaryColor}</span>
                    </div>
                  </div>
                )}
              </div>

              {profile.data.productDetails?.keyFeatures && 
               profile.data.productDetails.keyFeatures.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Key Features</p>
                  <ul className="space-y-1">
                    {profile.data.productDetails.keyFeatures.map((feature, idx) => (
                      <li key={idx} className="text-sm flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {profile.data.primaryGoal && (
                <div>
                  <p className="text-sm text-muted-foreground">Primary Goal</p>
                  <p className="text-sm font-medium">{profile.data.primaryGoal}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* =======================
            2.6 PRODUCT IMAGES
        ======================== */}
        {profile.data.branding?.productImages && 
         profile.data.branding.productImages.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Product Images</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`grid gap-4 ${
                profile.data.branding.productImages.length === 1 ? 'grid-cols-1' :
                profile.data.branding.productImages.length === 2 ? 'grid-cols-2' :
                'grid-cols-3'
              }`}>
                {profile.data.branding.productImages.map((image, index) => (
                  <div
                    key={index}
                    className="relative aspect-video rounded-lg overflow-hidden border bg-white"
                  >
                    <Image
                      src={image.url}
                      alt={image.alt || `Product screenshot ${index + 1}`}
                      fill
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* =======================
            2.7 TESTIMONIALS
        ======================== */}
        {profile.data.context?.testimonials && 
         profile.data.context.testimonials.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Testimonials</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                {profile.data.context.testimonials.map((testimonial, index) => (
                  <div key={index} className="relative border rounded-lg p-4 bg-muted/30">
                    <Quote className="absolute top-4 right-4 w-6 h-6 text-muted-foreground/20" />
                    <blockquote className="space-y-3">
                      <p className="text-sm italic leading-relaxed">
                        "{testimonial.quote}"
                      </p>
                      <footer className="text-xs">
                        <div className="font-semibold">{testimonial.author}</div>
                        {(testimonial.role || testimonial.company) && (
                          <div className="text-muted-foreground">
                            {[testimonial.role, testimonial.company].filter(Boolean).join(', ')}
                          </div>
                        )}
                      </footer>
                    </blockquote>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

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

            <Button asChild>
              <Link href={`/dashboard/products/${product.id}/social`}>
                View Social Listening
              </Link>
            </Button>

            <Button asChild>
              <Link href={`/dashboard/products/${product.id}/profile`}>
                {profile.isComplete
                  ? 'Edit product profile'
                  : 'Complete product profile'}
              </Link>
            </Button>

            <Button asChild className="bg-purple-600 hover:bg-purple-700 text-white">
              <Link href={`/dashboard/products/${product.id}/themes`}>
                AI Themes
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
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs uppercase text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-foreground">
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