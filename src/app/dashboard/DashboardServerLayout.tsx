import type { ReactNode } from 'react'
import DashboardShell from './DashboardShell'

export default function DashboardServerLayout({
  children,
}: {
  children: ReactNode
}) {
  return <DashboardShell>{children}</DashboardShell>
}
