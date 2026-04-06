'use client'

/**
 * Brand ICP Profiles — List Page
 * /dashboard/brand/icps
 *
 * Shows all ICPs for the authenticated brand.
 * Allows creating a new ICP via a dialog.
 */

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Target, Plus, ChevronRight, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

type BrandIcp = {
  id: string
  name: string
  description: string | null
  matchThreshold: number
  isActive: boolean
  productId: string | null
  attributes: {
    criteria: Record<string, unknown>
    totalWeight: number
  }
  createdAt: string
}

export default function BrandIcpsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [icps, setIcps] = useState<BrandIcp[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newThreshold, setNewThreshold] = useState('60')

  const userRole = (session?.user as any)?.role

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin')
    if (status === 'authenticated' && userRole && userRole !== 'brand') router.push('/dashboard')
  }, [status, userRole, router])

  const fetchIcps = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/brand/icps?activeOnly=false')
      if (!res.ok) throw new Error('Failed to load ICP profiles')
      const data = await res.json()
      setIcps(data.icps ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && userRole === 'brand') fetchIcps()
  }, [status, userRole, fetchIcps])

  async function handleCreate() {
    if (!newName.trim()) {
      toast.error('ICP name is required')
      return
    }
    const threshold = parseInt(newThreshold)
    if (isNaN(threshold) || threshold < 0 || threshold > 100) {
      toast.error('Match threshold must be 0–100')
      return
    }

    setCreating(true)
    try {
      const res = await fetch('/api/brand/icps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || null,
          matchThreshold: threshold,
          attributes: {
            version: '1.0',
            totalWeight: 0,
            criteria: {},
          },
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to create ICP')
      }
      const { icp } = await res.json()
      toast.success('ICP created — add criteria to start scoring')
      setDialogOpen(false)
      setNewName('')
      setNewDescription('')
      setNewThreshold('60')
      // Navigate directly to the edit page
      router.push(`/dashboard/brand/icps/${icp.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create ICP')
    } finally {
      setCreating(false)
    }
  }

  if (status === 'loading' || (status === 'authenticated' && !userRole)) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-headline flex items-center gap-2">
            <Target className="h-6 w-6" />
            ICP Profiles
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define your Ideal Consumer Profiles to score and target matching audiences.
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-1" />
              New ICP
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create ICP Profile</DialogTitle>
              <DialogDescription>
                Give your ICP a name and set a match threshold. You&apos;ll add criteria next.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="icp-name">Name *</Label>
                <Input
                  id="icp-name"
                  placeholder="e.g. Premium Urban Millennials"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="icp-desc">Description</Label>
                <Input
                  id="icp-desc"
                  placeholder="Optional description"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="icp-threshold">
                  Match Threshold (0–100)
                </Label>
                <Input
                  id="icp-threshold"
                  type="number"
                  min={0}
                  max={100}
                  value={newThreshold}
                  onChange={(e) => setNewThreshold(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Consumers scoring at or above this value are considered a match.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create & Add Criteria
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center min-h-[20vh]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && icps.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Target className="h-10 w-10 text-muted-foreground mb-3" />
            <h3 className="font-semibold text-lg">No ICP Profiles yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1">
              Create your first Ideal Consumer Profile to start scoring consumers and triggering targeted alerts.
            </p>
            <Button className="mt-4" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create first ICP
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ICP grid */}
      {!loading && icps.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {icps.map((icp) => {
            const criteriaCount = Object.keys(icp.attributes?.criteria ?? {}).length
            return (
              <Card key={icp.id} className="flex flex-col hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug">{icp.name}</CardTitle>
                    <Badge variant={icp.isActive ? 'default' : 'secondary'} className="shrink-0">
                      {icp.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  {icp.description && (
                    <CardDescription className="text-xs line-clamp-2">{icp.description}</CardDescription>
                  )}
                </CardHeader>

                <CardContent className="flex-1 pb-2">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <dt className="text-muted-foreground">Threshold</dt>
                    <dd className="font-medium">{icp.matchThreshold}%</dd>
                    <dt className="text-muted-foreground">Criteria</dt>
                    <dd className="font-medium">{criteriaCount}</dd>
                    <dt className="text-muted-foreground">Scope</dt>
                    <dd className="font-medium">{icp.productId ? 'Product' : 'Brand-wide'}</dd>
                  </dl>
                </CardContent>

                <CardFooter className="pt-2">
                  <Button asChild variant="outline" size="sm" className="w-full gap-1">
                    <Link href={`/dashboard/brand/icps/${icp.id}`}>
                      View / Edit
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
