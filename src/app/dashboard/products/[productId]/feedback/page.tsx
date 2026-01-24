export default async function FeedbackPage({
  params,
}: {
  params: Promise<{ productId: string }>
}) {
  const { productId } = await params
  
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold">Feedback</h1>
      <p className="text-muted-foreground mt-2">
        Feedback for product: {productId}
      </p>
    </div>
  )
}
