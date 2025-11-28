import { mockProducts, mockFeedback } from "@/lib/data";
import { notFound } from "next/navigation";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import Image from "next/image";
import { Separator } from "@/components/ui/separator";
import { StarRating } from "@/components/star-rating";
import { FeedbackForm } from "@/components/feedback-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";

type PageProps = {
  params: { id: string };
};

export default function PublicProductDetailPage({ params }: PageProps) {
  const id = params.id;

  // Find the product by id (string-safe comparison)
  const product = mockProducts.find((p) => String(p.id) === String(id));

  if (!product) {
    notFound();
  }

  // Find the image by product.imageId (string/number-safe)
  const image =
    product?.imageId != null
      ? PlaceHolderImages.find(
          (img) => String(img.id) === String(product.imageId)
        )
      : undefined;

  const feedbackList = mockFeedback
    .filter(
      (f) =>
        String(f.productId) === String(id) && !f.analysis.isPotentiallyFake
    )
    .slice(0, 3);

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
        <div className="space-y-6">
          {image?.imageUrl && (
            <div className="relative aspect-video w-full overflow-hidden rounded-lg shadow-lg">
              <Image
                src={image.imageUrl}
                alt={product.name}
                fill
                className="object-cover"
                data-ai-hint={image.imageHint}
              />
            </div>
          )}

          <h1 className="font-headline text-4xl font-bold">
            {product.name}
          </h1>
          <p className="text-2xl font-semibold text-primary">
            ${product.price.toFixed(2)}
          </p>
          <p className="text-lg text-muted-foreground">
            {product.description}
          </p>
        </div>

        <div className="space-y-8">
          <FeedbackForm />

          <Separator />

          <div>
            <h2 className="font-headline text-2xl font-bold mb-4">
              Recent Feedback
            </h2>
            <div className="space-y-4">
              {feedbackList.length > 0 ? (
                feedbackList.map((feedback) => (
                  <Card key={feedback.id}>
                    <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                      <Avatar>
                        <AvatarImage src={feedback.userAvatar} />
                        <AvatarFallback>
                          {feedback.userName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold">
                            {feedback.userName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(
                              new Date(feedback.timestamp),
                              { addSuffix: true }
                            )}
                          </p>
                        </div>
                        {/* StarRating expects value={number} */}
                        <StarRating value={feedback.rating} />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-foreground/90">
                        {feedback.text}
                      </p>
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
        </div>
      </div>
    </div>
  );
}
