'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Megaphone, Calendar, IndianRupee } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  invited: 'bg-yellow-100 text-yellow-800',
  accepted: 'bg-blue-100 text-blue-800',
  active: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-800',
  rejected: 'bg-red-100 text-red-800',
}

export default function InfluencerCampaignsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/influencer/campaigns')
      .then(r => r.json())
      .then(data => setCampaigns(data.campaigns ?? []))
      .finally(() => setLoading(false))
  }, [status])

  const filtered = activeTab === 'all'
    ? campaigns
    : campaigns.filter(c => c.invitationStatus === activeTab)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold font-headline flex items-center gap-2">
          <Megaphone className="h-6 w-6" />
          My Campaigns
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          View campaign invitations and track your active collaborations.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto w-full justify-start gap-1 sm:flex-nowrap sm:w-auto sm:h-10">
          <TabsTrigger value="all">All ({campaigns.length})</TabsTrigger>
          <TabsTrigger value="invited">Invited</TabsTrigger>
          <TabsTrigger value="accepted">Accepted</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {filtered.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-10 text-center gap-2">
                <Megaphone className="h-7 w-7 text-muted-foreground" />
                <p className="text-sm font-medium">No campaigns found</p>
                <p className="text-xs text-muted-foreground">
                  {activeTab === 'all' ? 'You haven\'t been invited to any campaigns yet.' : `No ${activeTab} campaigns.`}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((campaign: any) => (
                <Link key={campaign.id} href={`/dashboard/influencer/campaigns/${campaign.id}`}>
                  <Card className="hover:border-primary/30 transition-colors cursor-pointer">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold">{campaign.title}</CardTitle>
                        <Badge className={STATUS_COLORS[campaign.invitationStatus] ?? ''}>
                          {campaign.invitationStatus}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <IndianRupee className="h-3 w-3" />
                          {(campaign.budgetTotal / 100).toLocaleString()} {campaign.budgetCurrency}
                        </span>
                        {campaign.agreedRate && (
                          <span className="flex items-center gap-1">
                            Your rate: {(campaign.agreedRate / 100).toLocaleString()} {campaign.budgetCurrency}
                          </span>
                        )}
                        {campaign.startDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {campaign.startDate} — {campaign.endDate ?? '...'}
                          </span>
                        )}
                      </div>
                      {campaign.brief && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{campaign.brief}</p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
