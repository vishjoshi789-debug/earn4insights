import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export default function ProductSocialPage({
  searchParams,
}: {
  searchParams: { productId?: string }
}) {
  const productId = searchParams.productId

  if (!productId) {
    return <div className="p-6">Invalid product</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Social Listening</h1>
        <p className="text-muted-foreground">
          Product ID: {productId}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Social Signals</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground">
          Social mentions, sentiment, and trends will appear here.
        </CardContent>
      </Card>
    </div>
  )
}
