import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, ArrowRight, Mail, MessageCircle } from 'lucide-react'
import {
  findArticleBySlug,
  listFaqArticles,
} from '@/db/repositories/supportRepository'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { ChatMarkdown } from '@/components/support/markdown'
import { HelpfulVoteButtons } from './HelpfulVoteButtons'

const CATEGORY_LABEL: Record<string, string> = {
  getting_started: 'Getting Started',
  account: 'Account',
  payments: 'Payments',
  campaigns: 'Campaigns',
  feedback: 'Products & Surveys',
  deals: 'Deals',
  community: 'Community',
  influencer: 'Influencer',
  competitive_intel: 'Competitive Intelligence',
  privacy: 'Privacy',
  technical: 'Technical',
  billing: 'Billing',
}

export const revalidate = 300

/**
 * Per-article metadata for SEO.
 * Title pattern: "<title> — Earn4Insights Help"
 * Description: article excerpt (≤300 chars)
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const article = await findArticleBySlug(slug)
  if (!article || !article.isPublished) {
    return { title: 'Help — Earn4Insights' }
  }
  const desc = article.excerpt.slice(0, 300)
  return {
    title: `${article.title} — Earn4Insights Help`,
    description: desc,
    alternates: { canonical: `/help/${article.slug}` },
    openGraph: {
      title: `${article.title} — Earn4Insights Help`,
      description: desc,
      url: `/help/${article.slug}`,
      type: 'article',
    },
  }
}

export default async function HelpArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const article = await findArticleBySlug(slug)
  if (!article || !article.isPublished) notFound()

  // Related: same category, exclude self, top 5 by helpful_count.
  const related = (
    await listFaqArticles({ category: article.category, publishedOnly: true }, 6, 0)
  )
    .filter((a) => a.id !== article.id)
    .slice(0, 5)

  // JSON-LD structured data — Article schema (FAQ is for inline Q&A blocks;
  // an Article is a better fit for our long-form pages).
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.excerpt,
    inLanguage: 'en',
    articleSection: CATEGORY_LABEL[article.category] ?? article.category,
    datePublished: new Date(article.createdAt).toISOString(),
    dateModified: new Date(article.updatedAt).toISOString(),
    publisher: {
      '@type': 'Organization',
      name: 'Earn4Insights',
      url: 'https://earn4insights.com',
    },
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-background dark:to-violet-950/30">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
      />

      <article className="mx-auto w-full max-w-3xl px-4 py-10 md:py-14">
        {/* Breadcrumb */}
        <nav className="mb-5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground" aria-label="Breadcrumb">
          <Link href="/help" className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
            <ChevronLeft className="h-3 w-3" />
            Help
          </Link>
          <span>/</span>
          <Link href={`/help?category=${article.category}`} className="hover:text-foreground transition-colors">
            {CATEGORY_LABEL[article.category] ?? article.category}
          </Link>
          <span>/</span>
          <span className="text-foreground line-clamp-1">{article.title}</span>
        </nav>

        <header className="mb-6 space-y-2">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
              {CATEGORY_LABEL[article.category] ?? article.category}
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{article.title}</h1>
          <p className="text-base text-muted-foreground">{article.excerpt}</p>
        </header>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
          <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold">
            <ChatMarkdown text={article.content} />
          </div>

          <div className="mt-6 border-t border-border pt-4">
            <HelpfulVoteButtons
              slug={article.slug}
              initialHelpful={article.helpfulCount}
              initialNotHelpful={article.notHelpfulCount}
            />
          </div>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <aside className="mt-10">
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Related articles</h2>
            <ul className="space-y-2">
              {related.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/help/${r.slug}`}
                    className="group flex items-start gap-3 rounded-xl border border-border bg-card p-3 transition-all hover:shadow-sm hover:border-primary/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{r.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{r.excerpt}</p>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        )}

        {/* Still need help CTA */}
        <section className="mt-10 rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <div className="mb-3 flex justify-center">
            <Logo size={36} />
          </div>
          <h2 className="text-lg font-bold">Still need help?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Our team typically responds within 24 hours.
          </p>
          <div className="mt-4 flex flex-col items-center justify-center gap-2 sm:flex-row">
            <Button asChild size="sm">
              <Link href="/dashboard">
                <MessageCircle className="mr-2 h-4 w-4" />
                Open chat assistant
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href="mailto:contact@earn4insights.com">
                <Mail className="mr-2 h-4 w-4" />
                contact@earn4insights.com
              </a>
            </Button>
          </div>
        </section>
      </article>
    </div>
  )
}
