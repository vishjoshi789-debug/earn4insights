import { ImageResponse } from 'next/og'

/**
 * Dynamically-generated 1200×630 social share card.
 *
 * Next.js 15 auto-wires this file into <meta property="og:image"> for the
 * whole site (and twitter-image.tsx re-exports it for the Twitter card).
 * Replaces the old square 512×512 app icon, which letterboxed badly in
 * LinkedIn / X / WhatsApp link previews.
 *
 * Brand colours per public/branding/brand-spec.md §3:
 *   Indigo start #4F46E5 · Near-black #0F0F1A · Gold accent #F5C451
 */

export const alt =
  'Earn4Insights — the consumer intelligence infrastructure where brands, consumers, and influencers meet'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          backgroundColor: '#0F0F1A',
          backgroundImage:
            'radial-gradient(circle at 18% 18%, #4F46E5 0%, rgba(79,70,229,0) 42%), radial-gradient(circle at 90% 100%, #7C3AED 0%, rgba(124,58,237,0) 45%)',
          padding: '88px 96px',
        }}
      >
        {/* Beta pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            alignSelf: 'flex-start',
            gap: 12,
            padding: '8px 20px',
            borderRadius: 999,
            border: '1px solid rgba(245,196,81,0.5)',
            backgroundColor: 'rgba(245,196,81,0.08)',
            color: '#F5C451',
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: 1,
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              backgroundColor: '#F5C451',
            }}
          />
          NOW IN BETA · FREE
        </div>

        {/* Wordmark */}
        <div
          style={{
            display: 'flex',
            marginTop: 40,
            fontSize: 104,
            fontWeight: 800,
            color: '#FFFFFF',
            letterSpacing: -2,
          }}
        >
          Earn4Insights
        </div>

        {/* Gold accent rule */}
        <div
          style={{
            width: 140,
            height: 8,
            borderRadius: 8,
            marginTop: 28,
            backgroundColor: '#F5C451',
          }}
        />

        {/* Tagline */}
        <div
          style={{
            display: 'flex',
            marginTop: 36,
            maxWidth: 880,
            fontSize: 42,
            lineHeight: 1.3,
            color: '#C7C9D9',
          }}
        >
          The consumer intelligence infrastructure where brands, consumers, and influencers meet.
        </div>
      </div>
    ),
    { ...size }
  )
}
