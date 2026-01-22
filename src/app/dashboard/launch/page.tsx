

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import LaunchForm from './LaunchForm'

export default function LaunchProductPage() {
  return (
    <div className="min-h-screen bg-muted/30 py-10">
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Launch a Product</h1>
          <p className="text-muted-foreground">
            Add a new product to start collecting feedback, NPS, and social insights.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Product Basics</CardTitle>
          </CardHeader>

          <CardContent>
            <LaunchForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
