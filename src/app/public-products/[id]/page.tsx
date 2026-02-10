import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { StarRating } from '@/components/star-rating'
import { FeedbackForm } from '@/components/feedback-form'
import { ExternalLink, Quote } from 'lucide-react'
import { mockProducts, mockFeedback, mockSocialPosts } from '@/lib/data'
import { ProductViewTracker } from './ProductViewTracker'

// Image mapping for mock products (picsum deterministic seeds)
const productImages: Record<string, string> = {
  'product-smartwatch': 'https://picsum.photos/seed/smartwatch/800/500',
  'product-headphones': 'https://picsum.photos/seed/headphones/800/500',
  'product-camera': 'https://picsum.photos/seed/camera/800/500',
  'product-shoes': 'https://picsum.photos/seed/shoes/800/500',
  'product-drone': 'https://picsum.photos/seed/drone/800/500',
  'product-skincare': 'https://picsum.photos/seed/skincare/800/500',
}

type PageProps = {
  params: Promise<{ id: string }>
}

function formatTimeAgo(timestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const months = Math.floor(days / 30)
  const years = Math.floor(days / 365)
  if (years > 0) return `${years} year${years > 1 ? 's' : ''} ago`
  if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  return 'just now'
}

export default async function PublicProductPage({ params }: PageProps) {
  const { id } = await params

  // Try mock products first
  const mockProduct = mockProducts.find((p) => p.id === id)

  if (!mockProduct) {
    // Not a mock product — try DB
    let dbProduct = null
    try {
      const { getProductById } = await import('@/server/products/productService')
      dbProduct = await getProductById(id)
    } catch {
      // DB unavailable
    }
    if (!dbProduct || !dbProduct.profile?.isComplete) {
      notFound()
    }

    // Render DB product with the rich profile layout
    const { profile } = dbProduct
    const { branding, productDetails, context } = profile.data
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <ProductViewTracker productId={id} />
        <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {branding?.logo && (
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden border bg-white">
                    <Image src={branding.logo.url} alt={`${dbProduct.name} logo`} fill className="object-contain p-1" />
                  </div>
                )}
                <div>
                  <h1 className="text-2xl font-bold">{dbProduct.name}</h1>
                  {productDetails?.tagline && <p className="text-sm text-muted-foreground">{productDetails.tagline}</p>}
                </div>
              </div>
              {productDetails?.website && (
                <Button asChild variant="outline">
                  <Link href={productDetails.website} target="_blank" rel="noopener noreferrer">
                    Visit Website <ExternalLink className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-12">
          <div className="space-y-12">
            {branding?.productImages && branding.productImages.length > 0 && (
              <section>
                <div className={`grid gap-4 ${branding.productImages.length === 1 ? 'grid-cols-1' : branding.productImages.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                  {branding.productImages.map((image, index) => (
                    <div key={index} className="relative aspect-video rounded-lg overflow-hidden border bg-white shadow-sm">
                      <Image src={image.url} alt={image.alt || `${dbProduct.name} screenshot ${index + 1}`} fill className="object-cover" />
                    </div>
                  ))}
                </div>
              </section>
            )}
            {productDetails?.description && (
              <section>
                <h2 className="text-3xl font-bold mb-4">About {dbProduct.name}</h2>
                <Card><CardContent className="pt-6"><p className="text-lg leading-relaxed text-muted-foreground whitespace-pre-line">{productDetails.description}</p></CardContent></Card>
              </section>
            )}
            {productDetails?.keyFeatures && productDetails.keyFeatures.length > 0 && (
              <section>
                <h2 className="text-3xl font-bold mb-4">Key Features</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {productDetails.keyFeatures.map((feature, index) => (
                    <Card key={index}><CardContent className="pt-6"><p>{feature}</p></CardContent></Card>
                  ))}
                </div>
              </section>
            )}
            {context?.testimonials && context.testimonials.length > 0 && (
              <section>
                <h2 className="text-3xl font-bold mb-4">What People Say</h2>
                <div className="grid md:grid-cols-2 gap-6">
                  {context.testimonials.map((t, i) => (
                    <Card key={i} className="relative"><CardContent className="pt-8 pb-6">
                      <Quote className="absolute top-4 right-4 w-8 h-8 text-muted-foreground/20" />
                      <blockquote className="space-y-4">
                        <p className="text-base italic leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                        <footer className="text-sm"><div className="font-semibold">{t.author}</div></footer>
                      </blockquote>
                    </CardContent></Card>
                  ))}
                </div>
              </section>
            )}
          </div>
        </main>
        <footer className="border-t mt-16 py-8 bg-gray-50">
          <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
            <p>Powered by Earn4Insights &bull; {new Date().getFullYear()}</p>
          </div>
        </footer>
      </div>
    )
  }

  // ── Mock product detail page ──
  const imageUrl = productImages[mockProduct.imageId] || `https://picsum.photos/seed/${mockProduct.id}/800/500`

  // Get feedback for this product (non-fake only)
  const feedbackList = mockFeedback
    .filter((f) => f.productId === id && !f.analysis.isPotentiallyFake)
    .slice(0, 5)

  // Get social mentions for this product
  const socialMentions = mockSocialPosts.filter((s) => s.productId === id).slice(0, 4)

  const avgRating = feedbackList.length > 0
    ? feedbackList.reduce((sum, f) => sum + f.rating, 0) / feedbackList.length
    : 0

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <ProductViewTracker productId={id} />

      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/public-products" className="text-sm text-muted-foreground hover:text-primary mb-1 inline-block">
                &larr; Back to Products
              </Link>
              <h1 className="text-2xl font-bold">{mockProduct.name}</h1>
            </div>
            <Badge variant="secondary" className="text-lg px-4 py-1">
              ${mockProduct.price.toFixed(2)}
            </Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
          {/* Left column — Image + Description */}
          <div className="space-y-6">
            <div className="relative aspect-video w-full overflow-hidden rounded-lg shadow-lg border bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={mockProduct.name}
                className="w-full h-full object-cover"
              />
            </div>

            <div>
              <h2 className="text-3xl font-bold mb-2">{mockProduct.name}</h2>
              <p className="text-2xl font-semibold text-primary mb-4">
                ${mockProduct.price.toFixed(2)}
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {mockProduct.description}
              </p>
            </div>

            {/* Rating summary */}
            {feedbackList.length > 0 && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <StarRating rating={Math.round(avgRating)} />
                    <span className="text-lg font-semibold">{avgRating.toFixed(1)}</span>
                    <span className="text-sm text-muted-foreground">
                      ({feedbackList.length} review{feedbackList.length !== 1 ? 's' : ''})
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right column — Feedback form + Reviews */}
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold mb-4">Leave Your Feedback</h2>
              <FeedbackForm productId={id} />
            </div>

            <Separator />

            {/* Recent Reviews */}
            <div>
              <h2 className="text-2xl font-bold mb-4">Recent Feedback</h2>
              <div className="space-y-4">
                {feedbackList.length > 0 ? (
                  feedbackList.map((feedback) => (
                    <Card key={feedback.id}>
                      <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
                        <Avatar>
                          <AvatarImage src={feedback.userAvatar} />
                          <AvatarFallback>{feedback.userName.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold">{feedback.userName}</p>
                            <p className="text-xs text-muted-foreground">{formatTimeAgo(feedback.timestamp)}</p>
                          </div>
                          <StarRating rating={feedback.rating} />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-foreground/90">{feedback.text}</p>
                        <div className="mt-2 flex gap-2">
                          <Badge variant={feedback.analysis.sentiment === 'positive' ? 'default' : feedback.analysis.sentiment === 'negative' ? 'destructive' : 'secondary'} className="text-xs">
                            {feedback.analysis.sentiment}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            Authenticity: {Math.round(feedback.analysis.authenticityScore * 100)}%
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Be the first to leave feedback for this product!
                  </p>
                )}
              </div>
            </div>

            {/* Social Mentions */}
            {socialMentions.length > 0 && (
              <>
                <Separator />
                <div>
                  <h2 className="text-2xl font-bold mb-4">Social Mentions</h2>
                  <div className="space-y-4">
                    {socialMentions.map((post) => (
                      <Card key={post.id}>
                        <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
                          <Avatar>
                            <AvatarImage src={post.userAvatar} />
                            <AvatarFallback>{post.userName.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold">{post.userName}</p>
                                <p className="text-xs text-muted-foreground">{post.userHandle}</p>
                              </div>
                              <Badge variant="outline" className="text-xs capitalize">{post.platform}</Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-foreground/90 mb-2">{post.text}</p>
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            <span>❤️ {post.likes.toLocaleString()}</span>
                            <span>🔁 {post.shares.toLocaleString()}</span>
                            <span>💬 {post.comments.toLocaleString()}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16 py-8 bg-gray-50">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Powered by Earn4Insights &bull; {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  )
}
