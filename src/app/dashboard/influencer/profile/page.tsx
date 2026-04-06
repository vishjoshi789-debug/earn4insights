'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Loader2, User, CheckCircle, AlertCircle, Instagram, Youtube, Twitter, Linkedin } from 'lucide-react'
import { toast } from 'sonner'

export default function InfluencerProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [socialStats, setSocialStats] = useState<any[]>([])

  const [form, setForm] = useState({
    displayName: '',
    bio: '',
    niche: '',
    location: '',
    instagramHandle: '',
    youtubeHandle: '',
    twitterHandle: '',
    linkedinHandle: '',
    baseRate: '',
    currency: 'INR',
  })

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/influencer/profile')
      .then(r => r.json())
      .then(data => {
        if (data.registered && data.profile) {
          setRegistered(true)
          setProfile(data.profile)
          setSocialStats(data.socialStats ?? [])
          setForm({
            displayName: data.profile.displayName ?? '',
            bio: data.profile.bio ?? '',
            niche: (data.profile.niche ?? []).join(', '),
            location: data.profile.location ?? '',
            instagramHandle: data.profile.instagramHandle ?? '',
            youtubeHandle: data.profile.youtubeHandle ?? '',
            twitterHandle: data.profile.twitterHandle ?? '',
            linkedinHandle: data.profile.linkedinHandle ?? '',
            baseRate: data.profile.baseRate ? String(data.profile.baseRate / 100) : '',
            currency: data.profile.currency ?? 'INR',
          })
        }
      })
      .finally(() => setLoading(false))
  }, [status])

  const handleSubmit = async () => {
    setSaving(true)
    try {
      const niche = form.niche.split(',').map(s => s.trim()).filter(Boolean)
      if (!form.displayName || niche.length === 0) {
        toast.error('Display name and at least one niche are required')
        return
      }

      const payload = {
        displayName: form.displayName,
        bio: form.bio || undefined,
        niche,
        location: form.location || undefined,
        instagramHandle: form.instagramHandle || undefined,
        youtubeHandle: form.youtubeHandle || undefined,
        twitterHandle: form.twitterHandle || undefined,
        linkedinHandle: form.linkedinHandle || undefined,
        baseRate: form.baseRate ? Math.round(parseFloat(form.baseRate) * 100) : undefined,
        currency: form.currency,
      }

      const method = registered ? 'PATCH' : 'POST'
      const res = await fetch('/api/influencer/profile', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to save')
      }

      const data = await res.json()
      setProfile(data.profile)
      setRegistered(true)
      toast.success(registered ? 'Profile updated' : 'Registered as influencer!')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
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
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold font-headline flex items-center gap-2">
          <User className="h-6 w-6" />
          {registered ? 'Influencer Profile' : 'Become an Influencer'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {registered
            ? 'Manage your influencer profile, social handles, and rates.'
            : 'Register as an influencer to receive campaign invitations from brands.'}
        </p>
      </div>

      {profile && (
        <div className="flex items-center gap-2">
          <Badge variant={profile.verificationStatus === 'verified' ? 'default' : 'secondary'}>
            {profile.verificationStatus === 'verified' ? <CheckCircle className="h-3 w-3 mr-1" /> : null}
            {profile.verificationStatus}
          </Badge>
          {!profile.isActive && <Badge variant="destructive">Inactive</Badge>}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile Details</CardTitle>
          <CardDescription>This information will be visible to brands.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name *</Label>
              <Input id="displayName" value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} placeholder="Your public name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Mumbai, India" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="Tell brands about yourself..." rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="niche">Niches * (comma-separated)</Label>
            <Input id="niche" value={form.niche} onChange={e => setForm(f => ({ ...f, niche: e.target.value }))} placeholder="beauty, tech, food, fitness" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="baseRate">Base Rate ({form.currency})</Label>
              <Input id="baseRate" type="number" value={form.baseRate} onChange={e => setForm(f => ({ ...f, baseRate: e.target.value }))} placeholder="5000" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Social Handles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Instagram className="h-3.5 w-3.5" /> Instagram</Label>
              <Input value={form.instagramHandle} onChange={e => setForm(f => ({ ...f, instagramHandle: e.target.value }))} placeholder="@handle" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Youtube className="h-3.5 w-3.5" /> YouTube</Label>
              <Input value={form.youtubeHandle} onChange={e => setForm(f => ({ ...f, youtubeHandle: e.target.value }))} placeholder="@channel" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Twitter className="h-3.5 w-3.5" /> Twitter / X</Label>
              <Input value={form.twitterHandle} onChange={e => setForm(f => ({ ...f, twitterHandle: e.target.value }))} placeholder="@handle" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Linkedin className="h-3.5 w-3.5" /> LinkedIn</Label>
              <Input value={form.linkedinHandle} onChange={e => setForm(f => ({ ...f, linkedinHandle: e.target.value }))} placeholder="linkedin.com/in/handle" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSubmit} disabled={saving} className="w-full sm:w-auto">
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        {registered ? 'Save Changes' : 'Register as Influencer'}
      </Button>
    </div>
  )
}
