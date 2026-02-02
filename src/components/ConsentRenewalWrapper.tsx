'use client'

import { useState } from 'react'
import { UserProfile } from '@/db/schema'
import { ConsentRenewalModal } from './ConsentRenewalModal'
import { useRouter } from 'next/navigation'

interface ConsentRenewalWrapperProps {
  profile: UserProfile
}

export function ConsentRenewalWrapper({ profile }: ConsentRenewalWrapperProps) {
  const router = useRouter()
  const [hasRenewed, setHasRenewed] = useState(false)

  const handleRenewed = () => {
    setHasRenewed(true)
    // Refresh the page to get updated consent data
    router.refresh()
  }

  // Don't show modal if already renewed in this session
  if (hasRenewed) {
    return null
  }

  return (
    <ConsentRenewalModal
      userId={profile.id}
      currentConsent={profile.consent || {}}
      consentGrantedAt={(profile.consent as any)?.grantedAt || null}
      onRenewed={handleRenewed}
    />
  )
}
