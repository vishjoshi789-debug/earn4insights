/**
 * Cron: Process Social Mentions
 * GET /api/cron/process-social-mentions
 *
 * Runs daily at 05:30 UTC (see vercel.json).
 *
 * Two jobs in one pass:
 *  1. POLL — Use YouTubeAdapter to search for new product mentions
 *             based on active social_listening_rules. Stores results
 *             in social_mentions for entities that have no webhook.
 *  2. NOTIFY — Process all pending social_mentions (notificationsSent=false),
 *              emit social.mention.detected for each, mark notified.
 *
 * Auth: Bearer CRON_SECRET header (Vercel Cron injects automatically).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAllActiveRules, textMatchesRule } from '@/db/repositories/socialListeningRuleRepository'
import {
  createMention,
  getPendingMentions,
  markNotificationsSent,
  markProcessed,
} from '@/db/repositories/socialMentionRepository'
import { emit, PLATFORM_EVENTS } from '@/server/eventBus'
import { db } from '@/db'
import { products } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { YouTubeAdapter } from '@/server/social/platformAdapters'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = {
    polled:   { youtube: 0, newMentions: 0 },
    notified: { processed: 0, skipped: 0 },
    errors:   [] as string[],
  }

  // ── Job 1: Poll YouTube for new mentions ─────────────────────────────────
  try {
    const youtubeAdapter = new YouTubeAdapter()
    const activeRules = await getAllActiveRules()
    const youtubeRules = activeRules.filter(
      r => r.platforms.includes('youtube') || r.platforms.includes('all')
    )

    for (const rule of youtubeRules) {
      if (rule.keywords.length === 0) continue

      try {
        // YouTubeAdapter.fetchMentions returns SocialPostInput[] from the existing social listening system
        // We store relevant ones into social_mentions for our notification pipeline
        const mentions = await youtubeAdapter.fetchMentions(rule.keywords, rule.entityId)
        results.polled.youtube++

        for (const mention of mentions) {
          const text = mention.content ?? mention.title ?? ''
          if (!text || !textMatchesRule(text, rule)) continue

          // Resolve brand owner
          let brandId: string | undefined
          if (rule.entityType === 'product') {
            const rows = await db
              .select({ ownerId: products.ownerId })
              .from(products)
              .where(eq(products.id, rule.entityId))
              .limit(1)
            brandId = rows[0]?.ownerId ?? undefined
          } else if (rule.entityType === 'brand') {
            brandId = rule.entityId
          }

          if (!brandId) continue

          await createMention({
            platform:            'youtube',
            mentionUrl:          mention.url ?? null,
            mentionText:         text.slice(0, 1000),
            mentionedEntityType: rule.entityType,
            mentionedEntityId:   rule.entityId,
            authorHandle:        mention.author ?? null,
            authorFollowerCount: null,
            sentimentScore:      mention.sentimentScore != null
              ? String(mention.sentimentScore)
              : null,
            relevanceScore:      null,
            detectedAt:          new Date(),
            processedAt:         null,
          })
          results.polled.newMentions++
        }
      } catch (ruleErr: any) {
        results.errors.push(`YouTube rule ${rule.id}: ${ruleErr?.message ?? String(ruleErr)}`)
      }
    }
  } catch (pollErr: any) {
    results.errors.push(`Poll job: ${pollErr?.message ?? String(pollErr)}`)
  }

  // ── Job 2: Notify on pending mentions ────────────────────────────────────
  try {
    const pending = await getPendingMentions(200)

    for (const mention of pending) {
      try {
        // Resolve brand owner for notification targeting
        let brandId: string | undefined

        if (mention.mentionedEntityType === 'product') {
          const rows = await db
            .select({ ownerId: products.ownerId })
            .from(products)
            .where(eq(products.id, mention.mentionedEntityId))
            .limit(1)
          brandId = rows[0]?.ownerId ?? undefined
        } else if (mention.mentionedEntityType === 'brand') {
          brandId = mention.mentionedEntityId
        }

        if (!brandId) {
          // Can't target — mark processed to stop retrying
          await markNotificationsSent(mention.id)
          results.notified.skipped++
          continue
        }

        await emit(PLATFORM_EVENTS.SOCIAL_MENTION_DETECTED, {
          brandId,
          mentionId:   mention.id,
          mentionText: mention.mentionText.slice(0, 200),
          platform:    mention.platform,
          entityType:  mention.mentionedEntityType,
          entityId:    mention.mentionedEntityId,
        })

        await markNotificationsSent(mention.id)
        results.notified.processed++
      } catch (mentionErr: any) {
        results.errors.push(`Mention ${mention.id}: ${mentionErr?.message ?? String(mentionErr)}`)
      }
    }
  } catch (notifyErr: any) {
    results.errors.push(`Notify job: ${notifyErr?.message ?? String(notifyErr)}`)
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    ...results,
  })
}
