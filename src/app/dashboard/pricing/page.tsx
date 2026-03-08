import { auth } from '@/lib/auth/auth.config'
import { redirect } from 'next/navigation'
import { getBrandSubscription, getTierDisplayName } from '@/server/subscriptions/subscriptionService'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Check, X, ArrowUpRight, Zap, Shield, Building2, Crown,
  BarChart3, Mic, Video, Image as ImageIcon, Download, Filter,
  Globe, Users, Webhook, Info, Clock, HardDrive
} from 'lucide-react'
import Link from 'next/link'

// ============================================================================
// COST-DRIVEN PRICING MODEL
// ============================================================================
//
// The pricing below is derived from Appendix A of ARCHITECTURE.md:
//
// CAPEX / OPEX drivers per brand:
//   - Vercel Pro hosting: ~$20/mo base (shared across all brands)
//   - Neon DB: ~$19/mo (shared, scales with usage)
//   - Vercel Blob storage: $0.023/GB/mo
//   - OpenAI Whisper STT: $0.006/min transcription
//   - Resend email: $0/mo first 3k, then $20/mo
//   - Twilio SMS/WhatsApp: ~$0.01/msg
//   - Domain + SSL: ~$15/yr
//
// Per-brand variable cost:
//   Free:       ~$0.50/mo (DB rows + minimal blob storage)
//   Pro:        ~$6-$15/mo at 1000 min transcription + 50GB blob
//   Enterprise: ~$60-$150/mo at scale
//
// Value proposition markups:
//   Pro:        3-5x variable cost → $49-$99/mo retail
//   Enterprise: 2-3x variable cost → $299+/mo retail
//
// Annual discount: ~17% (2 months free) — standard SaaS practice
// ============================================================================

type PlanId = 'free' | 'pro' | 'enterprise'

interface PricingPlan {
  id: PlanId
  name: string
  tagline: string
  monthlyPrice: number | null // null = custom
  annualMonthlyPrice: number | null // null = custom
  icon: typeof Zap
  highlighted: boolean
  ctaLabel: string
  ctaVariant: 'default' | 'outline' | 'secondary'
  features: Array<{
    label: string
    included: boolean
    detail?: string
  }>
  limits: {
    products: string
    transcription: string
    storage: string
    retention: string
    exports: string
  }
  valueProps: string[]
}

const PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Collect text feedback on 1 product — see if customers care before you invest',
    monthlyPrice: 0,
    annualMonthlyPrice: 0,
    icon: Zap,
    highlighted: false,
    ctaLabel: 'Current Plan',
    ctaVariant: 'outline',
    features: [
      { label: 'Aggregate NPS score, sentiment split, and feedback volume per product', included: true },
      { label: 'Trend charts: weekly sentiment and volume over time', included: true },
      { label: 'Text + image feedback collection from consumers', included: true, detail: 'Images stored only — no OCR' },
      { label: 'Weekly Top 10 product rankings in your category', included: true },
      { label: 'Basic keyword sentiment analysis on all text', included: true },
      { label: 'Automatic language detection + English translation', included: true, detail: 'For text feedback' },
      { label: 'Read individual feedback responses', included: false, detail: 'Aggregate counts only' },
      { label: 'Audio feedback collection & transcription', included: false },
      { label: 'Video feedback collection & transcription', included: false },
      { label: 'Play/download audio, video, or full-res images', included: false },
      { label: 'Export feedback data (CSV / JSON)', included: false },
      { label: 'Advanced filters (by sentiment, modality, date range)', included: false },
      { label: 'API or webhook access', included: false },
    ],
    limits: {
      products: '1 product',
      transcription: 'None — text only',
      storage: 'Up to 2 GB (images)',
      retention: '30 days for images',
      exports: 'Not available',
    },
    valueProps: [
      'Test whether customers will actually leave feedback on your product',
      'See your NPS score and sentiment breakdown without spending a dollar',
      'Enough to decide whether to invest in a full feedback program',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Read, listen to, and export every piece of customer feedback across up to 10 products',
    monthlyPrice: 79,
    annualMonthlyPrice: 66,
    icon: Crown,
    highlighted: true,
    ctaLabel: 'Upgrade to Pro',
    ctaVariant: 'default',
    features: [
      { label: 'Everything in Free, plus:', included: true },
      { label: 'Read full text of every individual feedback response', included: true },
      { label: 'Consumers can record audio feedback (up to 60 sec per clip)', included: true, detail: 'Auto-transcribed via OpenAI Whisper' },
      { label: 'Consumers can record video feedback (up to 90 sec per clip)', included: true, detail: 'Audio track extracted & transcribed' },
      { label: 'View all attached images in full resolution', included: true },
      { label: 'Play audio recordings and watch video submissions in-dashboard', included: true },
      { label: 'Download individual media files for internal review', included: true },
      { label: 'AI-generated transcripts with detected language + English translation', included: true },
      { label: 'Export all feedback to CSV or JSON', included: true, detail: 'Up to 100 exports/month' },
      { label: 'Filter by sentiment, modality, rating, language, date range', included: true },
      { label: 'See consumer name, email, and submission metadata', included: true },
      { label: 'Priority transcription queue (processed before Free tier)', included: true },
      { label: 'Multimodal quality scoring for each submission', included: true },
      { label: 'Programmatic API access', included: false, detail: 'Enterprise only' },
      { label: 'Webhook event streaming', included: false, detail: 'Enterprise only' },
    ],
    limits: {
      products: 'Up to 10 products',
      transcription: '1,000 min/month included',
      storage: 'Up to 50 GB/month uploads',
      retention: '60 days raw media, transcripts kept forever',
      exports: 'Up to 100 exports/month',
    },
    valueProps: [
      'Read the exact words customers say — not just a score',
      'Audio clips let you hear tone, emotion, and nuance that text misses',
      'Export data to share with product, design, and leadership teams',
      'One dashboard for text, audio, video, and image feedback across 10 products',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Integrate customer feedback into your existing BI, CRM, and product workflows at scale',
    monthlyPrice: null,
    annualMonthlyPrice: null,
    icon: Building2,
    highlighted: false,
    ctaLabel: 'Contact Sales',
    ctaVariant: 'outline',
    features: [
      { label: 'Everything in Pro, plus:', included: true },
      { label: 'Unlimited products — no cap on catalog size', included: true },
      { label: 'REST API: query feedback, transcripts, analytics programmatically', included: true },
      { label: 'Webhooks: real-time events on new feedback, transcription complete, etc.', included: true },
      { label: 'Custom / pooled transcription quotas across products', included: true, detail: '10,000+ min/month' },
      { label: 'Extended media retention: 90 days+ or BYO external storage', included: true },
      { label: 'Unlimited CSV & JSON exports', included: true },
      { label: 'Dedicated account manager + onboarding', included: true },
      { label: 'Volume-based or negotiated per-minute transcription rate', included: true },
      { label: 'Custom branding on consumer-facing survey pages', included: true, detail: 'Roadmap' },
      { label: 'SSO / SAML single sign-on for your team', included: true, detail: 'Roadmap' },
      { label: 'Uptime SLA: 99.9% availability guarantee', included: true },
    ],
    limits: {
      products: 'Unlimited',
      transcription: '10,000+ min/month (custom)',
      storage: '500 GB+/month (custom)',
      retention: '90 days+ (negotiable / BYO)',
      exports: 'Unlimited',
    },
    valueProps: [
      'Pipe every piece of feedback into Salesforce, Snowflake, or your BI tool via API',
      'Process thousands of audio/video responses per month across your full catalog',
      'Negotiated rates that drop as volume grows — no surprise per-minute charges',
      'Dedicated support with SLA for teams that depend on feedback data daily',
    ],
  },
]

export default async function PricingPage() {
  const session = await auth()
  if (!session) redirect('/auth/signin')

  const userId = session.user?.id
  if (!userId) redirect('/auth/signin')

  const subscription = await getBrandSubscription(userId)
  const currentTier = subscription.tier

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <Badge variant="outline" className="mb-4">
          Current plan: {getTierDisplayName(currentTier)}
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight mb-3">
          Plans & Pricing
        </h1>
        <p className="text-lg text-muted-foreground">
          Choose the plan that matches how deeply you want to understand your customers.
          Every plan includes unlimited consumer responses — you only pay for the intelligence layer.
        </p>
      </div>

      {/* Annual toggle note */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          <Clock className="w-4 h-4 inline mr-1" />
          Annual billing saves ~17% (2 months free).
          All prices shown are monthly.
        </p>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {PLANS.map((plan) => {
          const isCurrent = currentTier === plan.id
          const Icon = plan.icon

          return (
            <Card
              key={plan.id}
              className={`relative flex flex-col ${
                plan.highlighted
                  ? 'border-2 border-primary shadow-lg scale-[1.02]'
                  : 'border border-border'
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-3 py-1">
                    Most Popular
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center pb-4 pt-6">
                <div className={`w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center ${
                  plan.highlighted ? 'bg-primary/10' : 'bg-muted'
                }`}>
                  <Icon className={`w-6 h-6 ${plan.highlighted ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.tagline}</CardDescription>

                {/* Price */}
                <div className="pt-4">
                  {plan.monthlyPrice !== null ? (
                    <div>
                      <span className="text-4xl font-bold">${plan.monthlyPrice}</span>
                      <span className="text-muted-foreground">/mo</span>
                      {plan.annualMonthlyPrice !== null && plan.annualMonthlyPrice < plan.monthlyPrice && (
                        <p className="text-sm text-green-600 mt-1">
                          ${plan.annualMonthlyPrice}/mo billed annually
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <span className="text-3xl font-bold">Custom</span>
                      <p className="text-sm text-muted-foreground mt-1">
                        Starting at $299/mo
                      </p>
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="flex-1 space-y-6">
                {/* Value Propositions */}
                <div className="space-y-2 pb-4 border-b">
                  {plan.valueProps.map((prop, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Zap className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm font-medium">{prop}</span>
                    </div>
                  ))}
                </div>

                {/* Features */}
                <div className="space-y-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Features
                  </p>
                  {plan.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      {feature.included ? (
                        <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      ) : (
                        <X className="w-4 h-4 text-muted-foreground/50 mt-0.5 flex-shrink-0" />
                      )}
                      <div>
                        <span className={`text-sm ${feature.included ? '' : 'text-muted-foreground/60'}`}>
                          {feature.label}
                        </span>
                        {feature.detail && (
                          <span className="text-xs text-muted-foreground ml-1">
                            — {feature.detail}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Limits */}
                <div className="space-y-2 pt-4 border-t">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Limits & Quotas
                  </p>
                  <LimitRow icon={<BarChart3 className="w-3.5 h-3.5" />} label="Products" value={plan.limits.products} />
                  <LimitRow icon={<Mic className="w-3.5 h-3.5" />} label="Transcription" value={plan.limits.transcription} />
                  <LimitRow icon={<HardDrive className="w-3.5 h-3.5" />} label="Upload" value={plan.limits.storage} />
                  <LimitRow icon={<Clock className="w-3.5 h-3.5" />} label="Retention" value={plan.limits.retention} />
                  <LimitRow icon={<Download className="w-3.5 h-3.5" />} label="Exports" value={plan.limits.exports} />
                </div>

                {/* CTA */}
                <div className="pt-4">
                  {isCurrent ? (
                    <Button variant="outline" className="w-full" disabled>
                      <Check className="w-4 h-4 mr-2" />
                      Current Plan
                    </Button>
                  ) : plan.id === 'enterprise' ? (
                    <Button variant={plan.ctaVariant as any} className="w-full" asChild>
                      <a href="mailto:sales@earn4insights.com?subject=Enterprise%20Plan%20Inquiry">
                        {plan.ctaLabel}
                        <ArrowUpRight className="w-4 h-4 ml-2" />
                      </a>
                    </Button>
                  ) : (
                    <Button
                      variant={plan.ctaVariant as any}
                      className={`w-full ${plan.highlighted ? 'bg-primary hover:bg-primary/90' : ''}`}
                      asChild
                    >
                      <Link href="/dashboard/settings">
                        {plan.ctaLabel}
                        <ArrowUpRight className="w-4 h-4 ml-2" />
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* FAQ / Notes */}
      <div className="max-w-3xl mx-auto space-y-6 pt-8">
        <h2 className="text-2xl font-bold text-center">Frequently Asked Questions</h2>

        <FaqItem
          question="What happens when I exceed my transcription quota?"
          answer="New audio/video uploads will be paused until your next billing cycle. Text and image feedback continue uninterrupted. You can upgrade your plan anytime to increase your quota."
        />
        <FaqItem
          question="Do consumers pay anything?"
          answer="No. Consumers always submit feedback for free — they earn rewards for quality responses. Brands pay for the analytics and intelligence layer on top."
        />
        <FaqItem
          question="What's included in transcription minutes?"
          answer="Every audio clip and video's audio track is transcribed by OpenAI Whisper with automatic language detection and English translation. A 30-second voice clip uses 0.5 minutes of quota."
        />
        <FaqItem
          question="What happens to my data after the retention period?"
          answer="Raw media files (audio/video/images) are automatically deleted from storage. Transcripts, sentiment scores, and all analytics data are kept permanently — you never lose insights."
        />
        <FaqItem
          question="Can I switch plans mid-cycle?"
          answer="Yes. Upgrades take effect immediately with prorated billing. Downgrades take effect at the end of your current billing period."
        />
        <FaqItem
          question="Is there a free trial for Pro?"
          answer="Yes — contact us for a 14-day Pro trial. All features unlocked, no credit card required."
        />
      </div>

      {/* Cost transparency note */}
      <div className="max-w-2xl mx-auto text-center pt-4 pb-8">
        <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
          <Info className="w-3.5 h-3.5" />
          Pricing is based on actual infrastructure costs (transcription, storage, compute)
          plus a fair margin to sustain development. No hidden fees.
        </p>
      </div>
    </div>
  )
}

function LimitRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="border rounded-lg p-4">
      <h3 className="font-semibold text-sm mb-2">{question}</h3>
      <p className="text-sm text-muted-foreground">{answer}</p>
    </div>
  )
}
