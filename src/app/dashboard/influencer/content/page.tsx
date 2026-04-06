'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Loader2, FileText, Plus, Image, Video, BookOpen } from 'lucide-react'
import { toast } from 'sonner'

const MEDIA_ICONS: Record<string, any> = {
  image: Image,
  video: Video,
  reel: Video,
  article: BookOpen,
}

export default function InfluencerContentPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ title: '', body: '', mediaType: 'image', tags: '' })

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/influencer/content')
      .then(r => r.json())
      .then(data => setPosts(data.posts ?? []))
      .finally(() => setLoading(false))
  }, [status])

  const handleCreate = async () => {
    if (!form.title) { toast.error('Title is required'); return }
    setCreating(true)
    try {
      const res = await fetch('/api/influencer/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          body: form.body || undefined,
          mediaType: form.mediaType,
          tags: form.tags.split(',').map(s => s.trim()).filter(Boolean),
        }),
      })
      if (!res.ok) throw new Error('Failed to create')
      const data = await res.json()
      setPosts(prev => [data.post, ...prev])
      setForm({ title: '', body: '', mediaType: 'image', tags: '' })
      setDialogOpen(false)
      toast.success('Post created as draft')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-headline flex items-center gap-2">
            <FileText className="h-6 w-6" />
            My Content
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your content posts and deliverables.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-3.5 w-3.5 mr-1" /> New Post</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Content Post</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Post title" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Media Type</Label>
                <select className="w-full border rounded px-3 py-2 text-sm" value={form.mediaType} onChange={e => setForm(f => ({ ...f, mediaType: e.target.value }))}>
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                  <option value="reel">Reel</option>
                  <option value="story">Story</option>
                  <option value="carousel">Carousel</option>
                  <option value="article">Article</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Tags (comma-separated)</Label>
                <Input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="skincare, review, unboxing" />
              </div>
              <Button onClick={handleCreate} disabled={creating} className="w-full">
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create Draft
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {posts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center gap-2">
            <FileText className="h-7 w-7 text-muted-foreground" />
            <p className="text-sm font-medium">No content posts yet</p>
            <p className="text-xs text-muted-foreground">Create your first post to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {posts.map((post: any) => {
            const Icon = MEDIA_ICONS[post.mediaType] ?? FileText
            return (
              <Card key={post.id} className="hover:border-primary/20 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      {post.title}
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px]">{post.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {post.body && <p className="text-xs text-muted-foreground line-clamp-2">{post.body}</p>}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {post.tags?.map((t: string) => (
                      <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    {new Date(post.createdAt).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
