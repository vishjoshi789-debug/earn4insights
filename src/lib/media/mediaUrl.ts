/**
 * Canonical URL for streaming a feedback-media object to a browser.
 *
 * ALWAYS render this instead of `feedbackMedia.storageKey`.
 *
 * Why: media is stored in Vercel Blob with `access: 'public'`, so `storageKey`
 * is an unauthenticated, permanent CDN URL. Putting it in a page hands every
 * viewer (and anything that later scrapes the HTML, a referrer log, or a
 * screenshot) a link to consumer audio/video that works forever and cannot be
 * revoked. The proxy route checks the session and media ownership on every
 * request, forwards Range so seeking still works, and sends
 * `cache-control: private, no-store`.
 *
 * Pure string builder — safe in server and client components alike.
 */
export function feedbackMediaUrl(mediaId: string): string {
  return `/api/dashboard/feedback-media/${encodeURIComponent(mediaId)}/download`
}
