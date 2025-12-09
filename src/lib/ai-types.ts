// src/lib/ai-types.ts

import type { Product, Feedback, SocialPost } from '@/lib/data';

/**
 * Core sentiment bucket used consistently across the app + LLM.
 */
export type CoreSentiment = 'positive' | 'negative' | 'neutral';

/**
 * Minimal product info we send to the LLM.
 * (We reuse Product, but keep this slim & stable for prompts.)
 */
export interface ProductContext {
  id: Product['id'];
  name: Product['name'];
  description: Product['description'];
  price: Product['price'];
  // Optional future fields:
  category?: string;
  brandName?: string;
}

/**
 * Feedback sample format to send to LLM.
 * You can start with a subset and add more fields later.
 */
export interface FeedbackSampleForAI {
  id: Feedback['id'];
  productId: Feedback['productId'];
  rating: Feedback['rating'];
  text: Feedback['text'];
  timestamp: Feedback['timestamp'];
  sentiment: CoreSentiment;
  sentimentScore?: number;
  source: 'platform-feedback'; // reserved if later you add email, CS tickets, etc.
}

/**
 * Social post sample format for LLM.
 */
export interface SocialPostSampleForAI {
  id: SocialPost['id'];
  productId: SocialPost['productId'];
  platform: SocialPost['platform'];
  userHandle: SocialPost['userHandle'];
  text: SocialPost['text'];
  likes: SocialPost['likes'];
  shares: SocialPost['shares'];
  comments: SocialPost['comments'];
  timestamp: SocialPost['timestamp'];
  sentiment: CoreSentiment;
  sentimentScore?: number;
  influenceScore?: number;
}

/**
 * What kind of analysis are we asking the LLM to perform?
 */
export type AnalysisTaskKind =
  | 'product_overview'          // high-level story & key insights
  | 'feedback_summary'          // focus only on feedback
  | 'social_summary'            // focus only on social
  | 'risk_scan'                 // fake reviews, crises, compliance, etc.
  | 'campaign_ideas'            // growth & content ideas
  | 'full_report';              // everything together (like your PDF report)

/**
 * Context about who will read this.
 * Useful to tune tone & recommendations.
 */
export type AnalysisAudience =
  | 'founder'
  | 'product_manager'
  | 'marketer'
  | 'customer_success'
  | 'analyst';

/**
 * Request that your backend will send to the LLM.
 * This is your **data contract**.
 */
export interface AnalysisRequest {
  task: AnalysisTaskKind;
  audience: AnalysisAudience;
  language?: string; // e.g. "en", "hi", "en-IN"

  product: ProductContext;
  feedback: FeedbackSampleForAI[];
  socialPosts: SocialPostSampleForAI[];

  /**
   * Optional knobs you can tweak later without changing the core shape.
   */
  options?: {
    maxActionItems?: number;
    maxCampaignIdeas?: number;
    /**
     * If true, the LLM should be conservative in risk flags
     * (i.e., avoid over-calling fake reviews / crises).
     */
    conservativeRiskScan?: boolean;
  };
}

/**
 * A single “theme” or pattern from feedback / social.
 */
export interface AnalysisTheme {
  label: string;                        // e.g. "Battery life", "Comfort", "Delivery delays"
  sentiment: CoreSentiment;
  summary: string;                      // 2–3 lines about this theme
  exampleQuotes: string[];              // direct quotes or paraphrases
  importanceScore: number;              // 1–5 (5 = very important / frequent)
}

/**
 * A concrete action your user (brand / PM) can take.
 */
export interface ActionItem {
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  category:
    | 'product'
    | 'ux'
    | 'marketing'
    | 'support'
    | 'operations'
    | 'other';
}

/**
 * Risk or “red flag” surfaced by the LLM.
 */
export interface RiskFlag {
  type:
    | 'fake_reviews'
    | 'brand_crisis'
    | 'compliance'
    | 'security_privacy'
    | 'churn_risk'
    | 'operational_issue'
    | 'other';
  severity: 1 | 2 | 3 | 4 | 5; // 5 = critical
  summary: string;
  evidence: string[]; // e.g. snippets / paraphrased examples
  suggestedMitigation?: string;
}

/**
 * Simple numeric KPI the LLM can comment on.
 * These can be computed by your backend and only *explained* by the LLM.
 */
export interface AnalysisKPI {
  key: string;                  // e.g. "avg_rating", "positive_share", "negative_share"
  label: string;                // human friendly
  value: number | string;       // allow "4.5/5" or "63%" etc.
  trend?: 'up' | 'down' | 'flat';
  commentary?: string;          // short explanation in plain English
}

/**
 * Suggestion for campaigns or channels.
 */
export interface CampaignIdea {
  title: string;
  description: string;
  primaryPlatform:
    | SocialPost['platform']    // existing platforms from your data model
    | 'amazon'
    | 'flipkart'
    | 'reddit'
    | 'email'
    | 'whatsapp'
    | 'youtube'
    | 'other';
  targetPersona?: string;       // e.g. "runners in tier-1 cities"
}

/**
 * The unified structured response we expect from the LLM.
 * In practice you can have different shapes for different tasks,
 * but starting with one superset works well.
 */
export interface AnalysisResponse {
  productSummary: string;
  overallSentiment: CoreSentiment;
  overallComment: string; // one short paragraph

  themes: AnalysisTheme[];
  kpis: AnalysisKPI[];
  risks: RiskFlag[];
  actionItems: ActionItem[];
  campaignIdeas: CampaignIdea[];

  /**
   * For transparency — you can show this in a "Why this analysis?" section.
   */
  explanationForNonExperts?: string;

  /**
   * Keep the raw model text if you ever want to debug /
   * show a more narrative version.
   */
  rawModelText?: string;
}
