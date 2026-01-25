# PERSONALIZED NOTIFICATION + ANALYTICS SYSTEM
## Design Document for Earn4Insights

> **Philosophy**: Start simple, scale progressively, prioritize privacy, build for trust.

---

## 1️⃣ DATA MODEL (FOUNDATION)

### User Profile Schema

```typescript
// Core User Profile (Postgres)
type UserProfile = {
  // Identity
  id: string
  email: string
  phone?: string
  createdAt: string
  
  // Explicit Attributes (User-Provided)
  demographics: {
    gender?: 'male' | 'female' | 'non-binary' | 'prefer-not-to-say'
    ageRange?: '18-24' | '25-34' | '35-44' | '45-54' | '55-64' | '65+'
    location?: {
      country: string
      state?: string
      city?: string
    }
    language: string[]  // ['en', 'hi', etc.]
    education?: 'high-school' | 'bachelors' | 'masters' | 'phd' | 'other'
  }
  
  // Interests (User-Selected Tags)
  interests: {
    categories: string[]  // ['TECH_SAAS', 'EDUCATION', 'FINANCE', etc.]
    brands: string[]      // Brand IDs they follow
    updatedAt: string
  }
  
  // Implicit Attributes (Derived from Behavior)
  behavioral: {
    engagementScore: number        // 0-100
    activityLevel: 'low' | 'medium' | 'high'
    lastActiveAt: string
    totalSurveys: number
    totalProductViews: number
    preferredCategories: {         // Weighted by interaction
      category: string
      score: number
    }[]
  }
  
  // Consent & Preferences (CRITICAL)
  consent: {
    personalizedNotifications: boolean
    behavioralTracking: boolean
    analyticsSharing: boolean      // Can brands see aggregated data?
    marketingEmails: boolean
    researchParticipation: boolean
    consentDate: string
    gdprCompliant: boolean
  }
  
  // Notification Preferences
  notificationPreferences: {
    email: {
      enabled: boolean
      frequency: 'instant' | 'daily' | 'weekly'
      quietHours: { start: string, end: string }  // "22:00" - "08:00"
    }
    whatsapp: {
      enabled: boolean
      optInDate?: string           // Explicit WhatsApp consent
    }
    sms: {
      enabled: boolean
      optInDate?: string
    }
  }
  
  // Sensitive Attributes (OPTIONAL, ENCRYPTED)
  sensitiveData?: {
    encrypted: boolean
    // Only stored if user explicitly provides + consents
    // Examples: religion, caste, health conditions
    // NEVER inferred or required
    attributes: Record<string, string>
  }
}
```

### User Activity Events Schema

```typescript
// Event Tracking (For Behavioral Personalization)
type UserEvent = {
  id: string
  userId: string
  eventType: 'product_view' | 'survey_response' | 'notification_click' | 
             'survey_start' | 'survey_complete' | 'product_bookmark'
  
  metadata: {
    productId?: string
    surveyId?: string
    categoryId?: string
    duration?: number              // Time spent
    source: 'email' | 'app' | 'notification'
  }
  
  timestamp: string
  sessionId: string
}
```

### Notification Queue Schema

```typescript
type NotificationQueue = {
  id: string
  userId: string
  channel: 'email' | 'whatsapp' | 'sms'
  
  content: {
    template: string               // Template ID
    personalization: {
      userName: string
      productName?: string
      // Dynamic tokens
    }
    subject?: string               // Email subject
    body: string
  }
  
  targeting: {
    campaignId?: string
    segmentId?: string
    priority: 'low' | 'normal' | 'high' | 'urgent'
  }
  
  status: 'queued' | 'sent' | 'failed' | 'bounced' | 'clicked' | 'unsubscribed'
  scheduledFor: string
  sentAt?: string
  failureReason?: string
  
  metadata: {
    brandId?: string
    surveyId?: string
    retryCount: number
  }
}
```

### What We NEVER Infer or Store

**NEVER INFERRED:**
- Income level (we may ask spending capacity ranges optionally)
- Race, ethnicity, caste, religion (unless explicitly provided + consented)
- Health conditions (unless for specific health product surveys with consent)
- Political affiliation
- Sexual orientation (unless user volunteers for LGBTQ+ product research)

**DATA MINIMIZATION:**
- Only collect what's needed
- Delete inactive user data after 24 months (with warning)
- Anonymize old analytics data
- No cross-platform tracking without consent

---

## 2️⃣ PERSONALIZATION PHASES (PROGRESSIVE ENHANCEMENT)

### PHASE 1: Rule-Based Targeting (MVP) ✅ START HERE

**Goal**: Simple, transparent, deterministic targeting

**Implementation**:
```typescript
// Simple filter-based targeting
function getTargetUsers(criteria: {
  ageRange?: string[]
  location?: { country: string[] }
  categories?: string[]
  minEngagementScore?: number
}) {
  return db.select()
    .from(userProfiles)
    .where(and(
      criteria.ageRange ? 
        sql`demographics->>'ageRange' = ANY(${criteria.ageRange})` : undefined,
      criteria.location?.country ? 
        sql`demographics->'location'->>'country' = ANY(${criteria.location.country})` : undefined,
      criteria.categories ? 
        sql`interests->'categories' ?| ${criteria.categories}` : undefined,
      criteria.minEngagementScore ? 
        gte(behavioral.engagementScore, criteria.minEngagementScore) : undefined,
      eq(consent.personalizedNotifications, true)  // ALWAYS check consent
    ))
}
```

**Notification Triggers** (Rule-Based):
1. **New survey in user's interest category** → Email
2. **Product launch in followed category** → Push/Email
3. **Weekly summary** (if opted in) → Email
4. **Survey reminder** (if incomplete) → WhatsApp/SMS

**Why Phase 1 Matters**:
- Transparent to users ("You see this because you selected 'Tech' as an interest")
- Easy to debug
- GDPR-compliant (clear logic)
- No ML black box
- Works from day 1

---

### PHASE 2: Behavior-Based Personalization

**Goal**: Use actual behavior to refine targeting

**Tracked Behaviors**:
```typescript
// Engagement scoring
function calculateEngagementScore(userId: string) {
  const events = getRecentEvents(userId, days: 30)
  
  let score = 0
  
  // Weighted actions
  score += events.surveyComplete * 10      // Highest value
  score += events.surveyStart * 5
  score += events.productView * 2
  score += events.notificationClick * 3
  score += events.dailyActiveDay * 1
  
  // Decay for inactivity
  const daysSinceLastActive = getDaysSince(user.lastActiveAt)
  score *= Math.exp(-daysSinceLastActive / 30)  // Exponential decay
  
  return Math.min(100, score)
}
```

**Interest Vector** (Implicit):
```typescript
// Build user interest profile from behavior
function buildInterestVector(userId: string) {
  const events = getEvents(userId, type: 'product_view | survey_response')
  
  const categoryScores: Record<string, number> = {}
  
  events.forEach(event => {
    const category = event.metadata.categoryId
    const recency = getDaysAgo(event.timestamp)
    
    // Recent actions matter more
    const weight = 1 / (1 + recency / 7)  // Decay over weeks
    
    categoryScores[category] = (categoryScores[category] || 0) + weight
  })
  
  // Normalize to 0-1
  const maxScore = Math.max(...Object.values(categoryScores))
  Object.keys(categoryScores).forEach(cat => {
    categoryScores[cat] /= maxScore
  })
  
  return categoryScores
}
```

**Smart Notification Timing**:
```typescript
// Send notifications when user is likely to engage
function getOptimalSendTime(userId: string): string {
  const historicalClicks = getNotificationClicks(userId)
  
  // Find hour with highest click rate
  const hourlyEngagement = groupBy(historicalClicks, h => h.hour)
  const bestHour = maxBy(hourlyEngagement, group => group.clickRate)
  
  // Respect quiet hours
  const { start, end } = user.notificationPreferences.email.quietHours
  
  return bestHour within quietHours ? defaultTime : bestHour
}
```

---

### PHASE 3: Ranking & Recommendations

**Goal**: Show right content to right user

**Product Relevance Score**:
```typescript
function calculateRelevanceScore(
  product: Product,
  user: UserProfile
): number {
  let score = 0
  
  // 1. Category match (40% weight)
  const categoryMatch = user.behavioral.preferredCategories
    .find(c => c.category === product.category)?.score || 0
  score += categoryMatch * 0.4
  
  // 2. Recency (20% weight)
  const daysOld = getDaysSince(product.createdAt)
  const recencyScore = Math.exp(-daysOld / 30)  // Newer = better
  score += recencyScore * 0.2
  
  // 3. Popularity (20% weight)
  const popularityScore = normalizeScore(product.viewCount)
  score += popularityScore * 0.2
  
  // 4. User engagement level (10% weight)
  score += (user.behavioral.engagementScore / 100) * 0.1
  
  // 5. Explicit interest match (10% weight)
  const explicitMatch = user.interests.categories.includes(product.category)
  score += explicitMatch ? 0.1 : 0
  
  return score
}
```

**Cold Start Problem** (New Users):
```typescript
function getRecommendations(userId: string) {
  const user = getUser(userId)
  
  // NEW USER: Show trending + their explicit interests
  if (user.behavioral.totalProductViews < 5) {
    return getTrendingProducts(
      categories: user.interests.categories,
      limit: 10
    )
  }
  
  // ACTIVE USER: Personalized ranking
  const allProducts = getProducts()
  const scored = allProducts.map(p => ({
    product: p,
    score: calculateRelevanceScore(p, user)
  }))
  
  return scored.sort((a, b) => b.score - a.score).slice(0, 10)
}
```

**Diversity Injection** (Avoid Echo Chambers):
```typescript
// Ensure recommendations aren't too narrow
function diversifyRecommendations(products: Product[]) {
  const categories = new Set<string>()
  const diverse: Product[] = []
  
  products.forEach(product => {
    // Include top 5 from preferred categories
    if (diverse.length < 5) {
      diverse.push(product)
      categories.add(product.category)
    }
    // Then add diverse categories
    else if (!categories.has(product.category)) {
      diverse.push(product)
      categories.add(product.category)
    }
  })
  
  return diverse
}
```

---

### PHASE 4: Learning System (Future)

**Feedback Loop** (6-12 months out):
```typescript
// Track prediction accuracy
function trackPredictionAccuracy() {
  // Did user engage with recommended products?
  // Did they complete surveys we suggested?
  // Adjust weights based on actual outcomes
}
```

**A/B Testing**:
- Test notification copy variants
- Test recommendation algorithms
- Measure engagement lift

**Explainability**:
```typescript
// Show users WHY they see something
function getRecommendationReason(product: Product, user: UserProfile): string {
  const reasons: string[] = []
  
  if (user.interests.categories.includes(product.category)) {
    reasons.push(`Based on your interest in ${product.category}`)
  }
  
  if (user.behavioral.preferredCategories.some(c => c.category === product.category)) {
    reasons.push(`You've engaged with similar products before`)
  }
  
  if (product.isNew) {
    reasons.push(`New product in ${product.category}`)
  }
  
  return reasons.join(' • ')
}
```

**Why Phased Evolution Matters**:
1. **Trust**: Users see transparent logic first
2. **Data**: Need behavior data before ML works
3. **Debugging**: Simple rules easier to fix
4. **Compliance**: Easier to explain to regulators
5. **Cost**: Don't build ML infra before proving value

---

## 3️⃣ NOTIFICATION SYSTEM DESIGN

### Architecture

```
┌─────────────┐
│   Trigger   │ (New survey, product launch, reminder)
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  Target Users   │ (Apply filters, check consent)
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Personalize     │ (Inject tokens, templates)
│ Content         │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  Respect        │ (Quiet hours, frequency caps)
│  Preferences    │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  Queue          │ (Schedule by channel)
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  Send           │ (Email/WhatsApp/SMS providers)
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  Track          │ (Delivered, opened, clicked)
└─────────────────┘
```

### Implementation

```typescript
// Notification Service
class NotificationService {
  
  async sendCampaign(campaign: {
    type: 'survey_invite' | 'product_launch' | 'reminder'
    targeting: TargetingRules
    content: NotificationContent
    channels: ('email' | 'whatsapp' | 'sms')[]
  }) {
    
    // 1. Get target users
    const users = await this.getTargetUsers(campaign.targeting)
    
    // 2. Check consent for each channel
    const eligible = users.filter(user => 
      this.hasChannelConsent(user, campaign.channels)
    )
    
    // 3. Apply frequency caps
    const notOverloaded = await this.filterByFrequency(eligible)
    
    // 4. Personalize content for each user
    const notifications = notOverloaded.map(user => ({
      userId: user.id,
      channel: this.selectBestChannel(user, campaign.channels),
      content: this.personalize(campaign.content, user),
      scheduledFor: this.getOptimalTime(user)
    }))
    
    // 5. Queue for sending
    await this.queueNotifications(notifications)
    
    return {
      targeted: users.length,
      eligible: eligible.length,
      queued: notifications.length
    }
  }
  
  // Frequency capping
  async filterByFrequency(users: User[]): Promise<User[]> {
    const DAY = 24 * 60 * 60 * 1000
    
    return users.filter(async user => {
      const recentNotifs = await this.getRecentNotifications(user.id, {
        since: Date.now() - 7 * DAY
      })
      
      // Max 5 notifications per week
      if (recentNotifs.length >= 5) return false
      
      // Max 1 per day
      const today = await this.getTodayNotifications(user.id)
      if (today.length >= 1) return false
      
      return true
    })
  }
  
  // Personalization tokens
  personalize(content: NotificationContent, user: UserProfile): string {
    let body = content.template
    
    body = body.replace('{{userName}}', user.name || 'there')
    body = body.replace('{{firstName}}', user.name?.split(' ')[0] || 'there')
    
    // Recommendation reasons
    if (content.productId) {
      const reason = getRecommendationReason(content.productId, user)
      body = body.replace('{{reason}}', reason)
    }
    
    return body
  }
  
  // Failure handling
  async handleFailure(notification: NotificationQueue) {
    if (notification.metadata.retryCount < 3) {
      // Retry with exponential backoff
      await this.retryNotification(notification, {
        delayMs: Math.pow(2, notification.metadata.retryCount) * 1000
      })
    } else {
      // Give up, mark as failed
      await this.markAsFailed(notification)
      
      // Try alternate channel
      if (notification.channel === 'email') {
        await this.sendViaAlternate(notification, channel: 'whatsapp')
      }
    }
  }
}
```

### Channel-Specific Logic

**Email** (Resend):
```typescript
async function sendEmail(notification: NotificationQueue) {
  const user = await getUser(notification.userId)
  
  // Check opt-in
  if (!user.notificationPreferences.email.enabled) {
    return { status: 'skipped', reason: 'user_opted_out' }
  }
  
  // Respect quiet hours
  const now = new Date()
  const hour = now.getHours()
  const { start, end } = user.notificationPreferences.email.quietHours
  
  if (isWithinQuietHours(hour, start, end)) {
    // Reschedule for morning
    return { status: 'rescheduled', scheduledFor: getNextMorning() }
  }
  
  await resend.emails.send({
    from: 'Earn4Insights <notify@earn4insights.com>',
    to: user.email,
    subject: notification.content.subject,
    html: notification.content.body,
    headers: {
      'X-Campaign-ID': notification.targeting.campaignId,
      'List-Unsubscribe': `<mailto:unsubscribe@earn4insights.com?subject=unsubscribe&body=${user.id}>`
    }
  })
  
  // Track
  await trackNotification(notification.id, 'sent')
}
```

**WhatsApp** (Requires Business API):
```typescript
async function sendWhatsApp(notification: NotificationQueue) {
  const user = await getUser(notification.userId)
  
  // CRITICAL: WhatsApp requires explicit opt-in
  if (!user.notificationPreferences.whatsapp.optInDate) {
    return { status: 'skipped', reason: 'no_whatsapp_consent' }
  }
  
  // Use approved template (WhatsApp Business requirement)
  await whatsappClient.sendTemplate({
    to: user.phone,
    template: notification.content.template,
    params: notification.content.personalization
  })
}
```

**SMS** (Twilio):
```typescript
async function sendSMS(notification: NotificationQueue) {
  // SMS is expensive - use sparingly
  // Only for high-priority or time-sensitive
  
  if (notification.targeting.priority !== 'urgent') {
    return { status: 'downgraded', alternateChannel: 'email' }
  }
  
  await twilioClient.messages.create({
    body: notification.content.body,
    to: user.phone,
    from: process.env.TWILIO_PHONE
  })
}
```

---

## 4️⃣ BRAND-FACING ANALYTICS

### Safe Segments to Expose

```typescript
// Analytics Dashboard for Brands
type BrandAnalytics = {
  surveyId: string
  
  // Aggregated Demographics (Min 10 users per segment)
  demographics: {
    byAge: {
      ageRange: string
      responseCount: number
      avgNPS: number
      sentiment: { positive: number, neutral: number, negative: number }
    }[]
    
    byLocation: {
      country: string
      state?: string
      responseCount: number
      avgNPS: number
    }[]
    
    byGender: {
      gender: string
      responseCount: number
      avgNPS: number
    }[]
  }
  
  // Behavior Patterns
  engagement: {
    timeToComplete: { avg: number, median: number }
    dropoffRate: number
    completionByChannel: {
      channel: string
      completionRate: number
    }[]
  }
  
  // Conversion Funnels
  funnel: {
    notificationSent: number
    notificationOpened: number
    surveyStarted: number
    surveyCompleted: number
  }
  
  // Trending Topics (From text responses)
  insights: {
    topKeywords: { word: string, frequency: number }[]
    commonThemes: string[]
    sentimentTrend: { date: string, score: number }[]
  }
}
```

### Privacy-Preserving Aggregation

```typescript
// NEVER show individual responses
function getSegmentedAnalytics(surveyId: string) {
  const MIN_SEGMENT_SIZE = 10  // CRITICAL: Prevent de-anonymization
  
  const segments = await db
    .select({
      ageRange: sql`demographics->>'ageRange'`,
      count: count(),
      avgNPS: avg(surveyResponses.npsScore)
    })
    .from(surveyResponses)
    .where(eq(surveyResponses.surveyId, surveyId))
    .groupBy(sql`demographics->>'ageRange'`)
    .having(sql`count(*) >= ${MIN_SEGMENT_SIZE}`)  // Hide small segments
  
  return segments
}
```

### What Brands CANNOT See

❌ Individual user names (unless publicly shared)  
❌ Exact locations (only city/country)  
❌ Segments smaller than 10 users  
❌ Correlation of sensitive attributes  
❌ User browsing history outside their product  

### What Brands CAN See

✅ Aggregated demographic performance  
✅ Sentiment trends over time  
✅ Category-level engagement  
✅ A/B test results  
✅ Funnel metrics  

---

## 5️⃣ PRIVACY, ETHICS & COMPLIANCE

### Consent Management

```typescript
// Granular consent
type ConsentSettings = {
  personalizedNotifications: {
    enabled: boolean
    channels: {
      email: boolean
      whatsapp: boolean
      sms: boolean
    }
    consentDate: string
  }
  
  behavioralTracking: {
    enabled: boolean
    purpose: string  // "To improve recommendations"
    consentDate: string
  }
  
  dataSharing: {
    anonymizedAnalytics: boolean  // Can brands see aggregated data?
    thirdPartyResearch: boolean   // Participate in research studies?
    consentDate: string
  }
}
```

### Transparency UI

```typescript
// "Why am I seeing this?" feature
function showExplanation(productId: string, userId: string) {
  const reasons = getRecommendationReasons(productId, userId)
  
  return {
    title: "Why you're seeing this",
    reasons: [
      "You selected 'Tech' as an interest",
      "This product matches your past survey responses",
      "It's a new launch in your preferred category"
    ],
    controls: [
      {
        label: "Not interested in this category",
        action: () => removeCategory(userId, product.category)
      },
      {
        label: "Adjust my preferences",
        link: "/settings/personalization"
      }
    ]
  }
}
```

### Opt-Out Flows

```typescript
// Easy unsubscribe
function handleUnsubscribe(userId: string, scope: 'all' | 'marketing' | 'product') {
  if (scope === 'all') {
    // Disable all notifications except critical
    await updateUserConsent(userId, {
      personalizedNotifications: false,
      marketingEmails: false,
      behavioralTracking: false  // Stop tracking
    })
  }
  
  // Confirm to user
  await sendEmail(userId, {
    subject: "You've been unsubscribed",
    body: "You'll only receive critical account updates. You can re-enable anytime in settings."
  })
}
```

### Data Deletion (GDPR Right to be Forgotten)

```typescript
async function deleteUserData(userId: string) {
  // 1. Anonymize survey responses (keep for research)
  await anonymizeResponses(userId)
  
  // 2. Delete PII
  await db.delete(userProfiles).where(eq(userProfiles.id, userId))
  
  // 3. Delete activity logs older than 30 days
  await db.delete(userEvents)
    .where(and(
      eq(userEvents.userId, userId),
      lt(userEvents.timestamp, thirtyDaysAgo)
    ))
  
  // 4. Remove from notification queues
  await db.delete(notificationQueue).where(eq(notificationQueue.userId, userId))
  
  // 5. Send confirmation
  await sendEmail(userId, {
    subject: "Your data has been deleted",
    body: "All personal information removed. Anonymized survey responses retained for research."
  })
}
```

### Sensitive Attributes Handling

```typescript
// Encryption at rest
async function storeSensitiveAttribute(userId: string, key: string, value: string) {
  // Require explicit consent
  const consent = await getSensitiveConsent(userId, key)
  if (!consent) {
    throw new Error('No consent for sensitive attribute')
  }
  
  // Encrypt
  const encrypted = await encrypt(value, key: process.env.SENSITIVE_DATA_KEY)
  
  await db.update(userProfiles)
    .set({
      sensitiveData: {
        encrypted: true,
        attributes: { [key]: encrypted }
      }
    })
    .where(eq(userProfiles.id, userId))
}
```

---

## 6️⃣ TECHNICAL IMPLEMENTATION (Next.js)

### What to Build NOW (Phase 1)

```typescript
// 1. User Profile Extension
// File: src/db/schema.ts
export const userProfiles = pgTable('user_profiles', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  
  // Demographics (JSONB for flexibility)
  demographics: jsonb('demographics'),
  interests: jsonb('interests'),
  
  // Consent
  consent: jsonb('consent').notNull().default({
    personalizedNotifications: false,
    behavioralTracking: false
  }),
  
  // Notification prefs
  notificationPreferences: jsonb('notification_preferences'),
  
  createdAt: timestamp('created_at').defaultNow()
})

// 2. Event Tracking Table
export const userEvents = pgTable('user_events', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => userProfiles.id),
  eventType: text('event_type').notNull(),
  metadata: jsonb('metadata'),
  timestamp: timestamp('timestamp').defaultNow(),
  sessionId: text('session_id')
})

// 3. Notification Queue Table
export const notificationQueue = pgTable('notification_queue', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => userProfiles.id),
  channel: text('channel').notNull(),
  content: jsonb('content').notNull(),
  status: text('status').default('queued'),
  scheduledFor: timestamp('scheduled_for'),
  sentAt: timestamp('sent_at'),
  createdAt: timestamp('created_at').defaultNow()
})
```

### Server Actions (Phase 1)

```typescript
// File: src/server/personalization/trackingService.ts
'use server'

export async function trackEvent(event: {
  userId: string
  eventType: string
  metadata: Record<string, any>
}) {
  // Only track if user consented
  const user = await getUserConsent(event.userId)
  if (!user.consent.behavioralTracking) {
    return { tracked: false, reason: 'no_consent' }
  }
  
  await db.insert(userEvents).values({
    id: crypto.randomUUID(),
    userId: event.userId,
    eventType: event.eventType,
    metadata: event.metadata,
    timestamp: new Date(),
    sessionId: getSessionId()
  })
  
  // Update engagement score asynchronously
  updateEngagementScore(event.userId)
  
  return { tracked: true }
}
```

```typescript
// File: src/server/notifications/notificationService.ts
'use server'

export async function sendNotification(params: {
  userId: string
  channel: 'email' | 'whatsapp' | 'sms'
  template: string
  data: Record<string, any>
}) {
  // Check consent
  const user = await getUser(params.userId)
  if (!user.notificationPreferences[params.channel].enabled) {
    return { sent: false, reason: 'user_opted_out' }
  }
  
  // Queue notification
  await db.insert(notificationQueue).values({
    id: crypto.randomUUID(),
    userId: params.userId,
    channel: params.channel,
    content: {
      template: params.template,
      personalization: params.data
    },
    scheduledFor: getOptimalSendTime(user)
  })
  
  return { sent: true, scheduled: true }
}
```

### What to STUB (Phase 2-3)

```typescript
// File: src/server/personalization/recommendationService.ts
'use server'

// STUB: Simple popularity-based for now
export async function getRecommendedProducts(userId: string) {
  // TODO: Implement scoring algorithm in Phase 3
  
  // For now: Show trending in user's interests
  const user = await getUser(userId)
  
  return db
    .select()
    .from(products)
    .where(
      sql`category = ANY(${user.interests.categories})`
    )
    .orderBy(desc(products.viewCount))
    .limit(10)
}
```

### What to POSTPONE

⏸️ **ML-based recommendations** (6+ months)  
⏸️ **Real-time personalization engine** (scaling issue)  
⏸️ **Advanced A/B testing framework** (need more users)  
⏸️ **Cross-platform identity resolution** (privacy complex)  

### Interface Abstraction (Future-Proofing)

```typescript
// File: src/server/personalization/interfaces.ts

// Abstract interface for recommendation engine
export interface IRecommendationEngine {
  getRecommendations(userId: string, limit: number): Promise<Product[]>
  trackInteraction(userId: string, productId: string, type: string): Promise<void>
}

// Phase 1 implementation
export class RuleBasedRecommendations implements IRecommendationEngine {
  async getRecommendations(userId: string, limit: number) {
    // Simple rule-based logic
  }
}

// Phase 3 implementation (future)
export class ScoringBasedRecommendations implements IRecommendationEngine {
  async getRecommendations(userId: string, limit: number) {
    // Complex scoring algorithm
  }
}

// Easy to swap implementations
const recommendationEngine: IRecommendationEngine = 
  process.env.FEATURE_FLAG_ADVANCED_RECS 
    ? new ScoringBasedRecommendations()
    : new RuleBasedRecommendations()
```

---

## IMPLEMENTATION ROADMAP

### Month 1-2: Foundation (Phase 1)
- ✅ Database schema for user profiles
- ✅ Consent management UI
- ✅ Basic event tracking
- ✅ Rule-based notification targeting
- ✅ Email notifications (Resend)
- ✅ Basic analytics dashboard

### Month 3-4: Behavior Tracking (Phase 2)
- Track product views, survey responses
- Calculate engagement scores
- Build interest vectors
- Smart notification timing
- A/B test notification templates

### Month 5-6: Recommendations (Phase 3)
- Product relevance scoring
- Personalized homepage
- Diversity injection
- Category rankings
- Explainability ("Why you see this")

### Month 7+: Learning & Scale (Phase 4)
- Feedback loops
- Algorithm tuning
- Advanced segmentation
- Predictive models (optional)

---

## SUCCESS METRICS

**User Engagement**:
- Notification open rate (target: >25%)
- Click-through rate (target: >10%)
- Survey completion rate (target: >40%)
- Weekly active users growth

**Personalization Quality**:
- Recommendation relevance (survey users)
- Time to first survey response (should decrease)
- User satisfaction score (CSAT)

**Privacy Compliance**:
- Consent rate (target: >70%)
- Opt-out rate (target: <5%)
- Data deletion request time (target: <48hrs)

**Brand Value**:
- Segmented insights adoption
- Analytics dashboard usage
- Brands requesting specific segments

---

## FINAL NOTES

**This is a MARATHON, not a SPRINT.**

Start with Phase 1 (rule-based). It's:
- Transparent
- Debuggable
- Compliant
- Good enough for 90% of use cases

Only move to Phase 2/3 when:
- You have >1000 active users
- Current system shows limitations
- You have data to validate improvements

**NEVER sacrifice privacy for personalization.**

Users trust you with their data. Honor that trust.

---

Ready to implement? Let's start with:
1. User profile schema extension
2. Consent management UI
3. Basic event tracking
4. First notification campaign

Which would you like to tackle first?
