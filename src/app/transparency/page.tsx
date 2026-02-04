import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Info, TrendingUp, Target, Shield, Eye, Database } from 'lucide-react'
import Link from 'next/link'

export const metadata = {
  title: 'How We Personalize Your Experience | Transparency',
  description: 'Learn how our personalization algorithms work and how we use your data to improve your experience.',
}

export default function TransparencyPage() {
  return (
    <div className="container max-w-4xl py-12 space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">How We Personalize Your Experience</h1>
        <p className="text-xl text-muted-foreground">
          We believe in complete transparency about how we use your data and personalize your experience. 
          Here's everything you need to know.
        </p>
      </div>

      {/* Overview */}
      <Card className="border-blue-700 bg-blue-900/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-400" />
            <CardTitle className="text-white">Our Commitment to Transparency</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            You have complete control over your data. All personalization is <strong>opt-in</strong>, and you can 
            disable it at any time in your <Link href="/settings/privacy" className="text-blue-600 hover:underline">privacy settings</Link>.
          </p>
          <p className="text-muted-foreground">
            This page explains exactly how our algorithms work, what data we collect, and how we use it 
            to improve your experience. No marketing jargon—just the technical details.
          </p>
        </CardContent>
      </Card>

      {/* How Recommendations Work */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-600" />
            <CardTitle>How Product Recommendations Work</CardTitle>
          </div>
          <CardDescription>
            Our recommendation system uses a weighted scoring algorithm to match products with your interests
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <h3 className="font-semibold">Scoring Factors (6 total)</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">Category Match</p>
                  <p className="text-sm text-muted-foreground">
                    Product category aligns with your stated interests
                  </p>
                </div>
                <Badge variant="secondary">25%</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">Demographic Targeting</p>
                  <p className="text-sm text-muted-foreground">
                    Age range, location, and preferences match
                  </p>
                </div>
                <Badge variant="secondary">25%</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">Cultural Alignment</p>
                  <p className="text-sm text-muted-foreground">
                    Values and cultural context alignment
                  </p>
                </div>
                <Badge variant="secondary">15%</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">Income Appropriateness</p>
                  <p className="text-sm text-muted-foreground">
                    Product pricing matches your stated budget range
                  </p>
                </div>
                <Badge variant="secondary">15%</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">Purchase Intent</p>
                  <p className="text-sm text-muted-foreground">
                    Likelihood of purchase based on your behavior
                  </p>
                </div>
                <Badge variant="secondary">10%</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">Engagement Score</p>
                  <p className="text-sm text-muted-foreground">
                    How actively you interact with similar content
                  </p>
                </div>
                <Badge variant="secondary">10%</Badge>
              </div>
            </div>
          </div>

          <div className="p-4 bg-blue-900/50 border-l-4 border-blue-600 rounded">
            <p className="text-sm font-medium text-blue-200 mb-1">Example Calculation</p>
            <p className="text-xs text-blue-300">
              If a product matches your "Technology" interest (25 points), targets your age range 25-34 (25 points), 
              aligns with your values (15 points), fits your budget (15 points), you've shown purchase intent (10 points), 
              and you're highly engaged (10 points), it scores <strong>100/100</strong> and appears at the top of your feed.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Behavioral Tracking */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-orange-600" />
            <CardTitle>What Behavioral Data We Track</CardTitle>
          </div>
          <CardDescription>
            Only when you've opted in to personalization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">✓</div>
              <div>
                <p className="font-medium">Page Views & Clicks</p>
                <p className="text-sm text-muted-foreground">
                  Which products you view and click on (to understand your interests)
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5">✓</div>
              <div>
                <p className="font-medium">Survey Responses</p>
                <p className="text-sm text-muted-foreground">
                  Your answers to surveys (to refine category interests)
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5">✓</div>
              <div>
                <p className="font-medium">Feedback & Ratings</p>
                <p className="text-sm text-muted-foreground">
                  Product ratings you submit (to improve recommendations)
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5">✓</div>
              <div>
                <p className="font-medium">Engagement Metrics</p>
                <p className="text-sm text-muted-foreground">
                  Time spent on pages, scroll depth, interaction frequency
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded">
            <p className="text-sm font-medium text-red-900 mb-1">What We DON'T Track</p>
            <ul className="text-xs text-red-800 space-y-1">
              <li>❌ Your activity on other websites (no cross-site tracking)</li>
              <li>❌ Your private messages or communications</li>
              <li>❌ Your precise geolocation (only city/country)</li>
              <li>❌ Sensitive personal information (health, politics, religion)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Survey & Email Targeting */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-green-600" />
            <CardTitle>How We Target Surveys & Emails</CardTitle>
          </div>
          <CardDescription>
            Smart targeting ensures you only receive relevant content
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            When a brand creates a survey or we send product notifications, we use the following criteria 
            to determine if it's relevant to you:
          </p>

          <div className="space-y-2">
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">Category Interest Match</p>
              <p className="text-sm text-muted-foreground">
                Survey topic must match at least one of your selected interest categories
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">Demographic Filters</p>
              <p className="text-sm text-muted-foreground">
                Age range, location, and gender (if you've provided this information)
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">Engagement Score Threshold</p>
              <p className="text-sm text-muted-foreground">
                We prioritize users who are actively engaged with the platform
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">Notification Preferences</p>
              <p className="text-sm text-muted-foreground">
                Respects your quiet hours, frequency limits, and channel preferences
              </p>
            </div>
          </div>

          <div className="p-4 bg-green-50 border-l-4 border-green-500 rounded">
            <p className="text-sm font-medium text-green-900 mb-1">Why You See Transparency Boxes</p>
            <p className="text-xs text-green-800">
              Every survey email and feedback form now includes a blue "Why you're seeing this" box that 
              explains exactly which targeting criteria matched your profile. This is required by 
              GDPR Article 13 (Right to Information).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Data Usage & Storage */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-600" />
            <CardTitle>How We Store & Use Your Data</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div>
              <h4 className="font-semibold mb-2">Data Storage</h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• Stored in secure PostgreSQL database (Neon serverless)</li>
                <li>• Encrypted at rest and in transit (TLS 1.3)</li>
                <li>• Located in EU data centers (GDPR compliant)</li>
                <li>• Regular automated backups (30-day retention)</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Data Access</h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• <strong>All access is logged</strong> (who, when, why) in our audit trail</li>
                <li>• Only authorized system processes can access your data</li>
                <li>• No third-party sharing without your explicit consent</li>
                <li>• Engineers can only access anonymized data for debugging</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Data Retention</h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• Profile data: Kept while your account is active</li>
                <li>• Behavioral events: 24 months, then auto-deleted</li>
                <li>• Survey responses: Kept indefinitely (anonymized after 12 months)</li>
                <li>• Audit logs: 7 years (compliance requirement)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Your Rights (GDPR) */}
      <Card className="border-green-200 bg-green-50/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-600" />
            <CardTitle>Your Privacy Rights (GDPR)</CardTitle>
          </div>
          <CardDescription>
            You have complete control over your personal data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3">
            <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
              <div className="mt-0.5 font-bold">1.</div>
              <div>
                <p className="font-medium">Right to Access</p>
                <p className="text-sm text-muted-foreground">
                  Export all your data in JSON format from{' '}
                  <Link href="/settings/privacy" className="text-green-600 hover:underline">
                    privacy settings
                  </Link>
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
              <div className="mt-0.5 font-bold">2.</div>
              <div>
                <p className="font-medium">Right to Rectification</p>
                <p className="text-sm text-muted-foreground">
                  Update your profile information anytime in{' '}
                  <Link href="/settings" className="text-green-600 hover:underline">
                    account settings
                  </Link>
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
              <div className="mt-0.5 font-bold">3.</div>
              <div>
                <p className="font-medium">Right to Erasure ("Right to be Forgotten")</p>
                <p className="text-sm text-muted-foreground">
                  Delete your account and all associated data (irreversible, 30-day grace period)
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
              <div className="mt-0.5 font-bold">4.</div>
              <div>
                <p className="font-medium">Right to Object</p>
                <p className="text-sm text-muted-foreground">
                  Disable personalization, behavioral tracking, or specific data processing activities
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
              <div className="mt-0.5 font-bold">5.</div>
              <div>
                <p className="font-medium">Right to Data Portability</p>
                <p className="text-sm text-muted-foreground">
                  Export your data in machine-readable format (JSON) to transfer to another service
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
              <div className="mt-0.5 font-bold">6.</div>
              <div>
                <p className="font-medium">Right to Withdraw Consent</p>
                <p className="text-sm text-muted-foreground">
                  Disable personalization or marketing consent at any time (effect is immediate)
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Trail */}
      <Card className="border-purple-700 bg-purple-900/50">
        <CardHeader>
          <CardTitle className="text-white">🔍 New: Complete Audit Trail</CardTitle>
          <CardDescription className="text-purple-200">
            Every access to your sensitive data is now logged
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-300">
          <p>
            As of this update, we track every access to your sensitive personal data including:
          </p>
          <ul className="ml-4 space-y-1 text-muted-foreground">
            <li>• Who accessed it (system process or user ID)</li>
            <li>• When it was accessed (timestamp)</li>
            <li>• What data was accessed (data type)</li>
            <li>• Why it was accessed (operation reason)</li>
            <li>• IP address and user agent (for security)</li>
          </ul>
          <p className="text-muted-foreground">
            You can request your audit logs by contacting support. This is part of our SOC 2 compliance preparation.
          </p>
        </CardContent>
      </Card>

      {/* Footer CTA */}
      <div className="flex flex-col sm:flex-row gap-4 pt-8 border-t">
        <Link 
          href="/settings/privacy" 
          className="flex-1 inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
        >
          Manage Privacy Settings
        </Link>
        <Link 
          href="/privacy-policy" 
          className="flex-1 inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
        >
          Read Full Privacy Policy
        </Link>
      </div>

      {/* Last Updated */}
      <p className="text-center text-sm text-muted-foreground">
        Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
      </p>
    </div>
  )
}
