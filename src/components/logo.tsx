/**
 * E-Lens brand logo component.
 *
 * Variant + theme aware — picks the right SVG from /public/branding/
 * based on the lockup needed (icon / horizontal / stacked / primary)
 * and the surface color (dark / light). Defaults to icon + dark for
 * backwards compatibility with the original `<Logo size={N} />` API.
 *
 * Why <img> instead of next/image:
 *   - SVG works directly with no Next.js config changes
 *   - next/image with SVG requires `images.dangerouslyAllowSVG: true`
 *     which enables it for ALL SVGs (security flag we don't want for
 *     a brand-asset-only need)
 *   - Static logos don't benefit from next/image optimization (already
 *     tiny — primary is 1.1 KB, icon is 0.7 KB)
 *
 * Visual note: the old component always applied `rounded-xl`. The new
 * SVGs have their own corner radius baked in (~18% of tile width per
 * brand spec §6). We do NOT force rounded-xl any more — callers who
 * want extra outer rounding can pass it via `className`.
 */

type LogoVariant = 'icon' | 'horizontal' | 'stacked' | 'primary'
type LogoTheme = 'dark' | 'light'

interface LogoProps {
  /** Which lockup. Defaults to `'icon'` (back-compat with original API). */
  variant?: LogoVariant
  /** `'dark'` for dark surfaces (the app), `'light'` for emails / PDFs.
   *  Defaults to `'dark'` since the app is dark-themed. */
  theme?: LogoTheme
  width?: number
  height?: number
  /** Convenience alias — sets both width AND height to `size`. Kept so
   *  existing `<Logo size={48} />` callsites continue working unchanged. */
  size?: number
  className?: string
  /** Hint that this image is LCP-critical. */
  priority?: boolean
}

const SOURCES: Record<LogoVariant, Record<LogoTheme, string>> = {
  icon: {
    // icon-app.svg is full-color; works on any background
    dark:  '/branding/icon-app.svg',
    light: '/branding/icon-app.svg',
  },
  horizontal: {
    dark:  '/branding/logo-horizontal-dark.svg',
    light: '/branding/logo-horizontal-light.svg',
  },
  stacked: {
    // Only a dark variant ships in the kit; light reuses dark
    // (stacked is for splash / avatars where bg is brand-controlled)
    dark:  '/branding/logo-stacked-dark.svg',
    light: '/branding/logo-stacked-dark.svg',
  },
  primary: {
    dark:  '/branding/logo-primary-dark.svg',
    light: '/branding/logo-primary-light.svg',
  },
}

// Sensible defaults per variant — callers can write `<Logo variant="horizontal" />`
// without specifying dimensions. Preserves each SVG's aspect ratio.
const DEFAULT_DIMENSIONS: Record<LogoVariant, { width: number; height: number }> = {
  icon:       { width: 40,  height: 40  },
  horizontal: { width: 180, height: 40  }, // ~4.5:1
  stacked:    { width: 160, height: 120 }, // ~4:3
  primary:    { width: 240, height: 96  }, // ~5:2 — main lockup with tagline
}

export function Logo({
  variant = 'icon',
  theme = 'dark',
  width,
  height,
  size,
  className,
  priority,
}: LogoProps) {
  const defaults = DEFAULT_DIMENSIONS[variant]
  const finalWidth = width ?? size ?? defaults.width
  const finalHeight = height ?? size ?? defaults.height
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={SOURCES[variant][theme]}
      alt="Earn4Insights"
      width={finalWidth}
      height={finalHeight}
      className={className}
      {...(priority
        ? { fetchPriority: 'high' as const, loading: 'eager' as const }
        : {})}
      decoding="async"
    />
  )
}
