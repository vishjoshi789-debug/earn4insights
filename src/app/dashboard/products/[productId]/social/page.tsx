import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, ArrowLeft } from 'lucide-react'

export default async function SocialPage({
  params,
}: {
  params: Promise<{ productId: string }>
}) {
  const { productId } = await params

  if (!productId) {
    return <div className="p-6">Invalid product</div>
  }

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
          <Users className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Social Listening</h1>
          <p className="text-muted-foreground mb-1">
            Track brand mentions &amp; sentiment across social platforms
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            This feature is coming soon. You can already view direct consumer feedback and AI-extracted themes.
          </p>
          <div className="flex justify-center gap-3">
            <Button asChild variant="outline">
              <Link href={`/dashboard/products/${productId}/themes`}>View AI Themes</Link>
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
