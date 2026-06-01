import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, BarChart3, Calendar, ArrowRight, MessageSquare } from 'lucide-react'
import { auth } from '@/lib/auth/auth.config'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { products, surveys as surveysTable } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { getAllSurveys } from '@/db/repositories/surveyRepository'
import { formatDistanceToNow } from 'date-fns'
import type { Survey } from '@/lib/survey-types'

/**
 * Brand-scoped surveys list. Pre-fix this page called fetchAllSurveys()
 * which returned PLATFORM-WIDE surveys to every brand. Audit ref: Pass
 * 3 B-C2.
 *
 * Role behaviour:
 *   brand   → own surveys (filtered by owned products.id IN ...)
 *   admin   → all surveys (legitimate platform-wide admin view)
 *   other   → bounced to /top-products (not a consumer surface)
 *
 * For brands we also distinguish "no surveys yet" from "no products
 * yet" — both yield an empty list but the CTA differs (create survey
 * vs launch a product first).
 */
export default async function SurveysPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  const role = (session.user as any).role as string | undefined
  const userId = (session.user as any).id as string

  let allSurveys: Survey[] = []
  let hasNoProducts = false

  if (role === 'brand') {
    // Resolve owned product ids inline; if none, we know to show the
    // "launch a product first" empty state without making a second query.
    const productRows = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.ownerId, userId))
    const productIds = productRows.map((p) => p.id)
    hasNoProducts = productIds.length === 0

    if (!hasNoProducts) {
      const rows = await db
        .select()
        .from(surveysTable)
        .where(inArray(surveysTable.productId, productIds))
      allSurveys = rows.map((r) => ({
        id: r.id,
        productId: r.productId,
        title: r.title,
        description: r.description || undefined,
        type: r.type as Survey['type'],
        isActive: r.status === 'active',
        status: r.status as Survey['status'],
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        questions: r.questions as Survey['questions'],
        settings: r.settings as Survey['settings'],
      }))
    }
  } else if (role === 'admin') {
    allSurveys = await getAllSurveys()
  } else {
    redirect('/top-products')
  }

  // Group surveys by type
  const npsSurveys = allSurveys.filter((s) => s.type === 'nps')
  const csatSurveys = allSurveys.filter((s) => s.type === 'csat')
  const customSurveys = allSurveys.filter((s) => s.type === 'custom')

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Surveys & NPS</h1>
          <p className="text-muted-foreground mt-1">
            Collect structured feedback from your users
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/surveys/create?productId=demo">
            <Plus className="w-4 h-4 mr-2" />
            Create Survey
          </Link>
        </Button>
      </div>

      {/* No-products empty state for brands (precedes the per-type
          sections so we don't show three "no surveys yet" cards in
          succession when the brand has zero products). */}
      {role === 'brand' && hasNoProducts && (
        <Card className="border-dashed">
          <CardContent className="py-10 flex flex-col items-center text-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                Add a product before creating a survey
              </p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Surveys collect feedback on a specific product. Launch
                your first product, then come back here to create
                NPS, CSAT, or custom surveys for it.
              </p>
            </div>
            <Button asChild size="sm">
              <Link href="/dashboard/launch">
                Launch a product
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* NPS Surveys */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">NPS Surveys</h2>
        <p className="text-sm text-muted-foreground -mt-2">
          Measure customer loyalty with the "How likely are you to recommend us?" question (0–10 scale). Track Promoters, Passives, and Detractors over time to gauge brand advocacy.
        </p>
        {npsSurveys.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <p>No NPS surveys yet. Create one to start tracking Net Promoter Score.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {npsSurveys.map((survey) => (
              <SurveyCard key={survey.id} survey={survey} />
            ))}
          </div>
        )}
      </section>

      {/* CSAT Surveys */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">CSAT Surveys</h2>
        <p className="text-sm text-muted-foreground -mt-2">
          Measure how satisfied customers are with a specific interaction, feature, or experience. Best used right after a purchase, support ticket, or onboarding to capture immediate satisfaction.
        </p>
        {csatSurveys.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <p>No CSAT surveys yet. Create one to measure customer satisfaction.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {csatSurveys.map((survey) => (
              <SurveyCard key={survey.id} survey={survey} />
            ))}
          </div>
        )}
      </section>

      {/* Custom Surveys */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Custom Surveys</h2>
        <p className="text-sm text-muted-foreground -mt-2">
          Build your own surveys with custom questions — ratings, multiple choice, or open text. Use these for product research, interest gauging, feature prioritization, or any feedback need not covered by NPS or CSAT.
        </p>
        {customSurveys.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <p>No custom surveys yet. Build your own survey with custom questions.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {customSurveys.map((survey) => (
              <SurveyCard key={survey.id} survey={survey} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function SurveyCard({ survey }: { survey: Survey }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className="text-lg">{survey.title}</CardTitle>
              <Badge variant={survey.isActive ? 'default' : 'secondary'}>
                {survey.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            {survey.description && (
              <p className="text-sm text-muted-foreground">{survey.description}</p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <BarChart3 className="w-4 h-4" />
            <span>{survey.questions.length} questions</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            <span>Created {formatDistanceToNow(new Date(survey.createdAt), { addSuffix: true })}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/surveys/${survey.id}`}>
              View Details
            </Link>
          </Button>
          <Button variant="ghost" size="sm">
            View Responses
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
