import { auth } from '@/lib/auth/auth.config';
import { db } from '@/db';
import { 
  surveyResponses, 
  userProfiles, 
  userEvents, 
  products, 
  feedback,
  rankingHistory,
  weeklyRankings
} from '@/db/schema';
import { eq, and, gte, sql, desc, count } from 'drizzle-orm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  TrendingUp, 
  Target, 
  Activity,
  Globe,
  GraduationCap,
  DollarSign,
  ShoppingBag,
  Heart,
  BarChart3
} from 'lucide-react';
import { BrandAnalyticsDashboard } from '@/components/brand-analytics-dashboard';

export default async function BrandAnalyticsPage() {
  const session = await auth();
  
  if (!session?.user) {
    return <div>Please sign in to view analytics</div>;
  }

  // Fetch all brand products
  const brandProducts = await db.select().from(products);
  const productIds = brandProducts.map(p => p.id);

  if (productIds.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-headline font-bold mb-2">
            Brand Analytics Dashboard
          </h1>
          <p className="text-muted-foreground">
            No products found. Add products to see analytics.
          </p>
        </div>
      </div>
    );
  }

  // Fetch survey responses with user demographic data
  const responses = await db
    .select({
      id: surveyResponses.id,
      surveyId: surveyResponses.surveyId,
      productId: surveyResponses.productId,
      submittedAt: surveyResponses.submittedAt,
      npsScore: surveyResponses.npsScore,
      sentiment: surveyResponses.sentiment,
      userEmail: surveyResponses.userEmail,
      answers: surveyResponses.answers,
    })
    .from(surveyResponses)
    .orderBy(desc(surveyResponses.submittedAt));

  // Fetch user profiles for demographic analysis
  const profiles = await db
    .select({
      id: userProfiles.id,
      email: userProfiles.email,
      demographics: userProfiles.demographics,
      interests: userProfiles.interests,
      behavioral: userProfiles.behavioral,
      sensitiveData: userProfiles.sensitiveData,
      onboardingComplete: userProfiles.onboardingComplete,
      createdAt: userProfiles.createdAt,
    })
    .from(userProfiles);

  // Fetch user events for engagement analysis
  const events = await db
    .select({
      id: userEvents.id,
      userId: userEvents.userId,
      eventType: userEvents.eventType,
      productId: userEvents.productId,
      surveyId: userEvents.surveyId,
      metadata: userEvents.metadata,
      createdAt: userEvents.createdAt,
    })
    .from(userEvents)
    .orderBy(desc(userEvents.createdAt))
    .limit(1000);

  // Fetch feedback
  const allFeedback = await db
    .select()
    .from(feedback)
    .orderBy(desc(feedback.createdAt));

  // Fetch ranking history
  const rankings = await db
    .select()
    .from(rankingHistory)
    .where(sql`${rankingHistory.productId} = ANY(${productIds})`)
    .orderBy(desc(rankingHistory.weekStart));

  // Calculate aggregate metrics
  const totalUsers = profiles.length;
  const totalResponses = responses.length;
  const totalEvents = events.length;
  const totalFeedback = allFeedback.length;

  // Demographics breakdown
  const demographicsData = profiles.reduce((acc: any, profile) => {
    const demographics = profile.demographics as any;
    if (!demographics) return acc;

    // Gender
    if (demographics.gender) {
      acc.gender[demographics.gender] = (acc.gender[demographics.gender] || 0) + 1;
    }

    // Age range
    if (demographics.ageRange) {
      acc.ageRange[demographics.ageRange] = (acc.ageRange[demographics.ageRange] || 0) + 1;
    }

    // Location
    if (demographics.location) {
      acc.location[demographics.location] = (acc.location[demographics.location] || 0) + 1;
    }

    // Education
    if (demographics.education) {
      acc.education[demographics.education] = (acc.education[demographics.education] || 0) + 1;
    }

    // Culture
    if (demographics.culture) {
      acc.culture[demographics.culture] = (acc.culture[demographics.culture] || 0) + 1;
    }

    return acc;
  }, {
    gender: {},
    ageRange: {},
    location: {},
    education: {},
    culture: {}
  });

  // Interests breakdown
  const interestsData = profiles.reduce((acc: any, profile) => {
    const interests = profile.interests as any;
    if (!interests?.productCategories) return acc;

    interests.productCategories.forEach((category: string) => {
      acc[category] = (acc[category] || 0) + 1;
    });

    return acc;
  }, {});

  // Sensitive data breakdown (aggregated with privacy protection)
  const incomeData = profiles.reduce((acc: any, profile) => {
    const sensitiveData = profile.sensitiveData as any;
    if (!sensitiveData?.incomeRange) return acc;

    acc[sensitiveData.incomeRange] = (acc[sensitiveData.incomeRange] || 0) + 1;
    return acc;
  }, {});

  const purchaseData = profiles.reduce((acc: any, profile) => {
    const sensitiveData = profile.sensitiveData as any;
    if (!sensitiveData?.purchaseHistory?.frequency) return acc;

    acc[sensitiveData.purchaseHistory.frequency] = (acc[sensitiveData.purchaseHistory.frequency] || 0) + 1;
    return acc;
  }, {});

  // Aspirations breakdown
  const aspirationsData = profiles.reduce((acc: any, profile) => {
    const demographics = profile.demographics as any;
    if (!demographics?.aspirations) return acc;

    demographics.aspirations.forEach((aspiration: string) => {
      acc[aspiration] = (acc[aspiration] || 0) + 1;
    });

    return acc;
  }, {});

  // Engagement metrics
  const engagementData = {
    totalPageViews: events.filter(e => e.eventType === 'product_view').length,
    totalSurveyStarts: events.filter(e => e.eventType === 'survey_start').length,
    totalSurveyCompletes: events.filter(e => e.eventType === 'survey_complete').length,
    totalNotificationClicks: events.filter(e => e.eventType === 'notification_click').length,
    conversionRate: events.filter(e => e.eventType === 'survey_start').length > 0
      ? ((events.filter(e => e.eventType === 'survey_complete').length / 
          events.filter(e => e.eventType === 'survey_start').length) * 100).toFixed(1)
      : '0',
  };

  // NPS by demographic segment
  const npsByDemographic = responses.reduce((acc: any, response) => {
    if (!response.npsScore || !response.userEmail) return acc;

    const userProfile = profiles.find(p => p.email === response.userEmail);
    if (!userProfile) return acc;

    const demographics = userProfile.demographics as any;
    if (!demographics) return acc;

    // By age range
    if (demographics.ageRange) {
      if (!acc.ageRange[demographics.ageRange]) {
        acc.ageRange[demographics.ageRange] = { total: 0, count: 0 };
      }
      acc.ageRange[demographics.ageRange].total += response.npsScore;
      acc.ageRange[demographics.ageRange].count += 1;
    }

    // By gender
    if (demographics.gender) {
      if (!acc.gender[demographics.gender]) {
        acc.gender[demographics.gender] = { total: 0, count: 0 };
      }
      acc.gender[demographics.gender].total += response.npsScore;
      acc.gender[demographics.gender].count += 1;
    }

    // By location
    if (demographics.location) {
      if (!acc.location[demographics.location]) {
        acc.location[demographics.location] = { total: 0, count: 0 };
      }
      acc.location[demographics.location].total += response.npsScore;
      acc.location[demographics.location].count += 1;
    }

    return acc;
  }, {
    ageRange: {},
    gender: {},
    location: {}
  });

  // Calculate averages
  Object.keys(npsByDemographic).forEach(category => {
    Object.keys(npsByDemographic[category]).forEach(segment => {
      const data = npsByDemographic[category][segment];
      npsByDemographic[category][segment].average = (data.total / data.count).toFixed(1);
    });
  });

  // Product performance breakdown
  const productPerformance = brandProducts.map(product => {
    const productResponses = responses.filter(r => r.productId === product.id);
    const productFeedback = allFeedback.filter(f => f.productId === product.id);
    const productEvents = events.filter(e => e.productId === product.id);
    const productRankings = rankings.filter(r => r.productId === product.id);

    const avgNPS = productResponses.length > 0
      ? productResponses.reduce((sum, r) => sum + (r.npsScore || 0), 0) / productResponses.length
      : 0;

    const latestRank = productRankings.length > 0 ? productRankings[0].rank : null;

    return {
      id: product.id,
      name: product.name,
      category: (product.profile as any)?.categoryName || 'Uncategorized',
      totalResponses: productResponses.length,
      totalFeedback: productFeedback.length,
      totalViews: productEvents.filter(e => e.eventType === 'product_view').length,
      avgNPS: avgNPS.toFixed(1),
      currentRank: latestRank,
      sentiment: {
        positive: productResponses.filter(r => r.sentiment === 'positive').length,
        neutral: productResponses.filter(r => r.sentiment === 'neutral').length,
        negative: productResponses.filter(r => r.sentiment === 'negative').length,
      }
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-headline font-bold mb-2">
          Brand Analytics Dashboard
        </h1>
        <p className="text-muted-foreground">
          Comprehensive insights across all products and user segments
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {profiles.filter(p => p.onboardingComplete).length} completed onboarding
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Survey Responses</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalResponses.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {engagementData.conversionRate}% conversion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Engagement</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEvents.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {engagementData.totalPageViews} product views
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Feedback Items</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalFeedback.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Across {brandProducts.length} products
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Analytics Views */}
      <Tabs defaultValue="demographics" className="space-y-4">
        <TabsList>
          <TabsTrigger value="demographics">Demographics</TabsTrigger>
          <TabsTrigger value="interests">Interests & Behavior</TabsTrigger>
          <TabsTrigger value="nps">NPS Segmentation</TabsTrigger>
          <TabsTrigger value="products">Product Performance</TabsTrigger>
          <TabsTrigger value="funnel">Conversion Funnel</TabsTrigger>
        </TabsList>

        <TabsContent value="demographics" className="space-y-4">
          <BrandAnalyticsDashboard
            demographicsData={demographicsData}
            totalUsers={totalUsers}
          />
        </TabsContent>

        <TabsContent value="interests" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Product Category Interests</CardTitle>
                <CardDescription>What categories your audience is interested in</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(interestsData)
                    .sort(([, a]: any, [, b]: any) => b - a)
                    .slice(0, 10)
                    .map(([category, count]: any) => (
                      <div key={category} className="flex items-center justify-between">
                        <span className="text-sm">{category}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-purple-600 h-2 rounded-full"
                              style={{ width: `${(count / totalUsers) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium w-12 text-right">
                            {count} ({((count / totalUsers) * 100).toFixed(0)}%)
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>User Aspirations</CardTitle>
                <CardDescription>Life goals driving your audience</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(aspirationsData)
                    .sort(([, a]: any, [, b]: any) => b - a)
                    .slice(0, 10)
                    .map(([aspiration, count]: any) => {
                      const labels: any = {
                        'career-growth': '🚀 Career Growth',
                        'financial-freedom': '💰 Financial Independence',
                        'health-fitness': '💪 Health & Fitness',
                        'learning-skills': '📚 Learning New Skills',
                        'entrepreneurship': '💡 Entrepreneurship',
                        'work-life-balance': '⚖️ Work-Life Balance',
                        'family-home': '🏡 Family & Home',
                        'travel-experiences': '✈️ Travel & Experiences'
                      };
                      return (
                        <div key={aspiration} className="flex items-center justify-between">
                          <span className="text-sm">{labels[aspiration] || aspiration}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-32 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${(count / totalUsers) * 100}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium w-12 text-right">
                              {count} ({((count / totalUsers) * 100).toFixed(0)}%)
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Income Distribution</CardTitle>
                <CardDescription>Self-reported income ranges (aggregated)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(incomeData)
                    .sort(([, a]: any, [, b]: any) => b - a)
                    .map(([range, count]: any) => (
                      <div key={range} className="flex items-center justify-between">
                        <span className="text-sm">{range}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-600 h-2 rounded-full"
                              style={{ width: `${(count / totalUsers) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium w-12 text-right">
                            {count}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
                {Object.keys(incomeData).length === 0 && (
                  <p className="text-sm text-muted-foreground">No income data available</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Shopping Frequency</CardTitle>
                <CardDescription>How often users shop online</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(purchaseData)
                    .sort(([, a]: any, [, b]: any) => b - a)
                    .map(([frequency, count]: any) => (
                      <div key={frequency} className="flex items-center justify-between">
                        <span className="text-sm capitalize">{frequency}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-orange-600 h-2 rounded-full"
                              style={{ width: `${(count / totalUsers) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium w-12 text-right">
                            {count}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
                {Object.keys(purchaseData).length === 0 && (
                  <p className="text-sm text-muted-foreground">No purchase frequency data available</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="nps" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>NPS by Age Range</CardTitle>
                <CardDescription>Average NPS score per age group</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(npsByDemographic.ageRange).map(([range, data]: any) => (
                    <div key={range} className="flex items-center justify-between border-b pb-2">
                      <span className="text-sm font-medium">{range}</span>
                      <div className="text-right">
                        <div className="text-lg font-bold">{data.average}</div>
                        <div className="text-xs text-muted-foreground">{data.count} responses</div>
                      </div>
                    </div>
                  ))}
                  {Object.keys(npsByDemographic.ageRange).length === 0 && (
                    <p className="text-sm text-muted-foreground">No NPS data by age available</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>NPS by Gender</CardTitle>
                <CardDescription>Average NPS score per gender</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(npsByDemographic.gender).map(([gender, data]: any) => (
                    <div key={gender} className="flex items-center justify-between border-b pb-2">
                      <span className="text-sm font-medium capitalize">{gender}</span>
                      <div className="text-right">
                        <div className="text-lg font-bold">{data.average}</div>
                        <div className="text-xs text-muted-foreground">{data.count} responses</div>
                      </div>
                    </div>
                  ))}
                  {Object.keys(npsByDemographic.gender).length === 0 && (
                    <p className="text-sm text-muted-foreground">No NPS data by gender available</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>NPS by Location</CardTitle>
                <CardDescription>Average NPS score per region</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(npsByDemographic.location)
                    .sort(([, a]: any, [, b]: any) => parseFloat(b.average) - parseFloat(a.average))
                    .slice(0, 5)
                    .map(([location, data]: any) => (
                      <div key={location} className="flex items-center justify-between border-b pb-2">
                        <span className="text-sm font-medium">{location}</span>
                        <div className="text-right">
                          <div className="text-lg font-bold">{data.average}</div>
                          <div className="text-xs text-muted-foreground">{data.count} responses</div>
                        </div>
                      </div>
                    ))}
                  {Object.keys(npsByDemographic.location).length === 0 && (
                    <p className="text-sm text-muted-foreground">No NPS data by location available</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Product Performance Comparison</CardTitle>
              <CardDescription>How each product is performing across metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">Product</th>
                      <th className="text-left py-2 px-2">Category</th>
                      <th className="text-right py-2 px-2">Views</th>
                      <th className="text-right py-2 px-2">Responses</th>
                      <th className="text-right py-2 px-2">Feedback</th>
                      <th className="text-right py-2 px-2">Avg NPS</th>
                      <th className="text-right py-2 px-2">Rank</th>
                      <th className="text-left py-2 px-2">Sentiment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productPerformance.map(product => (
                      <tr key={product.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-2 font-medium">{product.name}</td>
                        <td className="py-2 px-2 text-muted-foreground">{product.category}</td>
                        <td className="py-2 px-2 text-right">{product.totalViews}</td>
                        <td className="py-2 px-2 text-right">{product.totalResponses}</td>
                        <td className="py-2 px-2 text-right">{product.totalFeedback}</td>
                        <td className="py-2 px-2 text-right font-medium">{product.avgNPS}</td>
                        <td className="py-2 px-2 text-right">
                          {product.currentRank ? `#${product.currentRank}` : '-'}
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex gap-1 text-xs">
                            <span className="text-green-600">+{product.sentiment.positive}</span>
                            <span className="text-gray-600">={product.sentiment.neutral}</span>
                            <span className="text-red-600">-{product.sentiment.negative}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="funnel" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Engagement Funnel</CardTitle>
              <CardDescription>How users progress through your platform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">Total Users</span>
                      <span className="text-sm font-bold">{totalUsers}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-8">
                      <div className="bg-purple-600 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium" style={{ width: '100%' }}>
                        100%
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">Completed Onboarding</span>
                      <span className="text-sm font-bold">
                        {profiles.filter(p => p.onboardingComplete).length}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-8">
                      <div 
                        className="bg-purple-600 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium" 
                        style={{ width: `${(profiles.filter(p => p.onboardingComplete).length / totalUsers) * 100}%` }}
                      >
                        {((profiles.filter(p => p.onboardingComplete).length / totalUsers) * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">Viewed Products</span>
                      <span className="text-sm font-bold">{engagementData.totalPageViews}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-8">
                      <div 
                        className="bg-blue-600 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium" 
                        style={{ width: `${(engagementData.totalPageViews / totalUsers) * 10}%` }}
                      >
                        {((engagementData.totalPageViews / totalUsers) * 100).toFixed(0)}% rate
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">Started Survey</span>
                      <span className="text-sm font-bold">{engagementData.totalSurveyStarts}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-8">
                      <div 
                        className="bg-green-600 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium" 
                        style={{ width: `${(engagementData.totalSurveyStarts / totalUsers) * 50}%` }}
                      >
                        {((engagementData.totalSurveyStarts / totalUsers) * 100).toFixed(0)}% rate
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">Completed Survey</span>
                      <span className="text-sm font-bold">{engagementData.totalSurveyCompletes}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-8">
                      <div 
                        className="bg-green-700 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium" 
                        style={{ width: `${(engagementData.totalSurveyCompletes / totalUsers) * 50}%` }}
                      >
                        {((engagementData.totalSurveyCompletes / totalUsers) * 100).toFixed(0)}% rate
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold mb-2">Key Insights</h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• Survey completion rate: {engagementData.conversionRate}%</li>
                    <li>• Average events per user: {(totalEvents / totalUsers).toFixed(1)}</li>
                    <li>• Onboarding completion rate: {((profiles.filter(p => p.onboardingComplete).length / totalUsers) * 100).toFixed(0)}%</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
