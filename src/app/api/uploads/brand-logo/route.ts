import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'

/**
 * Vercel Blob client-upload token exchange for brand logos.
 *
 * Used by `@vercel/blob/client` upload() from the brand onboarding
 * wizard (step 5) and the future brand settings page. Mirrors the
 * pattern in src/app/api/uploads/feedback-media/route.ts.
 *
 * Security:
 *   - Auth gate: brand session only. Anonymous/consumer uploads
 *     rejected before any token is issued.
 *   - Content-type allowlist: PNG / JPG / WEBP only (no SVG — XSS risk
 *     when served back inline).
 *   - 2 MB hard cap via maximumSizeInBytes.
 *   - Pathname locked to "brand-logos/" prefix so a malicious client
 *     payload can't write into another namespace.
 *   - addRandomSuffix=true so filename collisions across brands don't
 *     overwrite each other's logos.
 *
 * We do NOT persist the logo URL on upload-complete — the wizard
 * stores it via the saveBrandAssetsAction once the brand finishes
 * step 5. Orphan blob URLs (uploaded but never saved) age out under
 * the existing media-retention sweep.
 */

const LOGO_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const LOGO_MAX_BYTES = 2 * 1024 * 1024 // 2 MB

export async function POST(request: Request): Promise<NextResponse> {
  // ── Auth gate — brand only ────────────────────────────────────
  // Done OUTSIDE handleUpload so unauthenticated requests don't even
  // hit the SDK's body parser. handleUpload also receives `request`
  // for its own use (e.g. callback verification).
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if ((session.user as any).role !== 'brand') {
    return NextResponse.json({ error: 'Brand access only' }, { status: 403 })
  }

  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith('brand-logos/')) {
          throw new Error('Invalid upload pathname')
        }
        return {
          allowedContentTypes: LOGO_CONTENT_TYPES,
          maximumSizeInBytes: LOGO_MAX_BYTES,
          addRandomSuffix: true,
          // tokenPayload kept minimal — we don't need any state here.
          tokenPayload: JSON.stringify({}),
        }
      },
      onUploadCompleted: async () => {
        // No-op. The wizard / settings save action persists the URL.
        // Orphans get swept by media-retention sweep.
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    )
  }
}
