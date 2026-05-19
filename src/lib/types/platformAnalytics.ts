/**
 * Platform Analytics — shared types between the service, API, and UI.
 *
 * All monetary fields are paise (₹ × 100). UI formats with formatCurrency().
 * All percentages are 0–100 floats (not 0–1).
 */

export type TimeRange = '7d' | '30d' | '90d' | '12m' | 'all'

export type UserRole = 'all' | 'brand' | 'consumer' | 'influencer'

export type CostCategory =
  | 'hosting'
  | 'database'
  | 'ai_api'
  | 'email_service'
  | 'sms_whatsapp'
  | 'cdn_storage'
  | 'payment_gateway'
  | 'marketing'
  | 'salaries'
  | 'legal'
  | 'office'
  | 'tools_subscriptions'
  | 'other'

export const COST_CATEGORIES: readonly CostCategory[] = [
  'hosting',
  'database',
  'ai_api',
  'email_service',
  'sms_whatsapp',
  'cdn_storage',
  'payment_gateway',
  'marketing',
  'salaries',
  'legal',
  'office',
  'tools_subscriptions',
  'other',
] as const

// ── Overview ─────────────────────────────────────────────────────
export interface StakeholderBreakdown {
  brands: number
  consumers: number
  influencers: number
}

export interface Overview {
  totalUsers: number
  dau: number
  mau: number
  dauMauRatio: number              // 0.0 – 1.0
  newUsersInRange: number
  growthRatePct: number            // vs previous equal window
  stakeholders: StakeholderBreakdown
}

// ── Growth ───────────────────────────────────────────────────────
export interface GrowthPoint {
  date: string                     // ISO yyyy-MM-dd
  total: number
  brands: number
  consumers: number
  influencers: number
  newUsers: number
}

export interface UserGrowth {
  series: GrowthPoint[]
  wowPct: number
  momPct: number
  qoqPct: number
}

// ── Retention ────────────────────────────────────────────────────
export interface RetentionRow {
  cohortDate: string               // ISO yyyy-MM-dd
  cohortSize: number
  day1: number | null
  day7: number | null
  day14: number | null
  day30: number | null
  day60: number | null
  day90: number | null
}

export interface RetentionData {
  role: UserRole
  cohorts: RetentionRow[]
  avgDay1: number | null
  avgDay7: number | null
  avgDay30: number | null
}

// ── Revenue ──────────────────────────────────────────────────────
export interface RevenuePoint {
  date: string
  gross: number                    // paise
  fees: number                     // paise
  net: number                      // paise
  refunds: number                  // paise
  payments: number
}

export interface PaymentStats {
  totalCount: number
  successCount: number
  failedCount: number
  successRatePct: number
  avgAmount: number                // paise
}

export interface RevenueBlock {
  totalGross: number               // paise
  totalFees: number                // paise
  totalNet: number                 // paise
  totalRefunds: number             // paise
  mrr: number                      // paise
  mrrGrowthPct: number
  series: RevenuePoint[]
  payments: PaymentStats
}

// ── Engagement ───────────────────────────────────────────────────
export interface CountPoint {
  date: string
  count: number
}

export interface CommunityPoint {
  date: string
  posts: number
  comments: number
}

export interface FeatureAdoption {
  feature: string                  // 'feedback', 'surveys', 'deals', etc.
  brandPct: number | null
  consumerPct: number | null
  influencerPct: number | null
}

export interface ChatStats {
  conversations: number
  resolvedByAi: number
  resolutionRatePct: number
}

export interface EngagementBlock {
  feedback: { series: CountPoint[]; total: number; pctChange: number }
  surveys: { series: CountPoint[]; total: number; pctChange: number }
  deals: { series: CountPoint[]; total: number; pctChange: number }
  community: { series: CommunityPoint[]; totalPosts: number; totalComments: number; pctChange: number }
  features: FeatureAdoption[]
  chat: ChatStats
}

// ── Financial ────────────────────────────────────────────────────
export interface FinancialBlock {
  grossMarginPct: number
  netMarginPct: number
  burnRate: number                 // paise (monthly)
  runwayMonths: number | null      // null = infinite (net positive)
  cashBalance: number              // paise
  costBreakdown: Array<{ category: CostCategory; amount: number }>  // paise
  totalCosts: number               // paise
  ltv: { brand: number; consumer: number }     // paise
  arpu: number                                  // paise
  cumulative: Array<{ month: string; revenue: number; costs: number }>  // for the revenue-vs-costs chart
}

// ── Predictions ──────────────────────────────────────────────────
export interface PredictionPoint {
  date: string
  actual: number | null            // null in the forecast tail
  predicted: number | null         // null in the historical head
  confLow: number | null           // ±1.96σ band
  confHigh: number | null
}

export type PredictionTrend = 'improving' | 'stable' | 'declining'

export interface Prediction {
  metric: 'users' | 'revenue'
  series: PredictionPoint[]
  trend: PredictionTrend
  slope: number                    // metric units per day
  expectedAtHorizonDays: { days: number; value: number }
}

// ── Health score ─────────────────────────────────────────────────
export type HealthBand = 'healthy' | 'attention' | 'critical'
export type HealthTrend = 'improving' | 'stable' | 'declining'

export interface HealthScoreFactor {
  key: 'dau_mau' | 'retention_d7' | 'user_growth' | 'revenue_growth' | 'engagement' | 'support_csat'
  label: string
  weight: number                   // 0–1
  value: number                    // raw score 0–100 for this factor
  contribution: number             // weight * value (already accounting)
}

export interface HealthScore {
  score: number                    // 0–100, weighted
  band: HealthBand
  trend: HealthTrend
  trendDeltaPct: number            // vs previous equivalent window
  factors: HealthScoreFactor[]
  computedAt: string
}

// ── Support shortcut ─────────────────────────────────────────────
export interface SupportSnapshot {
  openTickets: number
  aiResolutionRatePct: number
  avgFirstResponseHours: number | null
  satisfactionAvg: number | null
}

// ── Full dashboard payload ───────────────────────────────────────
export interface DashboardPayload {
  range: TimeRange
  computedAt: string
  health: HealthScore
  overview: Overview
  userGrowth: UserGrowth
  retention: RetentionData
  revenue: RevenueBlock
  engagement: EngagementBlock
  financial: FinancialBlock
  predictions: { users: Prediction; revenue: Prediction }
  support: SupportSnapshot
  _errors?: string[]               // sub-block failures (defensive-analytics pattern)
}
