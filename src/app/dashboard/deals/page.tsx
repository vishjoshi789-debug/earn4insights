import { auth } from '@/lib/auth/auth.config'
import { redirect } from 'next/navigation'
import DealsClient from './DealsClient'

export default async function DealsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/dashboard/deals')
  }
  const role = (session.user as any).role
  if (role === 'brand') {
    redirect('/dashboard/brand/deals')
  }
  return <DealsClient />
}
