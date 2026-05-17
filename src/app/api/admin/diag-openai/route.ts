import { NextRequest, NextResponse } from 'next/server'
import { runOpenAIDiagnostic } from '@/server/chatbotService'

/**
 * GET /api/admin/diag-openai
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * Probes the OpenAI configuration end-to-end:
 *   - is OPENAI_API_KEY set?
 *   - does the configured CHAT_MODEL (default gpt-4o-mini) respond?
 *
 * Returns the structured cause so you don't need to dig through
 * Vercel logs. Sample success response:
 *   { ok: true, model: 'gpt-4o-mini', hasKey: true,
 *     responsePreview: 'ok' }
 *
 * Sample failure responses:
 *   { ok: false, hasKey: false, cause: 'api_key',
 *     message: 'OPENAI_API_KEY env var not set' }
 *
 *   { ok: false, hasKey: true, cause: 'api_key', status: 401,
 *     code: 'invalid_api_key',
 *     message: 'Incorrect API key provided...' }
 *
 *   { ok: false, hasKey: true, cause: 'rate_limited', status: 429,
 *     message: 'You exceeded your current quota...' }
 *
 *   { ok: false, hasKey: true, cause: 'model_not_found', status: 404,
 *     code: 'model_not_found',
 *     message: 'The model `gpt-4o-mini` does not exist...' }
 */
export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await runOpenAIDiagnostic()
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}
