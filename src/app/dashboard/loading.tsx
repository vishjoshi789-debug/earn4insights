export default function DashboardLoading() {
  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 animate-pulse">
      {/* Title skeleton */}
      <div className="h-8 w-48 rounded-md bg-muted" />

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-lg border bg-card p-4 space-y-3">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-6 w-16 rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="h-64 rounded-lg border bg-card" />
    </div>
  )
}
