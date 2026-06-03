import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'

/**
 * Vercel Blob client-upload token exchange for influencer profile photos.
 *
 * Used by `@vercel/blob/client` upload() from the influencer onboarding
 * wizard (step 2) and the influencer profile edit page. Mirrors the
 * brand-logo / feedback-media patterns.
 *
 * Security:
 *   - Auth gate: any logged-in user with influencer access (role
 *     'influencer' OR is_influencer flag true on a dual-role consumer).
 *     Brand-only and anonymous uploads rejected before any token issued.
 *   - Content-type allowlist: PNG / JPG / WEBP only (no SVG — XSS risk
 *     when served back inline).
 *   - 2 MB hard cap via maximumSizeInBytes (Q6 approved).
 *   - Pathname locked to "influencer-photos/" prefix.
 *   - addRandomSuffix=true so filename collisions across influencers
 *     don't overwrite each other's photos.
 *
 * We do NOT persist the photo URL on upload-complete — the wizard
 * stores it via the influencer onboarding save action. Orphan blob
 * URLs (uploaded but never saved) age out under the existing
 * media-retention sweep.
 */

const PHOTO_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/webp']
// 5 MB — accommodates modern phone photos out of camera (iPhone 12+ and
// Android flagships routinely produce 3–5 MB JPEGs). Brand logos stay
// at 2 MB because logos are typically small graphics. Vercel Blob's
// single-file cap is 5 GB so we have plenty of headroom.
const PHOTO_MAX_BYTES = 5 * 1024 * 1024 // 5 MB

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Allow:
  //   - role === 'influencer' (pure influencer signup, 3.5B)
  //   - role === 'consumer' (dual-role; isInfluencer flag set by an
  //     earlier registerAsInfluencer call OR about to be set by the
  //     wizard's complete action). The wizard mounts before the flag
  //     is necessarily flipped, so we don't gate on isInfluencer here
  //     — just role membership in the influencer-capable set.
  //   - Admin (debug / impersonation contexts)
  const role = (session.user as any).role
  if (role !== 'influencer' && role !== 'consumer' && role !== 'admin') {
    return NextResponse.json({ error: 'Influencer access required' }, { status: 403 })
  }

  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith('influencer-photos/')) {
          throw new Error('Invalid upload pathname')
        }
        return {
          allowedContentTypes: PHOTO_CONTENT_TYPES,
          maximumSizeInBytes: PHOTO_MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({}),
        }
      },
      onUploadCompleted: async () => {
        // No-op. Wizard / profile-edit save persists the URL.
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
