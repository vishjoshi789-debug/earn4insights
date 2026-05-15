import 'server-only'
import OpenAI from 'openai'

const EMBEDDING_MODEL = 'text-embedding-3-small' // 1536-dim, matches faq_articles.embedding
const EMBEDDING_DIMS = 1536

let client: OpenAI | null = null
function getClient(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return client
}

/**
 * Generate a 1536-dim embedding for `text` via OpenAI text-embedding-3-small.
 * Used by FAQ seed and admin edit routes for chatbot semantic matching.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const trimmed = text.replace(/\s+/g, ' ').trim().slice(0, 8000)
  const resp = await getClient().embeddings.create({
    model: EMBEDDING_MODEL,
    input: trimmed,
  })
  const vec = resp.data[0]?.embedding
  if (!vec || vec.length !== EMBEDDING_DIMS) {
    throw new Error(`Embedding generation failed: got ${vec?.length ?? 0} dims, expected ${EMBEDDING_DIMS}`)
  }
  return vec
}

/** Batch convenience — calls OpenAI once per item; sequential to keep order. */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const out: number[][] = []
  for (const t of texts) out.push(await generateEmbedding(t))
  return out
}
