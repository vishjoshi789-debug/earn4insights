'use server'

import 'server-only'

export type Sentiment = 'positive' | 'negative' | 'neutral'

export type SentimentAnalysis = {
  sentiment: Sentiment
  score: number // -1 to 1
  confidence: number // 0 to 1
}

// Simple keyword-based sentiment analysis
// Can be upgraded to OpenAI API or other AI services
const positiveKeywords = [
  'love', 'great', 'excellent', 'amazing', 'awesome', 'fantastic', 'wonderful',
  'good', 'best', 'perfect', 'happy', 'satisfied', 'pleased', 'impressed',
  'helpful', 'easy', 'fast', 'quality', 'recommend', 'useful', 'nice',
  'enjoyed', 'brilliant', 'outstanding', 'superb', 'exceptional'
]

const negativeKeywords = [
  'hate', 'bad', 'terrible', 'awful', 'horrible', 'poor', 'worst',
  'disappointing', 'frustrated', 'angry', 'annoyed', 'difficult', 'slow',
  'complicated', 'broken', 'useless', 'waste', 'problem', 'issue',
  'confusing', 'unclear', 'unhappy', 'dissatisfied', 'failed'
]

/**
 * Analyze sentiment of text using keyword matching
 * 
 * To enable AI-powered sentiment analysis:
 * 1. Install OpenAI: npm install openai
 * 2. Add API key to .env: OPENAI_API_KEY=your_key
 * 3. Uncomment the OpenAI implementation below
 */
export async function analyzeSentiment(text: string): Promise<SentimentAnalysis> {
  if (!text || text.trim().length === 0) {
    return { sentiment: 'neutral', score: 0, confidence: 0 }
  }

  const lowerText = text.toLowerCase()
  const words = lowerText.split(/\s+/)

  let positiveCount = 0
  let negativeCount = 0

  words.forEach(word => {
    if (positiveKeywords.some(kw => word.includes(kw))) positiveCount++
    if (negativeKeywords.some(kw => word.includes(kw))) negativeCount++
  })

  const total = positiveCount + negativeCount
  const score = total === 0 ? 0 : (positiveCount - negativeCount) / Math.max(total, words.length / 10)
  
  let sentiment: Sentiment = 'neutral'
  if (score > 0.1) sentiment = 'positive'
  else if (score < -0.1) sentiment = 'negative'

  const confidence = total === 0 ? 0.3 : Math.min(total / 5, 1)

  return { sentiment, score, confidence }

  // TODO: Implement AI-powered sentiment analysis
  // Example with OpenAI:
  /*
  const { OpenAI } = await import('openai')
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  
  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: 'Analyze the sentiment of the following text. Respond with only a JSON object: {"sentiment": "positive"|"negative"|"neutral", "score": -1 to 1, "confidence": 0 to 1}'
      },
      { role: 'user', content: text }
    ],
    temperature: 0,
  })
  
  const result = JSON.parse(completion.choices[0].message.content || '{}')
  return result
  */
}

/**
 * Batch analyze sentiment for multiple texts
 */
export async function batchAnalyzeSentiment(texts: string[]): Promise<SentimentAnalysis[]> {
  return Promise.all(texts.map(text => analyzeSentiment(text)))
}
