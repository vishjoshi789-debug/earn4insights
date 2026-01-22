export default function SocialPage({
  params,
}: {
  params: { productId: string }
}) {
  const productId = params.productId

  if (!productId) {
    return <div className="p-6">Invalid product</div>
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold">Social Listening</h1>
      <p className="text-muted-foreground mt-2">
        Social insights for product: {productId}
      </p>
    </div>
  )
}
