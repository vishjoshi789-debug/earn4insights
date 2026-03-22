import { redirect } from 'next/navigation'

// Merged into /dashboard/feedback — redirect for backwards compatibility
export default function UnifiedAnalyticsPage() {
  redirect('/dashboard/feedback')
}
