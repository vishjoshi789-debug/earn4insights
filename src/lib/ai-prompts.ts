// src/lib/ai-prompts.ts

import type {
  AnalysisRequest,
  AnalysisResponse,
  CoreSentiment,
} from './ai-types';

/**
 * OPTIONAL: runtime schema validator (if you want later).
 * For now we just declare the type so your LLM client
 * can say: Promise<AnalysisResponse>
 */
export type { AnalysisResponse };

/**
 * Build a single string prompt for the LLM from our structured request.
 * You will pass this string to Gemini / OpenAI / etc.
 */
export function buildProductAnalysisPrompt(request: AnalysisRequest): string {
  const { product, feedback, socialPosts, task, audience, language, options } =
    request;

  const feedbackSection =
    feedback.length === 0
      ? 'No direct platform feedback was provided.'
      : feedback
          .map((f, idx) => {
            return [
              `# Feedback ${idx + 1}`,
              `rating: ${f.rating}/5`,
              `sentiment: ${f.sentiment}${
                f.sentimentScore != null ? ` (${f.sentimentScore})` : ''
              }`,
              `timestamp: ${f.timestamp}`,
              `source: ${f.source}`,
              `text: ${f.text}`,
            ].join('\n');
          })
          .join('\n\n');

  const socialSection =
    socialPosts.length === 0
      ? 'No social posts were provided.'
      : socialPosts
          .map((p, idx) => {
            return [
              `# Social Post ${idx + 1}`,
              `platform: ${p.platform}`,
              `user: ${p.userHandle}`,
              `sentiment: ${p.sentiment}${
                p.sentimentScore != null ? ` (${p.sentimentScore})` : ''
              }`,
              `engagement: likes=${p.likes}, shares=${p.shares}, comments=${p.comments}`,
              `timestamp: ${p.timestamp}`,
              `text: ${p.text}`,
            ].join('\n');
          })
          .join('\n\n');

  const maxActionItems = options?.maxActionItems ?? 5;
  const maxCampaignIdeas = options?.maxCampaignIdeas ?? 5;

  const conservativeRisk = options?.conservativeRiskScan ? 'YES' : 'NO';

  return `
You are an expert **product, marketing and community analyst**.
Your job is to read customer feedback and social media posts for a product,
then return a **strict JSON** object with insights for a ${audience}.

Always answer in language: ${language ?? 'en'}.

The product context is:

- id: ${product.id}
- name: ${product.name}
- price: ${product.price}
- description: ${product.description ?? '(no description provided)'}
- category: ${product.category ?? '(not specified)'}
- brand: ${product.brandName ?? '(not specified)'}

The type of analysis requested (task) is: "${task}".

---

## INPUT – Platform Feedback

${feedbackSection}

---

## INPUT – Social Posts (Twitter, Instagram, TikTok, Meta, Google, Amazon, Flipkart, Reddit, etc.)

${socialSection}

---

## RISK SENSITIVITY

Be conservative when marking risks / fake reviews: ${conservativeRisk}.

---

## REQUIRED OUTPUT FORMAT (VERY IMPORTANT)

Return **ONLY** a JSON object. No markdown, no backticks, no commentary outside JSON.

The JSON must match this shape:

{
  "productSummary": string,
  "overallSentiment": "positive" | "negative" | "neutral",
  "overallComment": string,
  "themes": [
    {
      "label": string,
      "sentiment": "positive" | "negative" | "neutral",
      "summary": string,
      "exampleQuotes": string[],
      "importanceScore": number // 1–5
    }
  ],
  "kpis": [
    {
      "key": string,
      "label": string,
      "value": number | string,
      "trend": "up" | "down" | "flat" | null,
      "commentary": string | null
    }
  ],
  "risks": [
    {
      "type": "fake_reviews" | "brand_crisis" | "compliance" | "security_privacy" | "churn_risk" | "operational_issue" | "other",
      "severity": 1 | 2 | 3 | 4 | 5,
      "summary": string,
      "evidence": string[],
      "suggestedMitigation": string | null
    }
  ],
  "actionItems": [
    {
      "title": string,
      "description": string,
      "impact": "low" | "medium" | "high",
      "effort": "low" | "medium" | "high",
      "category": "product" | "ux" | "marketing" | "support" | "operations" | "other"
    }
  ],
  "campaignIdeas": [
    {
      "title": string,
      "description": string,
      "primaryPlatform": string,
      "targetPersona": string | null
    }
  ],
  "explanationForNonExperts": string | null,
  "rawModelText": string | null
}

### Additional rules:

- **Do NOT invent data** that has no support in the inputs.
- If there is not enough evidence for a risk, do not include it.
- For each theme, use exampleQuotes as short snippets (real or lightly paraphrased).
- Respect the limits:
  - Max ${maxActionItems} actionItems
  - Max ${maxCampaignIdeas} campaignIdeas

Remember: output JSON only, no extra text.
`.trim();
}
