'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Global marketing footer.
 *
 * Rendered once in the root layout so every public page gets a consistent
 * footer (previously only the landing page had one, inline). Hidden on the
 * /dashboard and /admin app shells, which carry their own chrome — mirrors
 * the SiteHeader hide-on-dashboard pattern.
 *
 * Social links are intentionally omitted for now (handles pending); drop them
 * into the `Connect` slot when ready.
 */
export function SiteFooter() {
  const pathname = usePathname()
  if (pathname?.startsWith('/dashboard') || pathname?.startsWith('/admin')) {
    return null
  }

  return (
    <footer className="border-t px-6 py-12">
      <div className="mx-auto max-w-6xl">
        {/* Brand tagline — full width on top */}
        <div className="text-center mb-10">
          <h4 className="text-sm font-semibold text-foreground">Earn4Insights</h4>
          <p className="mt-1 text-sm italic text-muted-foreground max-w-md mx-auto leading-snug">
            The consumer intelligence infrastructure where brands, consumers, and influencers meet
          </p>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            Multimodal feedback. Multilingual intelligence. Real-time analytics and personalized
            recommendations — structured for brands, rewarding consumers.
          </p>
        </div>

        {/* Links — 3 columns, responsive (2-up on mobile) */}
        <div className="grid grid-cols-2 gap-6 max-w-2xl mx-auto text-center sm:grid-cols-3 sm:text-left">
          <div>
            <h4 className="text-sm font-semibold text-foreground">Explore</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/top-products" className="hover:text-foreground transition-colors">
                  Rankings
                </Link>
              </li>
              <li>
                <Link href="/help" className="hover:text-foreground transition-colors">
                  Help Center
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground">Company</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/about-us" className="hover:text-foreground transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/contact-us" className="hover:text-foreground transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground">Legal</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/privacy-policy" className="hover:text-foreground transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms-of-service" className="hover:text-foreground transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/refund-policy" className="hover:text-foreground transition-colors">
                  Refund Policy
                </Link>
              </li>
              <li>
                <Link href="/transparency" className="hover:text-foreground transition-colors">
                  Transparency
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t pt-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Earn4Insights. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
