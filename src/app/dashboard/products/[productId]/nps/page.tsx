export default function NpsPage({
  params,
}: {
  params: { productId: string }
}) {
  return (
    <div className="p-6 space-y-2">
      <h1 className="text-xl font-bold">NPS Dashboard</h1>
      <p className="text-muted-foreground">
        Product ID: {params.productId}
      </p>
    </div>
  )
}
