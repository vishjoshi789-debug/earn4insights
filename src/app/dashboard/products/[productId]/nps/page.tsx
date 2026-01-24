export default async function NpsPage({
  params,
}: {
  params: Promise<{ productId: string }>
}) {
  const { productId } = await params
  return (
    <div className="p-6 space-y-2">
      <h1 className="text-xl font-bold">NPS Dashboard</h1>
      <p className="text-muted-foreground">
        Product ID: {productId}
      </p>
    </div>
  )
}
