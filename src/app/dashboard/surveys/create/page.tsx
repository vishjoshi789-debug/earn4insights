import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import SurveyCreationForm from '@/components/survey-creation-form'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { auth } from '@/lib/auth/auth.config'
import { getProductsByOwner } from '@/db/repositories/productRepository'

type PageProps = {
  searchParams: Promise<{ productId?: string }>
}

export default async function CreateSurveyPage({ searchParams }: PageProps) {
  const params = await searchParams

  const session = await auth()
  if (!session?.user?.email) {
    redirect('/login')
  }
  const userId = (session.user as any).id as string

  // A survey must attach to a product the brand owns. Fetch the owned
  // products and offer them in a picker; without any owned product there
  // is nothing to survey, so bounce back to the list (which shows the
  // "launch a product first" CTA).
  const ownedProducts = await getProductsByOwner(userId)
  if (ownedProducts.length === 0) {
    redirect('/dashboard/surveys')
  }

  const products = ownedProducts.map((p) => ({ id: p.id, name: p.name }))

  // Honour an explicit ?productId only if the brand actually owns it,
  // otherwise default to the first owned product.
  const requested = params.productId
  const defaultProductId =
    requested && products.some((p) => p.id === requested)
      ? requested
      : products[0].id

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
        <SurveyCreationForm products={products} defaultProductId={defaultProductId} />
      </Suspense>
    </div>
  )
}
