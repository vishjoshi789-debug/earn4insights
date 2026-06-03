'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Building2, ShoppingBag, Sparkles, ShieldCheck,
  ChevronDown, Check, Loader2,
} from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { apiPost } from '@/lib/api-client'
import { useActiveView } from './ActiveViewProvider'

/**
 * Header role switcher (3.5E). Hidden for single-role users; visible
 * when the user has ≥ 2 capability flags set (e.g. consumer +
 * influencer dual-role).
 *
 * Two-tier control:
 *   - Click a role → session-only switch (sessionStorage)
 *   - "Make X my default view" → POST /api/user/primary-view updates
 *     users.role so the next login lands on this view automatically
 *
 * Admin is never switchable here — admins use /admin/* surfaces.
 */

type Role = 'brand' | 'consumer' | 'influencer'

const ROLE_META: Record<Role, {
  label: string
  icon: typeof Building2
  description: string
}> = {
  brand: {
    label: 'Brand',
    icon: Building2,
    description: 'Track feedback, run campaigns',
  },
  consumer: {
    label: 'Consumer',
    icon: ShoppingBag,
    description: 'Earn rewards, share feedback',
  },
  influencer: {
    label: 'Influencer',
    icon: Sparkles,
    description: 'Apply to campaigns, get paid',
  },
}

export function RoleSwitcher() {
  const { data: session } = useSession()
  const router = useRouter()
  const { activeView, setActiveView, defaultView } = useActiveView()
  const [saving, setSaving] = useState(false)

  if (!session?.user) return null

  const u = session.user as {
    role?: string
    isBrand?: boolean
    isConsumer?: boolean
    isInfluencer?: boolean
  }

  // Build the list of roles this user can switch to. Admins are
  // excluded from the dropdown — they have their own /admin/* surface
  // and the switcher isn't meaningful for them.
  const available: Role[] = []
  if (u.isBrand) available.push('brand')
  if (u.isConsumer) available.push('consumer')
  if (u.isInfluencer) available.push('influencer')

  // Backwards compat: if a user's primary role isn't represented by
  // any flag (legacy data, or admin), include it so the switcher
  // shows them their actual current view (admin shows as 'consumer'
  // in dropdown but they typically don't need to switch).
  if (
    u.role === 'brand' || u.role === 'consumer' || u.role === 'influencer'
  ) {
    if (!available.includes(u.role)) available.push(u.role)
  }

  // Hide entirely for single-role users (Q2 approved) — no clutter.
  if (available.length < 2) return null

  // Render the currently active view's icon + label in the trigger.
  // If activeView is somehow not in available (shouldn't happen),
  // fall back to defaultView.
  const displayView: Role = available.includes(activeView as Role)
    ? (activeView as Role)
    : (available.includes(defaultView as Role)
        ? (defaultView as Role)
        : available[0])
  const currentMeta = ROLE_META[displayView]
  const Icon = currentMeta.icon

  const isDefault = displayView === defaultView

  const handleSwitch = (role: Role) => {
    setActiveView(role)
    // Refresh server components so role-specific dashboards re-render.
    // Specifically /dashboard branches on session.user.role (which
    // hasn't changed yet on session-only switch) — but downstream
    // pages that read activeView from the context update via React.
    // We trigger a refresh anyway so any cached server-side data
    // reflecting the previous view drops.
    router.refresh()
  }

  const handleSetDefault = async () => {
    setSaving(true)
    try {
      const res = await apiPost('/api/user/primary-view', { role: displayView })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? 'Failed to set default view')
      }
      toast.success(`Default view set to ${currentMeta.label}`)
      // A fresh JWT is needed for session.user.role to reflect the
      // new default on subsequent loads. router.refresh() reloads
      // server components but does NOT mint a new JWT — that happens
      // on next sign-in. For now the session-only switch covers the
      // current tab; the persisted default applies to the next login.
      router.refresh()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to set default view')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 h-9 hidden sm:flex"
          data-tour="role-switcher"
        >
          <Icon className="h-3.5 w-3.5" />
          <span className="text-xs">{currentMeta.label} view</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Switch view
        </DropdownMenuLabel>
        {available.map((r) => {
          const meta = ROLE_META[r]
          const ItemIcon = meta.icon
          const isActive = r === displayView
          return (
            <DropdownMenuItem
              key={r}
              onClick={() => handleSwitch(r)}
              className="flex items-start gap-2 cursor-pointer py-2"
            >
              <ItemIcon className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  {meta.label}
                  {isActive && (
                    <Check className="h-3 w-3 text-emerald-500" />
                  )}
                  {r === defaultView && (
                    <span className="text-[10px] text-muted-foreground font-normal">(default)</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">{meta.description}</p>
              </div>
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuSeparator />
        {isDefault ? (
          <div className="px-2 py-1.5 text-[11px] text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3" />
            {currentMeta.label} is your default view
          </div>
        ) : (
          <DropdownMenuItem
            onClick={handleSetDefault}
            disabled={saving}
            className="text-xs cursor-pointer"
          >
            {saving ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : null}
            Make {currentMeta.label} my default view
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
