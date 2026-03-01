import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowRight, BarChart3, MessageSquare, TrendingUp, Users, Building2 } from 'lucide-react'

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
            <Image src="/logo.png" alt="Earn4Insights" width={72} height={72} priority />
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

      {/* How It Works */}
      <section className="border-t border-border/40 bg-muted/30 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h2 className="text-foreground">How It Works</h2>
            <p className="mt-4 text-lg">
              Three simple steps to better products
            </p>
          </div>
          
          <div className="mt-16 grid gap-8 sm:grid-cols-3">
            <Card className="border-primary/20 bg-card/50 backdrop-blur shadow-sm hover:shadow-md hover:border-primary/40 transition-all">
              <CardContent className="pt-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4 font-semibold text-foreground">Collect Feedback</h3>
                <p className="mt-2 text-sm">
                  Launch targeted surveys and gather authentic customer insights in real-time.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-accent/20 bg-card/50 backdrop-blur shadow-sm hover:shadow-md hover:border-accent/40 transition-all">
              <CardContent className="pt-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10 ring-1 ring-accent/20">
                  <BarChart3 className="h-6 w-6 text-accent" />
                </div>
                <h3 className="mt-4 font-semibold text-foreground">Analyze Data</h3>
                <p className="mt-2 text-sm">
                  AI-powered analytics reveal patterns, sentiment, and actionable recommendations.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-primary/20 bg-card/50 backdrop-blur shadow-sm hover:shadow-md hover:border-primary/40 transition-all">
              <CardContent className="pt-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4 font-semibold text-foreground">Track Rankings</h3>
                <p className="mt-2 text-sm">
                  See how your product ranks in your category and identify improvement areas.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Who It's For */}
      <section className="px-6 py-24 sm:py-32 border-t border-border/40">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h2 className="text-foreground">Built For Everyone</h2>
            <p className="mt-4 text-lg">
              Whether you're building or buying, we've got you covered
            </p>
          </div>
          
          <div className="mt-16 grid gap-8 lg:grid-cols-2">
            {/* For Brands */}
            <Card className="border-primary/30 bg-card/50 backdrop-blur hover:border-primary/50 hover:shadow-lg transition-all">
              <CardContent className="p-8">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/20">
                  <Building2 className="h-7 w-7" />
                </div>
                <h3 className="mt-6 text-xl font-semibold text-foreground">For Brands</h3>
                <p className="mt-3">
                  Launch products with confidence. Get instant customer feedback, 
                  analyze sentiment, and track your competitive position.
                </p>
                <ul className="mt-6 space-y-3 text-sm">
                  <li className="flex items-start gap-3">
                    <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
                      ✓
                    </span>
                    <span>Real-time feedback analytics</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
                      ✓
                    </span>
                    <span>Category rankings & insights</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
                      ✓
                    </span>
                    <span>Automated reporting & notifications</span>
                  </li>
                </ul>
                <Button className="mt-8 w-full bg-primary hover:bg-primary/90" asChild>
                  <Link href="/signup?role=brand">Get Started as Brand</Link>
                </Button>
              </CardContent>
            </Card>

            {/* For Consumers */}
            <Card className="border-accent/30 bg-card/50 backdrop-blur hover:border-accent/50 hover:shadow-lg transition-all">
              <CardContent className="p-8">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent/80 text-primary-foreground shadow-lg shadow-accent/20">
                  <Users className="h-7 w-7" />
                </div>
                <h3 className="mt-6 text-xl font-semibold text-foreground">For Consumers</h3>
                <p className="mt-3">
                  Share your voice and earn rewards. Help brands improve while 
                  discovering the best products in every category.
                </p>
                <ul className="mt-6 space-y-3 text-sm">
                  <li className="flex items-start gap-3">
                    <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent ring-1 ring-accent/20">
                      ✓
                    </span>
                    <span>Earn rewards for feedback</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent ring-1 ring-accent/20">
                      ✓
                    </span>
                    <span>Discover top-ranked products</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent ring-1 ring-accent/20">
                      ✓
                    </span>
                    <span>Influence product development</span>
                  </li>
                </ul>
                <Button className="mt-8 w-full bg-accent hover:bg-accent/90" asChild>
                  <Link href="/signup?role=consumer">Get Started as Consumer</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-border/40 bg-gradient-to-b from-muted/30 to-background px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-foreground">Ready to Launch Your Product?</h2>
          <p className="mt-4 text-lg">
            Join brands and consumers who are shaping the future of product development.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" asChild className="bg-primary hover:bg-primary/90">
              <Link href="/signup">Get Started Free</Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="border-primary/20 hover:bg-primary/5 hover:border-primary/40">
              <Link href="/top-products">Explore Rankings</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <h4 className="text-sm font-semibold text-foreground">Product</h4>
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                <li>
                  <Link href="/top-products" className="hover:text-foreground transition-colors">
                    Rankings
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard" className="hover:text-foreground transition-colors">
                    Dashboard
                  </Link>
                </li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-sm font-semibold text-foreground">Company</h4>
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                <li>
                  <Link href="/about" className="hover:text-foreground transition-colors">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-foreground transition-colors">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-sm font-semibold text-foreground">Legal</h4>
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
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
            
            <div>
              <h4 className="text-sm font-semibold text-foreground">Earn4Insights</h4>
              <p className="mt-2 text-xs italic text-muted-foreground">
                Real Voices. Measurable Intelligence.
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                Multimodal feedback. Multilingual intelligence. Real-time analytics and personalized recommendations — structured for brands, rewarding consumers.
              </p>
            </div>
          </div>
          
          <div className="mt-12 border-t pt-8 text-center text-sm text-muted-foreground">
            © 2026 Earn4Insights. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
