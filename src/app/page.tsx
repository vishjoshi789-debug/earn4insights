import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  ArrowRight,
  BarChart3,
  MessageSquare,
  TrendingUp,
  Users,
  Building2,
  Activity,
  Globe,
  FileText,
  Upload,
  PenSquare,
  Award,
  Sparkles,
  MessagesSquare,
  Bell,
  Trophy,
  Brain,
  HandCoins,
  Target,
  Megaphone,
  UserCheck,
  ShieldCheck,
  Download,
  Star,
  CheckSquare,
  Zap,
} from 'lucide-react'

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
            <span className="text-primary font-medium">Now Live</span>
          </div>
          <div className="flex justify-center mb-4">
            <Image src="/logo.png" alt="Earn4Insights" width={96} height={96} className="rounded-2xl" priority />
          </div>
          <p className="mb-6 text-base sm:text-lg italic text-muted-foreground leading-snug">
            The Intelligence Operating System<br />
            for Brands, Consumers and Influencers
          </p>
          <h1 className="text-balance text-foreground">
            The Platform Where Brands, Consumers and Influencers Connect in Real Time
          </h1>
          <div className="mx-auto mt-6 max-w-2xl space-y-4 text-lg leading-relaxed text-muted-foreground">
            <p>A hyper-personalized intelligence platform that connects all three — instantly.</p>
            <p>Brands get real consumer intelligence tailored to their exact audience. Consumers earn rewards for their genuine voice and discover products made for them. Influencers monetize their authentic reach with campaigns matched to their profile.</p>
            <p className="font-medium text-foreground">Everyone gets what they actually want — in real time, every time.</p>
          </div>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Button size="lg" asChild className="gap-2 bg-primary hover:bg-primary/90 w-full sm:w-auto">
              <Link href="/signup?role=brand">
                I&apos;m a Brand
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" asChild className="gap-2 bg-accent hover:bg-accent/90 w-full sm:w-auto">
              <Link href="/signup?role=consumer">
                I&apos;m a Consumer
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" asChild className="gap-2 bg-violet-600 hover:bg-violet-700 text-white w-full sm:w-auto">
              <Link href="/signup?role=consumer">
                I&apos;m an Influencer
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
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
            <Card className="border-primary/20 bg-card/50 backdrop-blur shadow-sm hover:shadow-md hover:border-primary/40 transition-all">
              <CardContent className="pt-5 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-3 font-semibold text-foreground text-base">Feedback Hub</h3>
                <p className="mt-1.5 text-sm font-medium text-muted-foreground leading-relaxed">
                  All consumer feedback in one place — text, audio, and video with AI-powered sentiment analysis.
                </p>
                <Link href="/contact-us" className="mt-3 inline-flex items-center gap-1 text-xs text-primary/70 hover:text-primary font-medium transition-colors">
                  Book a Demo <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-card/50 backdrop-blur shadow-sm hover:shadow-md hover:border-primary/40 transition-all">
              <CardContent className="pt-5 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-3 font-semibold text-foreground text-base">Surveys & NPS</h3>
                <p className="mt-1.5 text-sm font-medium text-muted-foreground leading-relaxed">
                  Create targeted surveys and track Net Promoter Score to measure customer satisfaction.
                </p>
                <Link href="/contact-us" className="mt-3 inline-flex items-center gap-1 text-xs text-primary/70 hover:text-primary font-medium transition-colors">
                  Book a Demo <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-card/50 backdrop-blur shadow-sm hover:shadow-md hover:border-primary/40 transition-all">
              <CardContent className="pt-5 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-3 font-semibold text-foreground text-base">Audience Analytics</h3>
                <p className="mt-1.5 text-sm font-medium text-muted-foreground leading-relaxed">
                  Know who your customers are — demographics, behavior patterns, and preferences at a glance.
                </p>
                <Link href="/contact-us" className="mt-3 inline-flex items-center gap-1 text-xs text-primary/70 hover:text-primary font-medium transition-colors">
                  Book a Demo <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-card/50 backdrop-blur shadow-sm hover:shadow-md hover:border-primary/40 transition-all">
              <CardContent className="pt-5 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-3 font-semibold text-foreground text-base">Feature Insights</h3>
                <p className="mt-1.5 text-sm font-medium text-muted-foreground leading-relaxed">
                  See which features delight users and which need work — backed by real feedback data.
                </p>
                <Link href="/contact-us" className="mt-3 inline-flex items-center gap-1 text-xs text-primary/70 hover:text-primary font-medium transition-colors">
                  Book a Demo <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-card/50 backdrop-blur shadow-sm hover:shadow-md hover:border-primary/40 transition-all">
              <CardContent className="pt-5 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                  <Brain className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-3 font-semibold text-foreground text-base">Consumer Intelligence</h3>
                <p className="mt-1.5 text-sm font-medium text-muted-foreground leading-relaxed">
                  Understand how different user segments feel about your product and why.
                </p>
                <Link href="/contact-us" className="mt-3 inline-flex items-center gap-1 text-xs text-primary/70 hover:text-primary font-medium transition-colors">
                  Book a Demo <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-card/50 backdrop-blur shadow-sm hover:shadow-md hover:border-primary/40 transition-all">
              <CardContent className="pt-5 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-3 font-semibold text-foreground text-base">Category Intelligence</h3>
                <p className="mt-1.5 text-sm font-medium text-muted-foreground leading-relaxed">
                  Compare your product against competitors and catch market shifts early.
                </p>
                <Link href="/contact-us" className="mt-3 inline-flex items-center gap-1 text-xs text-primary/70 hover:text-primary font-medium transition-colors">
                  Book a Demo <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-card/50 backdrop-blur shadow-sm hover:shadow-md hover:border-primary/40 transition-all">
              <CardContent className="pt-5 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-3 font-semibold text-foreground text-base">Product Deep Dive</h3>
                <p className="mt-1.5 text-sm font-medium text-muted-foreground leading-relaxed">
                  In-depth analytics per product — sentiment trends, scores, and detailed feedback breakdowns.
                </p>
                <Link href="/contact-us" className="mt-3 inline-flex items-center gap-1 text-xs text-primary/70 hover:text-primary font-medium transition-colors">
                  Book a Demo <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-card/50 backdrop-blur shadow-sm hover:shadow-md hover:border-primary/40 transition-all">
              <CardContent className="pt-5 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                  <Trophy className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-3 font-semibold text-foreground text-base">Rankings & Alerts</h3>
                <p className="mt-1.5 text-sm font-medium text-muted-foreground leading-relaxed">
                  Track your weekly category ranking and get instant alerts on position changes.
                </p>
                <Link href="/contact-us" className="mt-3 inline-flex items-center gap-1 text-xs text-primary/70 hover:text-primary font-medium transition-colors">
                  Book a Demo <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-card/50 backdrop-blur shadow-sm hover:shadow-md hover:border-primary/40 transition-all">
              <CardContent className="pt-5 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                  <Bell className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-3 font-semibold text-foreground text-base">Weekly Digest</h3>
                <p className="mt-1.5 text-sm font-medium text-muted-foreground leading-relaxed">
                  Automated weekly summary of new feedback, score changes, and emerging trends.
                </p>
                <Link href="/contact-us" className="mt-3 inline-flex items-center gap-1 text-xs text-primary/70 hover:text-primary font-medium transition-colors">
                  Book a Demo <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-card/50 backdrop-blur shadow-sm hover:shadow-md hover:border-primary/40 transition-all">
              <CardContent className="pt-5 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                  <Upload className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-3 font-semibold text-foreground text-base">Import Data</h3>
                <p className="mt-1.5 text-sm font-medium text-muted-foreground leading-relaxed">
                  Bring existing feedback from Google Forms, Typeform, or SurveyMonkey — no re-collection needed.
                </p>
                <Link href="/contact-us" className="mt-3 inline-flex items-center gap-1 text-xs text-primary/70 hover:text-primary font-medium transition-colors">
                  Book a Demo <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-card/50 backdrop-blur shadow-sm hover:shadow-md hover:border-primary/40 transition-all">
              <CardContent className="pt-5 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                  <MessagesSquare className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-3 font-semibold text-foreground text-base">Community</h3>
                <p className="mt-1.5 text-sm font-medium text-muted-foreground leading-relaxed">
                  Engage with your audience directly — join conversations, share updates, and see what consumers are talking about.
                </p>
                <Link href="/contact-us" className="mt-3 inline-flex items-center gap-1 text-xs text-primary/70 hover:text-primary font-medium transition-colors">
                  Book a Demo <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-card/50 backdrop-blur shadow-sm hover:shadow-md hover:border-primary/40 transition-all">
              <CardContent className="pt-5 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-3 font-semibold text-foreground text-base">Social</h3>
                <p className="mt-1.5 text-sm font-medium text-muted-foreground leading-relaxed">
                  Monitor social discussions around your products, track consumer sentiment publicly, and build brand presence.
                </p>
                <Link href="/contact-us" className="mt-3 inline-flex items-center gap-1 text-xs text-primary/70 hover:text-primary font-medium transition-colors">
                  Book a Demo <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-card/50 backdrop-blur shadow-sm hover:shadow-md hover:border-primary/40 transition-all">
              <CardContent className="pt-5 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-3 font-semibold text-foreground text-base">ICP Builder</h3>
                <p className="mt-1.5 text-sm font-medium text-muted-foreground leading-relaxed">
                  Define your Ideal Consumer Profile with weighted criteria — age, interests, behavior, psychographics. Platform auto-scores every consumer against it daily.
                </p>
                <Link href="/contact-us" className="mt-3 inline-flex items-center gap-1 text-xs text-primary/70 hover:text-primary font-medium transition-colors">
                  Book a Demo <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-card/50 backdrop-blur shadow-sm hover:shadow-md hover:border-primary/40 transition-all">
              <CardContent className="pt-5 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                  <Megaphone className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-3 font-semibold text-foreground text-base">Influencer Campaigns</h3>
                <p className="mt-1.5 text-sm font-medium text-muted-foreground leading-relaxed">
                  Create campaigns, set budgets, define deliverables, and manage milestone-based payments — all in one dashboard. Escrow-backed for trust on both sides.
                </p>
                <Link href="/contact-us" className="mt-3 inline-flex items-center gap-1 text-xs text-primary/70 hover:text-primary font-medium transition-colors">
                  Book a Demo <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-card/50 backdrop-blur shadow-sm hover:shadow-md hover:border-primary/40 transition-all">
              <CardContent className="pt-5 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                  <UserCheck className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-3 font-semibold text-foreground text-base">Discover Influencers</h3>
                <p className="mt-1.5 text-sm font-medium text-muted-foreground leading-relaxed">
                  Search verified influencers by niche, platform, location, and follower count. Invite them directly to your campaigns from inside the platform.
                </p>
                <Link href="/contact-us" className="mt-3 inline-flex items-center gap-1 text-xs text-primary/70 hover:text-primary font-medium transition-colors">
                  Book a Demo <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>
          </div>

          <div className="mt-10 flex flex-col items-center gap-3">
            <Button size="lg" asChild className="bg-primary hover:bg-primary/90 gap-2">
              <Link href="/signup?role=brand">
                Start 14-Day Free Trial
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <p className="text-xs text-muted-foreground">No credit card required — just sign up</p>
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
            <Card className="border-accent/20 bg-card/50 backdrop-blur shadow-sm hover:shadow-md hover:border-accent/40 transition-all">
              <CardContent className="pt-5 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 ring-1 ring-accent/20">
                  <PenSquare className="h-5 w-5 text-accent" />
                </div>
                <h3 className="mt-3 font-semibold text-foreground text-base">Submit Feedback</h3>
                <p className="mt-1.5 text-sm font-medium text-muted-foreground leading-relaxed">
                  Share your thoughts via text, audio, or video — in any language you prefer.
                </p>
                <Link href="/contact-us" className="mt-3 inline-flex items-center gap-1 text-xs text-accent/70 hover:text-accent font-medium transition-colors">
                  Book a Demo <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card className="border-accent/20 bg-card/50 backdrop-blur shadow-sm hover:shadow-md hover:border-accent/40 transition-all">
              <CardContent className="pt-5 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 ring-1 ring-accent/20">
                  <Award className="h-5 w-5 text-accent" />
                </div>
                <h3 className="mt-3 font-semibold text-foreground text-base">Earn Rewards</h3>
                <p className="mt-1.5 text-sm font-medium text-muted-foreground leading-relaxed">
                  Get rewarded for every review you share. More feedback means more earnings.
                </p>
                <Link href="/contact-us" className="mt-3 inline-flex items-center gap-1 text-xs text-accent/70 hover:text-accent font-medium transition-colors">
                  Book a Demo <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card className="border-accent/20 bg-card/50 backdrop-blur shadow-sm hover:shadow-md hover:border-accent/40 transition-all">
              <CardContent className="pt-5 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 ring-1 ring-accent/20">
                  <HandCoins className="h-5 w-5 text-accent" />
                </div>
                <h3 className="mt-3 font-semibold text-foreground text-base">Payouts</h3>
                <p className="mt-1.5 text-sm font-medium text-muted-foreground leading-relaxed">
                  Withdraw your earnings anytime — simple, transparent, and hassle-free.
                </p>
                <Link href="/contact-us" className="mt-3 inline-flex items-center gap-1 text-xs text-accent/70 hover:text-accent font-medium transition-colors">
                  Book a Demo <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card className="border-accent/20 bg-card/50 backdrop-blur shadow-sm hover:shadow-md hover:border-accent/40 transition-all">
              <CardContent className="pt-5 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 ring-1 ring-accent/20">
                  <Sparkles className="h-5 w-5 text-accent" />
                </div>
                <h3 className="mt-3 font-semibold text-foreground text-base">For You</h3>
                <p className="mt-1.5 text-sm font-medium text-muted-foreground leading-relaxed">
                  Discover products matched to your taste based on your interests and feedback history.
                </p>
                <Link href="/contact-us" className="mt-3 inline-flex items-center gap-1 text-xs text-accent/70 hover:text-accent font-medium transition-colors">
                  Book a Demo <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card className="border-accent/20 bg-card/50 backdrop-blur shadow-sm hover:shadow-md hover:border-accent/40 transition-all">
              <CardContent className="pt-5 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 ring-1 ring-accent/20">
                  <Trophy className="h-5 w-5 text-accent" />
                </div>
                <h3 className="mt-3 font-semibold text-foreground text-base">Top Products</h3>
                <p className="mt-1.5 text-sm font-medium text-muted-foreground leading-relaxed">
                  Browse the highest-ranked products each week — rated by real consumers like you.
                </p>
                <Link href="/contact-us" className="mt-3 inline-flex items-center gap-1 text-xs text-accent/70 hover:text-accent font-medium transition-colors">
                  Book a Demo <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card className="border-accent/20 bg-card/50 backdrop-blur shadow-sm hover:shadow-md hover:border-accent/40 transition-all">
              <CardContent className="pt-5 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 ring-1 ring-accent/20">
                  <Bell className="h-5 w-5 text-accent" />
                </div>
                <h3 className="mt-3 font-semibold text-foreground text-base">My Watchlist</h3>
                <p className="mt-1.5 text-sm font-medium text-muted-foreground leading-relaxed">
                  Follow products you love and get notified when reviews or rankings change.
                </p>
                <Link href="/contact-us" className="mt-3 inline-flex items-center gap-1 text-xs text-accent/70 hover:text-accent font-medium transition-colors">
                  Book a Demo <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card className="border-accent/20 bg-card/50 backdrop-blur shadow-sm hover:shadow-md hover:border-accent/40 transition-all">
              <CardContent className="pt-5 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 ring-1 ring-accent/20">
                  <MessagesSquare className="h-5 w-5 text-accent" />
                </div>
                <h3 className="mt-3 font-semibold text-foreground text-base">Community</h3>
                <p className="mt-1.5 text-sm font-medium text-muted-foreground leading-relaxed">
                  Join conversations, share tips, and connect with consumers who share your interests.
                </p>
                <Link href="/contact-us" className="mt-3 inline-flex items-center gap-1 text-xs text-accent/70 hover:text-accent font-medium transition-colors">
                  Book a Demo <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card className="border-accent/20 bg-card/50 backdrop-blur shadow-sm hover:shadow-md hover:border-accent/40 transition-all">
              <CardContent className="pt-5 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 ring-1 ring-accent/20">
                  <Users className="h-5 w-5 text-accent" />
                </div>
                <h3 className="mt-3 font-semibold text-foreground text-base">Social</h3>
                <p className="mt-1.5 text-sm font-medium text-muted-foreground leading-relaxed">
                  Follow friends, see what they review, and find great products through your network.
                </p>
                <Link href="/contact-us" className="mt-3 inline-flex items-center gap-1 text-xs text-accent/70 hover:text-accent font-medium transition-colors">
                  Book a Demo <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card className="border-accent/20 bg-card/50 backdrop-blur shadow-sm hover:shadow-md hover:border-accent/40 transition-all">
              <CardContent className="pt-5 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 ring-1 ring-accent/20">
                  <ShieldCheck className="h-5 w-5 text-accent" />
                </div>
                <h3 className="mt-3 font-semibold text-foreground text-base">Privacy & Consent</h3>
                <p className="mt-1.5 text-sm font-medium text-muted-foreground leading-relaxed">
                  Full control over what data you share — toggle each category independently. GDPR and India DPDP Act compliant. Revoke any consent in one tap.
                </p>
                <Link href="/contact-us" className="mt-3 inline-flex items-center gap-1 text-xs text-accent/70 hover:text-accent font-medium transition-colors">
                  Learn More <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card className="border-accent/20 bg-card/50 backdrop-blur shadow-sm hover:shadow-md hover:border-accent/40 transition-all">
              <CardContent className="pt-5 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 ring-1 ring-accent/20">
                  <Activity className="h-5 w-5 text-accent" />
                </div>
                <h3 className="mt-3 font-semibold text-foreground text-base">My Signals</h3>
                <p className="mt-1.5 text-sm font-medium text-muted-foreground leading-relaxed">
                  See exactly what the platform knows about you — behavioral patterns, interests, demographics — with full history of every update.
                </p>
                <Link href="/contact-us" className="mt-3 inline-flex items-center gap-1 text-xs text-accent/70 hover:text-accent font-medium transition-colors">
                  Learn More <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card className="border-accent/20 bg-card/50 backdrop-blur shadow-sm hover:shadow-md hover:border-accent/40 transition-all">
              <CardContent className="pt-5 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 ring-1 ring-accent/20">
                  <Download className="h-5 w-5 text-accent" />
                </div>
                <h3 className="mt-3 font-semibold text-foreground text-base">My Data Export</h3>
                <p className="mt-1.5 text-sm font-medium text-muted-foreground leading-relaxed">
                  Download everything we hold about you as a single JSON file — your right under GDPR Art. 15 and India's DPDP Act. One click, instant export.
                </p>
                <Link href="/contact-us" className="mt-3 inline-flex items-center gap-1 text-xs text-accent/70 hover:text-accent font-medium transition-colors">
                  Learn More <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card className="border-accent/20 bg-card/50 backdrop-blur shadow-sm hover:shadow-md hover:border-accent/40 transition-all">
              <CardContent className="pt-5 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 ring-1 ring-accent/20">
                  <UserCheck className="h-5 w-5 text-accent" />
                </div>
                <h3 className="mt-3 font-semibold text-foreground text-base">Become an Influencer</h3>
                <p className="mt-1.5 text-sm font-medium text-muted-foreground leading-relaxed">
                  Already a consumer? Register as an influencer in one step — same account, extended profile. Set your niche, rates, and handles to get discovered by brands.
                </p>
                <Link href="/contact-us" className="mt-3 inline-flex items-center gap-1 text-xs text-accent/70 hover:text-accent font-medium transition-colors">
                  Learn More <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>
          </div>

          <div className="mt-10 flex flex-col items-center gap-3">
            <Button size="lg" asChild className="bg-accent hover:bg-accent/90 gap-2">
              <Link href="/signup?role=consumer">
                Start 14-Day Free Trial
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <p className="text-xs text-muted-foreground">No credit card required — just sign up</p>
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
            <Card className="border-violet-500/20 bg-card/50 backdrop-blur shadow-sm hover:shadow-md hover:border-violet-500/40 transition-all">
              <CardContent className="pt-5 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 ring-1 ring-violet-500/20">
                  <UserCheck className="h-5 w-5 text-violet-600" />
                </div>
                <h3 className="mt-3 font-semibold text-foreground text-base">Influencer Profile</h3>
                <p className="mt-1.5 text-sm font-medium text-muted-foreground leading-relaxed">
                  Create a verified public profile — set your niche, platforms, base rate, and portfolio. Brands discover you through search. No cold outreach needed.
                </p>
                <Link href="/contact-us" className="mt-3 inline-flex items-center gap-1 text-xs text-violet-600/70 hover:text-violet-600 font-medium transition-colors">
                  Get Started <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card className="border-violet-500/20 bg-card/50 backdrop-blur shadow-sm hover:shadow-md hover:border-violet-500/40 transition-all">
              <CardContent className="pt-5 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 ring-1 ring-violet-500/20">
                  <Megaphone className="h-5 w-5 text-violet-600" />
                </div>
                <h3 className="mt-3 font-semibold text-foreground text-base">Campaign Invitations</h3>
                <p className="mt-1.5 text-sm font-medium text-muted-foreground leading-relaxed">
                  Receive campaign invitations from brands, review the brief, negotiate terms, and accept or decline — on your schedule.
                </p>
                <Link href="/contact-us" className="mt-3 inline-flex items-center gap-1 text-xs text-violet-600/70 hover:text-violet-600 font-medium transition-colors">
                  Get Started <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card className="border-violet-500/20 bg-card/50 backdrop-blur shadow-sm hover:shadow-md hover:border-violet-500/40 transition-all">
              <CardContent className="pt-5 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 ring-1 ring-violet-500/20">
                  <HandCoins className="h-5 w-5 text-violet-600" />
                </div>
                <h3 className="mt-3 font-semibold text-foreground text-base">Milestone Payments</h3>
                <p className="mt-1.5 text-sm font-medium text-muted-foreground leading-relaxed">
                  Payments are escrowed before work begins. Complete a milestone, submit for approval — funds release instantly. No chasing invoices.
                </p>
                <Link href="/contact-us" className="mt-3 inline-flex items-center gap-1 text-xs text-violet-600/70 hover:text-violet-600 font-medium transition-colors">
                  Get Started <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card className="border-violet-500/20 bg-card/50 backdrop-blur shadow-sm hover:shadow-md hover:border-violet-500/40 transition-all">
              <CardContent className="pt-5 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 ring-1 ring-violet-500/20">
                  <FileText className="h-5 w-5 text-violet-600" />
                </div>
                <h3 className="mt-3 font-semibold text-foreground text-base">Content Management</h3>
                <p className="mt-1.5 text-sm font-medium text-muted-foreground leading-relaxed">
                  Manage all your content posts in one place — link posts to campaigns, track which platforms you've cross-posted to, and keep your portfolio updated.
                </p>
                <Link href="/contact-us" className="mt-3 inline-flex items-center gap-1 text-xs text-violet-600/70 hover:text-violet-600 font-medium transition-colors">
                  Get Started <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card className="border-violet-500/20 bg-card/50 backdrop-blur shadow-sm hover:shadow-md hover:border-violet-500/40 transition-all">
              <CardContent className="pt-5 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 ring-1 ring-violet-500/20">
                  <Zap className="h-5 w-5 text-violet-600" />
                </div>
                <h3 className="mt-3 font-semibold text-foreground text-base">Performance Analytics</h3>
                <p className="mt-1.5 text-sm font-medium text-muted-foreground leading-relaxed">
                  Track views, likes, reach, and engagement per campaign and platform. Show brands real numbers to build credibility and command better rates.
                </p>
                <Link href="/contact-us" className="mt-3 inline-flex items-center gap-1 text-xs text-violet-600/70 hover:text-violet-600 font-medium transition-colors">
                  Get Started <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card className="border-violet-500/20 bg-card/50 backdrop-blur shadow-sm hover:shadow-md hover:border-violet-500/40 transition-all">
              <CardContent className="pt-5 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 ring-1 ring-violet-500/20">
                  <Star className="h-5 w-5 text-violet-600" />
                </div>
                <h3 className="mt-3 font-semibold text-foreground text-base">Reviews & Reputation</h3>
                <p className="mt-1.5 text-sm font-medium text-muted-foreground leading-relaxed">
                  Brands leave verified reviews after each campaign. Build a star-rated reputation that makes future brands trust you faster and offer better deals.
                </p>
                <Link href="/contact-us" className="mt-3 inline-flex items-center gap-1 text-xs text-violet-600/70 hover:text-violet-600 font-medium transition-colors">
                  Get Started <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>
          </div>

          <div className="mt-10 flex flex-col items-center gap-3">
            <Button size="lg" asChild className="bg-violet-600 hover:bg-violet-700 gap-2 text-white">
              <Link href="/signup?role=consumer">
                Join as Influencer
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <p className="text-xs text-muted-foreground">Sign up as a consumer — register as an influencer from your dashboard</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-border/40 bg-gradient-to-b from-muted/30 to-background px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-foreground">Ready to See It in Action?</h2>
          <p className="mt-4 text-lg">
            Start your 14-day free trial — no credit card or payment details required. Just sign up and explore everything.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" asChild className="bg-primary hover:bg-primary/90 gap-2">
              <Link href="/signup">
                Start Free Trial
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="border-primary/20 hover:bg-primary/5 hover:border-primary/40">
              <Link href="/contact-us">Book a Demo</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            14 days free · No credit card needed · Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-12">
        <div className="mx-auto max-w-6xl">
          {/* Brand tagline — full width on top */}
          <div className="text-center mb-10">
            <h4 className="text-sm font-semibold text-foreground">Earn4Insights</h4>
            <p className="mt-1 text-xs italic text-muted-foreground max-w-md mx-auto leading-snug">
              The Intelligence Operating System for Brands, Consumers and Influencers
            </p>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
              Multimodal feedback. Multilingual intelligence. Real-time analytics and personalized recommendations — structured for brands, rewarding consumers.
            </p>
          </div>

          {/* Links — 2 columns, responsive */}
          <div className="grid grid-cols-2 gap-6 max-w-md mx-auto text-center sm:text-left">
            <div>
              <h4 className="text-sm font-semibold text-foreground">Company</h4>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/about-us" className="hover:text-foreground transition-colors">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link href="/contact-us" className="hover:text-foreground transition-colors">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-sm font-semibold text-foreground">Legal</h4>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/privacy-policy" className="hover:text-foreground transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms-of-service" className="hover:text-foreground transition-colors">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="mt-10 border-t pt-6 text-center text-sm text-muted-foreground">
            © 2026 Earn4Insights. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
