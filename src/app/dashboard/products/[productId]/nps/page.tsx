import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BarChart3, ArrowLeft } from 'lucide-react'

export default async function NpsPage({
  params,
}: {
  params: Promise<{ productId: string }>
}) {
  const { productId } = await params
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/dashboard/products/${productId}`} className="hover:underline flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" />
          Back to product
        </Link>
      </div>

      <Card>
        <CardContent className="py-16 text-center">
          <BarChart3 className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
          <h1 className="text-2xl font-bold mb-2">NPS Dashboard</h1>
          <p className="text-muted-foreground mb-1">
            Net Promoter Score tracking &amp; analytics
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            This feature is coming soon. In the meantime, you can set up NPS surveys from the Surveys page.
          </p>
          <div className="flex justify-center gap-3">
            <Button asChild variant="outline">
              <Link href="/dashboard/surveys">Go to Surveys</Link>
            </Button>
            <Button asChild>
              <Link href={`/dashboard/products/${productId}/feedback`}>View Feedback</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
