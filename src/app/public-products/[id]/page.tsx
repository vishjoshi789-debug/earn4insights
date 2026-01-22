import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PublicFeedbackForm } from '@/components/public-feedback-form'
import { ExternalLink, Quote } from 'lucide-react'
import { getProductById } from '@/server/products/productService'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function PublicProductPage({ params }: PageProps) {
  const { id } = await params
  const product = await getProductById(id)

  if (!product || !product.profile.isComplete) {
    notFound()
  }

  const { profile } = product
  const { branding, productDetails, context } = profile.data

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {branding?.logo && (
                <div className="relative w-12 h-12 rounded-lg overflow-hidden border bg-white">
                  <Image
                    src={branding.logo.url}
                    alt={`${product.name} logo`}
                    fill
                    className="object-contain p-1"
                  />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold">{product.name}</h1>
                {productDetails?.tagline && (
                  <p className="text-sm text-muted-foreground">{productDetails.tagline}</p>
                )}
              </div>
            </div>
            {productDetails?.website && (
              <Button asChild variant="outline">
                <Link href={productDetails.website} target="_blank" rel="noopener noreferrer">
                  Visit Website
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-5xl">
        <div className="space-y-12">
          {/* Product Images Gallery */}
          {branding?.productImages && branding.productImages.length > 0 && (
            <section>
              <div className={`grid gap-4 ${
                branding.productImages.length === 1 ? 'grid-cols-1' :
                branding.productImages.length === 2 ? 'grid-cols-2' :
                'grid-cols-3'
              }`}>
                {branding.productImages.map((image, index) => (
                  <div
                    key={index}
                    className="relative aspect-video rounded-lg overflow-hidden border bg-white shadow-sm"
                  >
                    <Image
                      src={image.url}
                      alt={image.alt || `${product.name} screenshot ${index + 1}`}
                      fill
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* About Section */}
          {productDetails?.description && (
            <section>
              <h2 className="text-3xl font-bold mb-4">About {product.name}</h2>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-lg leading-relaxed text-muted-foreground whitespace-pre-line">
                    {productDetails.description}
                  </p>
                </CardContent>
              </Card>
            </section>
          )}

          {/* Key Features */}
          {productDetails?.keyFeatures && productDetails.keyFeatures.length > 0 && (
            <section>
              <h2 className="text-3xl font-bold mb-4">Key Features</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {productDetails.keyFeatures.map((feature, index) => (
                  <Card key={index}>
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-3">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: branding?.primaryColor || '#3b82f6' }}
                        >
                          <svg
                            className="w-5 h-5 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                        <p className="text-base flex-1">{feature}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Testimonials */}
          {context?.testimonials && context.testimonials.length > 0 && (
            <section>
              <h2 className="text-3xl font-bold mb-4">What People Say</h2>
              <div className="grid md:grid-cols-2 gap-6">
                {context.testimonials.map((testimonial, index) => (
                  <Card key={index} className="relative">
                    <CardContent className="pt-8 pb-6">
                      <Quote className="absolute top-4 right-4 w-8 h-8 text-muted-foreground/20" />
                      <blockquote className="space-y-4">
                        <p className="text-base italic leading-relaxed">
                          "{testimonial.quote}"
                        </p>
                        <footer className="text-sm">
                          <div className="font-semibold">{testimonial.author}</div>
                          {(testimonial.role || testimonial.company) && (
                            <div className="text-muted-foreground">
                              {[testimonial.role, testimonial.company].filter(Boolean).join(', ')}
                            </div>
                          )}
                        </footer>
                      </blockquote>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Product Metadata */}
          <section>
            <div className="flex flex-wrap gap-4 items-center">
              {context?.productStage && (
                <Badge variant="secondary" className="text-sm">
                  {context.productStage.split('-').map(word => 
                    word.charAt(0).toUpperCase() + word.slice(1)
                  ).join(' ')}
                </Badge>
              )}
              {context?.userBase && (
                <Badge variant="outline" className="text-sm">
                  User Base: {context.userBase}
                </Badge>
              )}
            </div>
          </section>

          {/* Feedback Form */}
          <section>
            <h2 className="text-3xl font-bold mb-6">We'd Love Your Feedback</h2>
            <PublicFeedbackForm productId={id} />
          </section>

          {/* Social Links */}
          {(context?.socialMedia?.twitter || context?.socialMedia?.linkedin) && (
            <section className="border-t pt-8">
              <p className="text-sm text-muted-foreground mb-4">Follow us on social media:</p>
              <div className="flex gap-4">
                {context.socialMedia.twitter && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={context.socialMedia.twitter} target="_blank" rel="noopener noreferrer">
                      Twitter
                    </Link>
                  </Button>
                )}
                {context.socialMedia.linkedin && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={context.socialMedia.linkedin} target="_blank" rel="noopener noreferrer">
                      LinkedIn
                    </Link>
                  </Button>
                )}
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16 py-8 bg-gray-50">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Powered by Your Platform • {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  )
}
