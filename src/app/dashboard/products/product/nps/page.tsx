import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export default async function ProductNpsPage({
  searchParams,
}: {
  searchParams: Promise<{ productId?: string }>
}) {
  const { productId } = await searchParams

  if (!productId) {
    return <div className="p-6">Invalid product</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">NPS Dashboard</h1>
        <p className="text-muted-foreground">
          Product ID: {productId}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>NPS Insights</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground">
          NPS data collection and insights will appear here.
        </CardContent>
      </Card>
    </div>
  )
}
