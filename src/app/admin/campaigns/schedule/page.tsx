import { Suspense } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScheduleCampaignForm } from './ScheduleCampaignForm'
import { db } from '@/db'
import { surveys, products } from '@/db/schema'
import { eq } from 'drizzle-orm'

export default async function ScheduleCampaignPage() {
  // Fetch active surveys and products
  const [activeSurveys, allProducts] = await Promise.all([
    db.select({
      id: surveys.id,
      title: surveys.title,
      productId: surveys.productId,
      isActive: surveys.isActive
    }).from(surveys).where(eq(surveys.isActive, true)),
    db.select({
      id: products.id,
      name: products.name
    }).from(products)
  ])

  // Enrich surveys with product names
  const surveysWithProducts = activeSurveys.map(survey => ({
    ...survey,
    productName: allProducts.find(p => p.id === survey.productId)?.name || 'Unknown'
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Schedule Campaign</h1>
        <p className="text-muted-foreground mt-2">
          Create targeted survey notification campaigns with advanced filtering
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campaign Configuration</CardTitle>
          <CardDescription>
            Target users by demographics, interests, and behavior. Campaigns can be sent immediately or scheduled for optimal delivery times.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div>Loading...</div>}>
            <ScheduleCampaignForm surveys={surveysWithProducts} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
