'use client'

import { ExternalLink, Play } from 'lucide-react'

/**
 * Inline preview for an influencer's cross-posted content link.
 *
 * - YouTube URLs render a real inline embed (no API key needed).
 * - Everything else (Instagram, TikTok, X, LinkedIn…) renders a clickable
 *   card — the influencer-supplied thumbnail if present, else a link card.
 *   We deliberately avoid platform oEmbed here: Instagram/LinkedIn oEmbed is
 *   auth-gated (needs a Facebook app token), so a thumbnail card is the
 *   robust, no-dependency way to make the link tangible for brands.
 *
 * NOTE: native hosting (upload/transcode/feed) is intentionally NOT done —
 * this is the "make the cross-post link tangible" polish, deferred native
 * hosting (see SESSION_RESUME strategy note).
 */
function youtubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
  ]
  for (const re of patterns) {
    const m = url.match(re)
    if (m) return m[1]
  }
  return null
}

export function ContentLinkPreview({
  url,
  thumbnailUrl,
  platform,
}: {
  url: string
  thumbnailUrl?: string | null
  platform?: string | null
}) {
  const ytId = youtubeId(url)

  if (ytId) {
    return (
      <div className="mt-2 aspect-video w-full overflow-hidden rounded-md border bg-black">
        <iframe
          src={`https://www.youtube.com/embed/${ytId}`}
          title="Content preview"
          className="h-full w-full"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group mt-2 flex items-center gap-2 overflow-hidden rounded-md border bg-card transition-colors hover:border-primary/40"
    >
      {thumbnailUrl ? (
        <div className="relative h-20 w-20 shrink-0 bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <Play className="h-5 w-5 text-white" />
          </div>
        </div>
      ) : (
        <div className="flex h-20 w-20 shrink-0 items-center justify-center bg-muted">
          <ExternalLink className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1 py-2 pr-2">
        {platform && <p className="text-xs font-medium">{platform}</p>}
        <p className="truncate text-[11px] text-muted-foreground group-hover:text-primary">{url}</p>
        <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-primary">
          Open ↗
        </span>
      </div>
    </a>
  )
}
