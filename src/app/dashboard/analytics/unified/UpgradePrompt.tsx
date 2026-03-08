'use client'

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Lock, ArrowUpRight, Check, Sparkles } from 'lucide-react'
import type { SubscriptionTier } from '@/server/subscriptions/subscriptionService'
import Link from 'next/link'

interface Props {
  title: string
  description: string
  currentTier: SubscriptionTier
  features: string[]
}

export default function UpgradePrompt({ title, description, currentTier, features }: Props) {
  return (
    <Card className="border-2 border-dashed border-muted-foreground/20 bg-muted/10">
      <CardHeader className="text-center pb-4">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
          <Lock className="w-6 h-6 text-primary" />
        </div>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription className="text-base">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Features list */}
        <div className="space-y-3">
          {features.map((feature, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="w-3 h-3 text-green-600" />
              </div>
              <p className="text-sm text-muted-foreground">{feature}</p>
            </div>
          ))}
        </div>

        {/* CTA — links to full pricing page */}
        <div className="text-center pt-4 border-t space-y-3">
          <Button size="lg" className="gap-2" asChild>
            <Link href="/dashboard/pricing">
              <Sparkles className="w-4 h-4" />
              {currentTier === 'free' ? 'View Plans & Pricing' : 'Upgrade Plan'}
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            You’re currently on the <strong>{currentTier}</strong> plan.
            {currentTier === 'free' && ' Pro starts at $79/mo — includes 1,000 min transcription.'}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
