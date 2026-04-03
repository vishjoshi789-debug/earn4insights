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
          <div className="flex justify-center mb-6">
            <Image src="/logo.png" alt="Earn4Insights" width={96} height={96} className="rounded-2xl" priority />
          </div>
          <h1 className="text-balance text-foreground">
            Where Consumer Voice Powers Better Products.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed">
            Multimodal and multilingual feedback transformed into real-time product intelligence — helping brands build smarter and consumers shape the products they use. Launch with confidence through personalized recommendations, live analytics, and structured rankings.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Button size="lg" asChild className="gap-2 bg-primary hover:bg-primary/90">
              <Link href="/signup">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="border-primary/20 hover:bg-primary/5 hover:border-primary/40">
              <Link href="/top-products">View Rankings</Link>
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
            <p className="mt-1 text-xs italic text-muted-foreground">
              Real Voices. Measurable Intelligence.
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
