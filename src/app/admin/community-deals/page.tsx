'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Loader2, CheckCircle, XCircle, Flag, Shield, Clock,
  MessageSquare, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'

type Post = {
  id: string; authorId: string; authorRole: string; postType: string
  title: string; body: string; promoCode: string | null
  category: string | null; status: string; createdAt: string
  upvoteCount: number; commentCount: number
}

type FlaggedItem = {
  content_type: string; content_id: string; flag_count: number
}

function getTimeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const hours = Math.floor(diff / 3600_000)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function AdminCommunityDealsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const isAdmin = (session?.user as any)?.role === 'admin'

  const [tab, setTab] = useState('pending')
  const [pending, setPending] = useState<Post[]>([])
  const [flagged, setFlagged] = useState<FlaggedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const loadPending = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/community-deals/pending')
      const data = await res.json()
      setPending(data.posts ?? [])
    } catch { toast.error('Failed to load pending posts') }
    finally { setLoading(false) }
  }, [])

  const loadFlagged = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/community-deals/flagged')
      const data = await res.json()
      setFlagged(data.flagged ?? [])
    } catch { toast.error('Failed to load flagged content') }
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    loadPending()
    loadFlagged()
  }, [isAdmin, loadPending, loadFlagged])

  const handleApprove = async (postId: string) => {
    setActing(postId)
    const res = await fetch('/api/admin/community-deals/moderate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, action: 'approve' }),
    })
    setActing(null)
    if (res.ok) { toast.success('Post approved'); loadPending() }
    else toast.error('Approve failed')
  }

  const handleReject = async () => {
    if (!rejectId || !rejectReason.trim()) { toast.error('Reason required'); return }
    setActing(rejectId)
    const res = await fetch('/api/admin/community-deals/moderate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId: rejectId, action: 'reject', reason: rejectReason }),
    })
    setActing(null)
    setRejectId(null)
    setRejectReason('')
    if (res.ok) { toast.success('Post rejected'); loadPending() }
    else toast.error('Reject failed')
  }

  const handleBulk = async (action: 'approve' | 'reject') => {
    if (selected.size === 0) return
    const res = await fetch('/api/admin/community-deals/moderate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postIds: Array.from(selected), action, reason: action === 'reject' ? 'Bulk rejected by admin' : undefined }),
    })
    if (res.ok) {
      toast.success(`${selected.size} posts ${action}d`)
      setSelected(new Set())
      loadPending()
    } else toast.error('Bulk action failed')
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Shield className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p>Admin access required</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Community Deals Moderation</h1>
        <p className="text-muted-foreground text-sm">Review pending posts and flagged content</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="pending">
            Pending {pending.length > 0 && <Badge variant="secondary" className="ml-1 bg-amber-900/50 text-amber-300 text-[10px]">{pending.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="flagged">
            Flagged {flagged.length > 0 && <Badge variant="secondary" className="ml-1 bg-red-900/50 text-red-300 text-[10px]">{flagged.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-3 mt-4">
          {selected.size > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50 border border-border/60">
              <span className="text-sm">{selected.size} selected</span>
              <Button size="sm" variant="outline" onClick={() => handleBulk('approve')}>
                <CheckCircle className="h-3 w-3 mr-1" />Approve All
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulk('reject')}>
                <XCircle className="h-3 w-3 mr-1" />Reject All
              </Button>
            </div>
          )}

          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="border-border/60"><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))
          ) : pending.length > 0 ? (
            pending.map(post => (
              <Card key={post.id} className={`border-border/60 ${selected.has(post.id) ? 'ring-1 ring-indigo-500' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selected.has(post.id)}
                      onChange={() => toggleSelect(post.id)}
                      className="mt-1 h-4 w-4 rounded border-border"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm">{post.title}</h3>
                        <Badge variant="outline" className="text-[10px]">{post.postType}</Badge>
                        <Badge variant="outline" className="text-[10px]">{post.authorRole}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{post.body}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span><Clock className="h-3 w-3 inline mr-0.5" />{getTimeAgo(post.createdAt)}</span>
                        {post.promoCode && <span className="text-emerald-400">Code: {post.promoCode}</span>}
                        {post.category && <span>{post.category}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" disabled={acting === post.id} onClick={() => handleApprove(post.id)}>
                        {acting === post.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3 mr-1 text-emerald-400" />}
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setRejectId(post.id)}>
                        <XCircle className="h-3 w-3 mr-1 text-red-400" />Reject
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No pending posts. All caught up!</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="flagged" className="space-y-3 mt-4">
          {flagged.length > 0 ? (
            flagged.map((item, i) => (
              <Card key={i} className="border-border/60">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Flag className="h-4 w-4 text-red-400" />
                      <span className="text-sm font-medium">{item.content_type}: {item.content_id.slice(0, 8)}...</span>
                      <Badge className="bg-red-900/50 text-red-300 text-[10px]">{item.flag_count} flags</Badge>
                    </div>
                  </div>
                  <Button size="sm" variant="outline">Review</Button>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Flag className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No flagged content</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Reject Dialog */}
      <Dialog open={!!rejectId} onOpenChange={() => { setRejectId(null); setRejectReason('') }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Post</DialogTitle></DialogHeader>
          <Textarea
            placeholder="Reason for rejection..."
            rows={3}
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>Cancel</Button>
            <Button onClick={handleReject} disabled={!rejectReason.trim()} className="bg-red-600 hover:bg-red-500 text-white">
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
