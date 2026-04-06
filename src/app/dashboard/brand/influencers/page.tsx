'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Search, Users, Star, MapPin } from 'lucide-react'
import { toast } from 'sonner'

export default function BrandInfluencerDiscoveryPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [influencers, setInfluencers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchNiche, setSearchNiche] = useState('')
  const [searchLocation, setSearchLocation] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin')
    if (status === 'authenticated' && (session?.user as any)?.role !== 'brand') router.push('/dashboard')
  }, [status, session, router])

  const doSearch = async (niche?: string, location?: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (niche) params.set('niche', niche)
      if (location) params.set('location', location)
      params.set('limit', '20')

      const res = await fetch(`/api/influencer/discover?${params}`)
      const data = await res.json()
      setInfluencers(data.influencers ?? [])
    } catch {
      toast.error('Failed to search')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'authenticated') doSearch()
  }, [status])

  const handleSearch = () => {
    doSearch(searchNiche || undefined, searchLocation || undefined)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold font-headline flex items-center gap-2">
          <Users className="h-6 w-6" />
          Discover Influencers
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse influencer profiles and find the right creators for your campaigns.
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Filter by niche (e.g., beauty)"
          value={searchNiche}
          onChange={e => setSearchNiche(e.target.value)}
          className="max-w-xs"
        />
        <Input
          placeholder="Location"
          value={searchLocation}
          onChange={e => setSearchLocation(e.target.value)}
          className="max-w-xs"
        />
        <Button onClick={handleSearch} disabled={loading}>
          <Search className="h-3.5 w-3.5 mr-1" /> Search
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : influencers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center gap-2">
            <Users className="h-7 w-7 text-muted-foreground" />
            <p className="text-sm font-medium">No influencers found</p>
            <p className="text-xs text-muted-foreground">Try different search criteria.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {influencers.map((item: any) => {
            const { profile, socialStats, followerCount, averageRating } = item
            const totalFollowers = socialStats?.reduce((s: number, st: any) => s + (st.followerCount ?? 0), 0) ?? 0
            return (
              <Card key={profile.id} className="hover:border-primary/20 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">{profile.displayName}</CardTitle>
                    {profile.verificationStatus === 'verified' && (
                      <Badge variant="default" className="text-[10px]">Verified</Badge>
                    )}
                  </div>
                  {profile.location && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {profile.location}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-2">
                  {profile.bio && <p className="text-xs text-muted-foreground line-clamp-2">{profile.bio}</p>}
                  <div className="flex flex-wrap gap-1">
                    {profile.niche?.map((n: string) => (
                      <Badge key={n} variant="secondary" className="text-[10px]">{n}</Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                    <span>{totalFollowers.toLocaleString()} followers</span>
                    <span>{followerCount} platform followers</span>
                    {averageRating && (
                      <span className="flex items-center gap-0.5">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        {averageRating.toFixed(1)}
                      </span>
                    )}
                  </div>
                  {profile.baseRate && (
                    <p className="text-xs text-muted-foreground">
                      Base rate: {(profile.baseRate / 100).toLocaleString()} {profile.currency}
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
