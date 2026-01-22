import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import SurveyCreationForm from '@/components/survey-creation-form'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

type PageProps = {
  searchParams: Promise<{ productId?: string }>
}

export default async function CreateSurveyPage({ searchParams }: PageProps) {
  const params = await searchParams
  const productId = params.productId

  // If no productId, redirect to surveys list (or products list)
  if (!productId) {
    redirect('/dashboard/surveys')
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create Survey</h1>
        <p className="text-muted-foreground mt-1">
          Create a new survey to collect feedback from your users
        </p>
      </div>

      <Suspense
        fallback={
          <Card>
            <CardContent className="py-12">
              <p className="text-center text-muted-foreground">Loading...</p>
            </CardContent>
          </Card>
        }
      >
        <SurveyCreationForm productId={productId} />
      </Suspense>
    </div>
  )
}
