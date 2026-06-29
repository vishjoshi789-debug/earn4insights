import Link from 'next/link'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { HeroCtas, SectionCta } from '@/components/landing-ctas'
import {
  ArrowRight,
  Activity,
  Award,
  BarChart3,
  Bell,
  Brain,
  Building2,
  ClipboardCheck,
  ClipboardList,
  Download,
  FileText,
  Flame,
  Globe,
  HandCoins,
  HelpCircle,
  KeyRound,
  Megaphone,
  MessageSquare,
  MessagesSquare,
  Package,
  PackagePlus,
  PenSquare,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Tags,
  Target,
  TrendingUp,
  Trophy,
  Upload,
  UserCheck,
  Users,
  Video,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react'

/**
 * Small inline badge for features we show as part of the vision but that
 * aren't live at beta launch (shipping post-launch / after the free beta
 * window). Lets us list the full roadmap honestly without implying
 * everything works on day one.
 *
 * Founder note: flip a feature's `comingSoon` flag in the arrays below as
 * it goes live. Reword the label here in one place.
 */
function ComingSoon() {
  return (
    <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 align-middle text-[10px] font-medium text-amber-600 ring-1 ring-amber-500/20">
      Coming soon
    </span>
  )
}

type Audience = 'brand' | 'consumer' | 'influencer'

interface Feature {
  icon: LucideIcon
  title: string
  description: string
  /** Marks a feature that isn't live at beta launch yet. */
  comingSoon?: boolean
}

// Full static class strings per audience (Tailwind can't see interpolated
// class names, so each variant lists complete utilities).
const THEME: Record<
  Audience,
  { card: string; iconWrap: string; icon: string; cta: string; ctaLabel: string; ctaHref: string }
> = {
  brand: {
    card: 'border-primary/20 bg-card/50 backdrop-blur shadow-sm hover:shadow-md hover:border-primary/40 transition-all',
    iconWrap: 'flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20',
    icon: 'h-5 w-5 text-primary',
    cta: 'mt-3 inline-flex items-center gap-1 text-xs text-primary/70 hover:text-primary font-medium transition-colors',
    ctaLabel: 'Book a Demo',
    ctaHref: '/contact-us',
  },
  consumer: {
    card: 'border-accent/20 bg-card/50 backdrop-blur shadow-sm hover:shadow-md hover:border-accent/40 transition-all',
    iconWrap: 'flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 ring-1 ring-accent/20',
    icon: 'h-5 w-5 text-accent',
    cta: 'mt-3 inline-flex items-center gap-1 text-xs text-accent/70 hover:text-accent font-medium transition-colors',
    ctaLabel: 'Learn More',
    // Public page so logged-in users (any role) browsing another audience's
    // features aren't bounced to their dashboard by the middleware /signup
    // redirect-if-authed. The big section button below is the signup CTA.
    ctaHref: '/contact-us',
  },
  influencer: {
    card: 'border-violet-500/20 bg-card/50 backdrop-blur shadow-sm hover:shadow-md hover:border-violet-500/40 transition-all',
    iconWrap: 'flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 ring-1 ring-violet-500/20',
    icon: 'h-5 w-5 text-violet-600',
    cta: 'mt-3 inline-flex items-center gap-1 text-xs text-violet-600/70 hover:text-violet-600 font-medium transition-colors',
    ctaLabel: 'Learn More',
    ctaHref: '/contact-us',
  },
}

// ── Feature catalogues ──────────────────────────────────────────────────────
// Each card maps to a real platform capability (see the dashboard sidebar in
// src/app/dashboard/DashboardShell.tsx). `comingSoon: true` = not live at beta.

const BRAND_FEATURES: Feature[] = [
  { icon: MessageSquare, title: 'Feedback Hub', description: 'All consumer feedback in one place — text, audio, and video with AI-powered sentiment analysis.' },
  { icon: BarChart3, title: 'Surveys & NPS', description: 'Create targeted surveys and track Net Promoter Score to measure customer satisfaction.' },
  { icon: TrendingUp, title: 'Audience Analytics', description: 'Know who your customers are — demographics, behavior patterns, and preferences at a glance.' },
  { icon: Activity, title: 'Feature Insights', description: 'See which features delight users and which need work — backed by real feedback data.' },
  { icon: Brain, title: 'Consumer Intelligence', description: 'Understand how different user segments feel about your product and why.' },
  { icon: FileText, title: 'Product Deep Dive', description: 'In-depth analytics per product — sentiment trends, scores, and detailed feedback breakdowns.' },
  { icon: Bell, title: 'Weekly Digest', description: 'Automated weekly summary of new feedback, score changes, and emerging trends.' },
  { icon: Trophy, title: 'Rankings & Alerts', description: 'Track your weekly category ranking and get instant alerts on position changes.' },
  { icon: Target, title: 'ICP Builder', description: 'Define your Ideal Consumer Profile with weighted criteria — the platform auto-scores every consumer against it daily.' },
  { icon: Megaphone, title: 'Influencer Campaigns', description: 'Create campaigns, set budgets, define deliverables, and manage milestone-based escrow payments — all in one dashboard.' },
  { icon: ClipboardCheck, title: 'Content Review', description: 'Review and approve influencer content against your brief before it goes live.' },
  { icon: Tags, title: 'Deals & Offers', description: 'Publish deals and offers to consumers and track redemptions.' },
  { icon: PackagePlus, title: 'Launch Products', description: 'Add products and start collecting feedback in minutes — or schedule a launch for later.' },
  { icon: Upload, title: 'Import Data', description: 'Bring existing feedback from Google Forms, Typeform, or SurveyMonkey — no re-collection needed.' },
  { icon: MessagesSquare, title: 'Community', description: 'Engage with your audience directly — join conversations, share updates, and see what consumers are talking about.' },
  { icon: Users, title: 'Social', description: 'Monitor social discussions around your products and track consumer sentiment publicly.', comingSoon: true },
  { icon: Globe, title: 'Category Intelligence', description: 'Compare your product against competitors and catch market shifts early.', comingSoon: true },
  { icon: UserCheck, title: 'Discover Influencers', description: 'Search verified influencers by niche, platform, location, and follower count, and invite them to campaigns.', comingSoon: true },
]

const CONSUMER_FEATURES: Feature[] = [
  { icon: PenSquare, title: 'Submit Feedback', description: 'Share your thoughts via text, audio, or video — on the products you actually use.' },
  { icon: Video, title: 'Voice & Video Feedback', description: "Don't just type — record a quick voice note or video. We transcribe and translate it automatically." },
  { icon: Globe, title: 'Any Language', description: 'Give feedback in your own language — we auto-detect and translate, so nothing gets lost.' },
  { icon: BarChart3, title: 'Surveys & NPS', description: 'Answer quick surveys from brands you care about — and get rewarded for sharing your view.' },
  { icon: Award, title: 'Earn Rewards', description: 'Get rewarded for every review you share. More feedback means more earnings.' },
  { icon: HandCoins, title: 'Cash Out Points', description: 'Convert your points to cash and withdraw your earnings — simple and transparent.' },
  { icon: Sparkles, title: 'For You', description: 'Discover products matched to your taste based on your interests and feedback history.' },
  { icon: Trophy, title: 'Top Products', description: 'Browse the highest-ranked products each week — rated by real consumers like you.' },
  { icon: Package, title: 'Browse Products', description: 'Explore products across categories and share feedback on the ones you know.' },
  { icon: Bell, title: 'My Watchlist', description: 'Follow products you love and get notified when reviews or rankings change.' },
  { icon: Tags, title: 'Deals & Offers', description: 'Unlock exclusive deals and offers from brands on the platform.' },
  { icon: Flame, title: 'Community Deals', description: 'See the hottest deals shared and upvoted by the community.' },
  { icon: MessagesSquare, title: 'Community', description: 'Join conversations, share tips, and connect with consumers who share your interests.' },
  { icon: Users, title: 'Social', description: 'Follow friends, see what they review, and find great products through your network.', comingSoon: true },
  { icon: Bell, title: 'Notifications', description: 'Stay on top of new surveys, reward updates, and replies — all in one inbox.' },
  { icon: ShieldCheck, title: 'Privacy & Consent', description: 'Full control over what data you share — toggle each category independently. GDPR and India DPDP Act compliant.' },
  { icon: Activity, title: 'My Signals', description: 'See exactly what the platform knows about you — behavioral patterns, interests, demographics — with full history.' },
  { icon: Download, title: 'My Data Export', description: 'Download everything we hold about you as a single file — your right under GDPR and India’s DPDP Act.' },
  { icon: KeyRound, title: 'Account Security', description: 'Protect your account with a strong password and optional two-factor authentication.' },
  { icon: HelpCircle, title: 'Help & Support', description: 'Get answers fast from our help center and in-app support chat.' },
  { icon: Settings, title: 'Settings & Profile', description: 'Manage your profile, notification preferences, and connected channels in one place.' },
  { icon: ClipboardList, title: 'My Feedback', description: "Track everything you've submitted and see its status, all in one place." },
  { icon: UserCheck, title: 'Become an Influencer', description: 'Already a consumer? Register as an influencer in one step — same account, extended profile.' },
]

const INFLUENCER_FEATURES: Feature[] = [
  { icon: UserCheck, title: 'Influencer Profile', description: 'Create a verified public profile — set your niche, platforms, base rate, and portfolio. Brands discover you through search.' },
  { icon: Store, title: 'Marketplace', description: 'Browse open brand campaigns in the marketplace and apply to the ones that fit your audience.' },
  { icon: Megaphone, title: 'My Campaigns', description: 'Receive invitations and manage every campaign end-to-end — brief, terms, deliverables, and status.' },
  { icon: FileText, title: 'Content Management', description: "Manage all your content posts in one place — link posts to campaigns and keep your portfolio updated." },
  { icon: HandCoins, title: 'Milestone Payments', description: 'Payments are escrowed before work begins. Complete a milestone, submit for approval — funds release fast.' },
  { icon: Wallet, title: 'Earnings', description: "Track your earnings across campaigns with a clear breakdown of what's pending, approved, and paid." },
  { icon: Wallet, title: 'Payout Accounts', description: 'Add and manage your payout accounts to receive earnings securely.' },
  { icon: ShieldCheck, title: 'Get Verified', description: 'Earn a verified badge through our checks — and win brand trust faster.' },
  { icon: Zap, title: 'Performance Analytics', description: 'Track views, likes, reach, and engagement per campaign and platform.', comingSoon: true },
  { icon: Star, title: 'Reviews & Reputation', description: 'Brands leave verified reviews after each campaign. Build a star-rated reputation that earns better deals.' },
]

function FeatureCard({ feature, audience }: { feature: Feature; audience: Audience }) {
  const t = THEME[audience]
  const Icon = feature.icon
  return (
    <Card className={t.card}>
      <CardContent className="pt-5 pb-4">
        <div className={t.iconWrap}>
          <Icon className={t.icon} />
        </div>
        <h3 className="mt-3 flex flex-wrap items-center gap-y-1 font-semibold text-foreground text-base">
          {feature.title}
          {feature.comingSoon && <ComingSoon />}
        </h3>
        <p className="mt-1.5 text-sm font-medium text-muted-foreground leading-relaxed">
          {feature.description}
        </p>
        <Link href={t.ctaHref} className={t.cta}>
          {t.ctaLabel} <ArrowRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  )
}

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative px-6 py-24 sm:py-32 lg:px-8 bg-gradient-to-b from-background via-background to-muted/20">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
            </span>
            <span className="text-primary font-medium">Now in Beta</span>
          </div>
          <div className="flex justify-center mb-4">
            {/* Primary lockup with tagline — the hero brand moment. */}
            <Logo variant="primary" width={280} height={112} priority />
          </div>
          <p className="mb-6 text-base sm:text-lg italic text-muted-foreground leading-snug">
            The consumer intelligence infrastructure<br />
            where brands, consumers, and influencers meet
          </p>
          <h1 className="text-balance text-foreground">
            The Platform Where Brands, Consumers and Influencers Connect in Real Time
          </h1>
          <div className="mx-auto mt-6 max-w-2xl space-y-4 text-lg leading-relaxed text-muted-foreground">
            <p>A hyper-personalized intelligence platform that connects all three — instantly.</p>
            <p>Brands get real consumer intelligence tailored to their exact audience. Consumers earn rewards for their genuine voice and discover products made for them. Influencers monetize their authentic reach with campaigns matched to their profile.</p>
            <p className="font-medium text-foreground">Everyone gets what they actually want — in real time, every time.</p>
          </div>
          <HeroCtas />
        </div>
      </section>

      {/* For Brands */}
      <section className="border-t border-border/40 bg-muted/30 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm mb-4">
              <Building2 className="h-4 w-4 text-primary" />
              <span className="text-primary font-medium">For Brands</span>
            </div>
            <h2 className="text-foreground">Everything You Need to Understand Your Customers</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Collect feedback, analyze sentiment, benchmark competitors, and make data-driven product decisions.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {BRAND_FEATURES.map((f) => (
              <FeatureCard key={f.title} feature={f} audience="brand" />
            ))}
          </div>

          <div className="mt-10 flex flex-col items-center gap-3">
            <SectionCta role="brand" label="Get Started Free" className="bg-primary hover:bg-primary/90 gap-2" />
            <p className="text-xs text-muted-foreground">Free while we&apos;re in beta — no credit card required</p>
          </div>
        </div>
      </section>

      {/* For Consumers */}
      <section className="px-6 py-24 sm:py-32 border-t border-border/40">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-4 py-1.5 text-sm mb-4">
              <Users className="h-4 w-4 text-accent" />
              <span className="text-accent font-medium">For Consumers</span>
            </div>
            <h2 className="text-foreground">Your Voice Matters — and Gets Rewarded</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Share honest feedback, earn real rewards, and discover the best products — all in one place.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {CONSUMER_FEATURES.map((f) => (
              <FeatureCard key={f.title} feature={f} audience="consumer" />
            ))}
          </div>

          <div className="mt-10 flex flex-col items-center gap-3">
            <SectionCta role="consumer" label="Get Started Free" className="bg-accent hover:bg-accent/90 gap-2" />
            <p className="text-xs text-muted-foreground">Always free for consumers — earn rewards, never pay a thing</p>
          </div>
        </div>
      </section>

      {/* For Influencers */}
      <section className="border-t border-border/40 bg-muted/30 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/5 px-4 py-1.5 text-sm mb-4">
              <Star className="h-4 w-4 text-violet-600" />
              <span className="text-violet-600 font-medium">For Influencers</span>
            </div>
            <h2 className="text-foreground">Turn Your Audience Into a Career</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Get discovered by brands, manage campaigns end-to-end, and receive milestone-based payments — all from one platform.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
            {INFLUENCER_FEATURES.map((f) => (
              <FeatureCard key={f.title} feature={f} audience="influencer" />
            ))}
          </div>

          <div className="mt-10 flex flex-col items-center gap-3">
            <SectionCta role="influencer" label="Join as Influencer" className="bg-violet-600 hover:bg-violet-700 gap-2 text-white" />
            <p className="text-xs text-muted-foreground">Free to join — set up your influencer profile in a quick onboarding</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-border/40 bg-gradient-to-b from-muted/30 to-background px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-foreground">Ready to See It in Action?</h2>
          <p className="mt-4 text-lg">
            Free while we&apos;re in beta — paid plans coming soon. No credit card or payment details required; just sign up and start exploring.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <SectionCta label="Get Started Free" className="bg-primary hover:bg-primary/90 gap-2" />
            <Button size="lg" variant="outline" asChild className="border-primary/20 hover:bg-primary/5 hover:border-primary/40">
              <Link href="/contact-us">Book a Demo</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Free during beta · No credit card needed · Paid plans coming soon
          </p>
        </div>
      </section>
    </div>
  )
}
