import { Suspense } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { db } from '@/db'
import { emailSendEvents, surveys, products } from '@/db/schema'
import { sql, desc, eq } from 'drizzle-orm'
import { BarChart3, Mail, MousePointerClick, TrendingUp, Users } from 'lucide-react'

export default async function CampaignAnalyticsPage() {
  // Overall stats
  const [stats] = await db.select({
    totalSent: sql<number>`count(*)`,
    totalClicked: sql<number>`count(*) filter (where ${emailSendEvents.clicked} = true)`,
    avgClickRate: sql<number>`avg(case when ${emailSendEvents.clicked} then 1.0 else 0.0 end)`,
  }).from(emailSendEvents)

  const clickRate = stats.avgClickRate ? (stats.avgClickRate * 100).toFixed(1) : '0.0'

  // Performance by email type
  const byEmailType = await db.select({
    emailType: emailSendEvents.emailType,
    totalSent: sql<number>`count(*)`,
    totalClicked: sql<number>`count(*) filter (where ${emailSendEvents.clicked} = true)`,
    clickRate: sql<number>`avg(case when ${emailSendEvents.clicked} then 1.0 else 0.0 end) * 100`,
  })
    .from(emailSendEvents)
    .groupBy(emailSendEvents.emailType)
    .orderBy(desc(sql`count(*)`))

  // Performance by demographics
  const byAgeBracket = await db.select({
    ageBracket: emailSendEvents.userAgeBracket,
    totalSent: sql<number>`count(*)`,
    clickRate: sql<number>`avg(case when ${emailSendEvents.clicked} then 1.0 else 0.0 end) * 100`,
  })
    .from(emailSendEvents)
    .where(sql`${emailSendEvents.userAgeBracket} is not null`)
    .groupBy(emailSendEvents.userAgeBracket)
    .orderBy(desc(sql`count(*)`))

  const byIndustry = await db.select({
    industry: emailSendEvents.userIndustry,
    totalSent: sql<number>`count(*)`,
    clickRate: sql<number>`avg(case when ${emailSendEvents.clicked} then 1.0 else 0.0 end) * 100`,
  })
    .from(emailSendEvents)
    .where(sql`${emailSendEvents.userIndustry} is not null`)
    .groupBy(emailSendEvents.userIndustry)
    .orderBy(desc(sql`avg(case when ${emailSendEvents.clicked} then 1.0 else 0.0 end)`))
    .limit(10)

  // Recent campaigns (last 30 days)
  const recentCampaigns = await db.select({
    date: sql<string>`date(${emailSendEvents.sentAt})`,
    totalSent: sql<number>`count(*)`,
    totalClicked: sql<number>`count(*) filter (where ${emailSendEvents.clicked} = true)`,
    clickRate: sql<number>`avg(case when ${emailSendEvents.clicked} then 1.0 else 0.0 end) * 100`,
  })
    .from(emailSendEvents)
    .where(sql`${emailSendEvents.sentAt} >= now() - interval '30 days'`)
    .groupBy(sql`date(${emailSendEvents.sentAt})`)
    .orderBy(desc(sql`date(${emailSendEvents.sentAt})`))
    .limit(30)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Campaign Analytics</h1>
        <p className="text-muted-foreground mt-2">
          Track email campaign performance and engagement metrics
        </p>
      </div>

      {/* Overall Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Emails Sent</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSent?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalClicked?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">Engaged users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Click Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clickRate}%</div>
            <p className="text-xs text-muted-foreground">Overall engagement</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Campaign Types</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{byEmailType.length}</div>
            <p className="text-xs text-muted-foreground">Active types</p>
          </CardContent>
        </Card>
      </div>

      {/* Performance by Email Type */}
      <Card>
        <CardHeader>
          <CardTitle>Performance by Campaign Type</CardTitle>
          <CardDescription>Email engagement metrics grouped by campaign type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {byEmailType.map((type, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{type.emailType}</span>
                    <span className="text-sm text-muted-foreground">
                      ({type.totalSent.toLocaleString()} sent)
                    </span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2 mt-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full"
                      style={{ width: `${Math.min(type.clickRate, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="ml-4 text-right">
                  <div className="font-bold text-lg">{type.clickRate.toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground">
                    {type.totalClicked} clicks
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Performance by Age */}
        <Card>
          <CardHeader>
            <CardTitle>Performance by Age Bracket</CardTitle>
            <CardDescription>Click rates segmented by user age</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {byAgeBracket.length === 0 ? (
                <p className="text-sm text-muted-foreground">No demographic data available yet</p>
              ) : (
                byAgeBracket.map((bracket, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex-1">
                      <span className="text-sm font-medium">{bracket.ageBracket}</span>
                      <div className="w-full bg-secondary rounded-full h-1.5 mt-1">
                        <div
                          className="bg-blue-600 h-1.5 rounded-full"
                          style={{ width: `${Math.min(bracket.clickRate, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="ml-4 text-right">
                      <div className="font-medium text-sm">{bracket.clickRate.toFixed(1)}%</div>
                      <div className="text-xs text-muted-foreground">{bracket.totalSent} sent</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Performance by Industry */}
        <Card>
          <CardHeader>
            <CardTitle>Performance by Industry</CardTitle>
            <CardDescription>Top 10 industries by click rate</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {byIndustry.length === 0 ? (
                <p className="text-sm text-muted-foreground">No industry data available yet</p>
              ) : (
                byIndustry.map((industry, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex-1">
                      <span className="text-sm font-medium">{industry.industry}</span>
                      <div className="w-full bg-secondary rounded-full h-1.5 mt-1">
                        <div
                          className="bg-green-600 h-1.5 rounded-full"
                          style={{ width: `${Math.min(industry.clickRate, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="ml-4 text-right">
                      <div className="font-medium text-sm">{industry.clickRate.toFixed(1)}%</div>
                      <div className="text-xs text-muted-foreground">{industry.totalSent} sent</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Campaign Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Campaign Activity (Last 30 Days)</CardTitle>
          <CardDescription>Daily email sends and engagement</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentCampaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent campaigns</p>
            ) : (
              <div className="space-y-2">
                {recentCampaigns.map((campaign, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <div className="font-medium">{new Date(campaign.date).toLocaleDateString()}</div>
                      <div className="text-sm text-muted-foreground">
                        {campaign.totalSent.toLocaleString()} sent • {campaign.totalClicked} clicks
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">{campaign.clickRate.toFixed(1)}%</div>
                      <div className="text-xs text-muted-foreground">click rate</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
