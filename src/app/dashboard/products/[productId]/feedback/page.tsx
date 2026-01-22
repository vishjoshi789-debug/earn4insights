export default function FeedbackPage({
  params,
}: {
  params: { productId: string }
}) {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold">Feedback</h1>
      <p className="text-muted-foreground mt-2">
        Feedback for product: {params.productId}
      </p>
    </div>
  )
}
