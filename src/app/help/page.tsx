import type { Metadata } from 'next'
import { db } from '@/db'
import { faqArticles } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { listFaqArticles } from '@/db/repositories/supportRepository'
import { HelpBrowserClient } from './HelpBrowserClient'

export const metadata: Metadata = {
  title: 'Help Center — Earn4Insights',
  description:
    'Find answers about Earn4Insights — campaigns, feedback, rewards, payments, privacy, and more. Search the knowledge base or browse by category.',
  alternates: { canonical: '/help' },
  openGraph: {
    title: 'Help Center — Earn4Insights',
    description:
      'Find answers about Earn4Insights — campaigns, feedback, rewards, payments, privacy, and more.',
    url: '/help',
    type: 'website',
  },
}

export const revalidate = 300 // ISR — refresh the help index every 5 minutes

/**
 * Public Help Center landing page.
 *
 * Server-renders the article list + category counts for SEO. The client
 * island below handles search and role/category filtering without a
 * round-trip to the server.
 */
export default async function HelpPage() {
  // Fetch all published articles ordered by helpful_count for the initial render.
  const articles = await listFaqArticles({ publishedOnly: true }, 100, 0)

  // Counts per category — used by the category cards.
  const counts = await db
    .select({
      category: faqArticles.category,
      count: sql<number>`count(*)::int`,
    })
    .from(faqArticles)
    .where(eq(faqArticles.isPublished, true))
    .groupBy(faqArticles.category)
  const countByCategory: Record<string, number> = {}
  for (const r of counts) countByCategory[r.category] = r.count

  return <HelpBrowserClient articles={articles} countByCategory={countByCategory} />
}
