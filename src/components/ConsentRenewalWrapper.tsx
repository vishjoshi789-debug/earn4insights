'use client'

import { useState, useEffect } from 'react'
import { UserProfile } from '@/db/schema'
import { ConsentRenewalModal } from './ConsentRenewalModal'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface ConsentRenewalWrapperProps {
  profile: UserProfile
  userRole?: string
}

export function ConsentRenewalWrapper({ profile, userRole }: ConsentRenewalWrapperProps) {
  const router = useRouter()
  const [hasRenewed, setHasRenewed] = useState(false)
  const [autoGranting, setAutoGranting] = useState(false)

  const isBrand = userRole === 'brand'
  const consentGrantedAt = (profile.consent as any)?.grantedAt || null

  // For first-time brands (no consent date), auto-grant essential consents silently
  useEffect(() => {
    if (isBrand && !consentGrantedAt && !hasRenewed && !autoGranting) {
      setAutoGranting(true)
      fetch('/api/user/renew-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consents: {
            tracking: false,
            personalization: false,
            analytics: true,
            marketing: true,
          }
        })
      })
        .then((res) => {
          if (res.ok) {
            setHasRenewed(true)
            router.refresh()
          }
        })
        .catch(() => { /* silent — will show modal as fallback */ })
        .finally(() => setAutoGranting(false))
    }
  }, [isBrand, consentGrantedAt, hasRenewed, autoGranting, router])

  const handleRenewed = () => {
    setHasRenewed(true)
    router.refresh()
  }

  // Don't show modal if already renewed, auto-granting, or first-time brand
  if (hasRenewed || autoGranting || (isBrand && !consentGrantedAt)) {
    return null
  }

  return (
    <ConsentRenewalModal
      userId={profile.id}
      currentConsent={profile.consent || {}}
      consentGrantedAt={consentGrantedAt}
      userRole={userRole}
      onRenewed={handleRenewed}
    />
  )
}
