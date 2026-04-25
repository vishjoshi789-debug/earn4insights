import 'server-only'

/**
 * Competitive Intelligence Email Service
 *
 * Builds + sends HTML emails for competitive digests and weekly reports.
 * Follows the same Resend client pattern as `emailNotifications.ts`.
 *
 * Templates never include:
 *   - Raw feedback text
 *   - Individual consumer identifiers
 *   - Cohort sizes below MIN_COHORT_SIZE (repo enforces null)
 *   - Competitor financial/budget data
 */

import { Resend } from 'resend'

let resend: Resend | null = null

function getResendClient() {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY)
  }
  return resend
}

// ── Types matching report.content shapes ──────────────────────────

type KeyFinding = { heading: string; detail: string; severity: string }
type Recommendation = { action: string; rationale: string; priority: 'high' | 'medium' | 'low' }

type WeeklyReportContent = {
  headline?: string
  executiveSummary?: string
  keyFindings?: KeyFinding[]
  recommendations?: Recommendation[]
  trendNarrative?: string
}

type DailyDigestContent = {
  scores?: Array<{ score: number; rank: number; trend: string }>
  alerts?: Array<{ alertType: string; title: string; severity: string }>
  insights?: Array<{ title: string; severity: string; insightType: string }>
  cohortFloor?: number
}

export type ReportRow = {
  id: string
  brandId: string
  reportType: string
  title: string
  content: unknown
  category: string | null
  periodStart: string
  periodEnd: string
}

// ── Public: dispatcher ────────────────────────────────────────────

export async function sendCompetitiveReportEmail(params: {
  report: ReportRow
  recipientEmail: string
  brandName: string
}): Promise<{ success: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[CI email] RESEND_API_KEY not configured — skipping send')
    return { success: false, error: 'API key not configured' }
  }
  const client = getResendClient()
  if (!client) return { success: false, error: 'Resend client not initialized' }

  const { report, recipientEmail, brandName } = params
  const subject = buildSubject(report)
  const html = buildHtml(report, brandName)

  try {
    const { error } = await client.emails.send({
      from: process.env.EMAIL_FROM || 'insights@earn4insights.com',
      to: recipientEmail,
      subject,
      html,
    })
    if (error) {
      console.error('[CI email] send error:', error)
      return { success: false, error: String(error) }
    }
    return { success: true }
  } catch (err) {
    console.error('[CI email] exception:', err)
    return { success: false, error: err instanceof Error ? err.message : 'unknown' }
  }
}

// ── Subject + dispatch ────────────────────────────────────────────

function buildSubject(report: ReportRow): string {
  const period = `${report.periodStart}${report.periodStart !== report.periodEnd ? ` – ${report.periodEnd}` : ''}`
  if (report.reportType === 'weekly_summary') {
    return `Weekly competitive summary · ${report.category ?? 'all categories'} · ${period}`
  }
  if (report.reportType === 'daily_digest') {
    return `Daily competitive digest · ${report.periodEnd}`
  }
  return `${report.title}`
}

function buildHtml(report: ReportRow, brandName: string): string {
  if (report.reportType === 'weekly_summary') {
    return buildWeeklyHtml(report, brandName)
  }
  if (report.reportType === 'daily_digest') {
    return buildDigestHtml(report, brandName)
  }
  // Fallback: generic body.
  return buildGenericHtml(report, brandName)
}

// ── Layout building blocks ────────────────────────────────────────

function layout(innerHtml: string, headerTitle: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://earn4insights.com'
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(headerTitle)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:20px;">
      <div style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);border-radius:12px 12px 0 0;padding:26px 30px;">
        <div style="color:rgba(255,255,255,0.75);font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Earn4Insights · Competitive Intelligence</div>
        <h1 style="color:#fff;margin:6px 0 0;font-size:22px;line-height:1.2;">${escapeHtml(headerTitle)}</h1>
      </div>
      <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:26px 30px;">
        ${innerHtml}
        <div style="margin-top:28px;padding-top:18px;border-top:1px solid #e5e7eb;">
          <a href="${appUrl}/dashboard/competitive-intelligence" style="display:inline-block;padding:10px 18px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">Open dashboard</a>
        </div>
        <p style="margin-top:18px;font-size:12px;color:#6b7280;line-height:1.5;">
          Aggregate intelligence only. No individual consumer data or raw feedback appears in this email.
          Cohorts smaller than 5 are never reported.
        </p>
      </div>
      <p style="text-align:center;margin-top:14px;font-size:11px;color:#9ca3af;">
        © ${new Date().getFullYear()} Earn4Insights.
      </p>
    </div>
  </body>
</html>`
}

// ── Weekly summary template ───────────────────────────────────────

function buildWeeklyHtml(report: ReportRow, brandName: string): string {
  const c = (report.content ?? {}) as WeeklyReportContent
  const findings = (c.keyFindings ?? []).slice(0, 6)
  const recs = (c.recommendations ?? []).slice(0, 5)

  const findingsHtml = findings.length
    ? `<div style="margin-top:22px;">
        <div style="font-size:13px;font-weight:700;text-transform:uppercase;color:#4b5563;letter-spacing:0.06em;margin-bottom:10px;">Key findings</div>
        ${findings
          .map((f) => {
            const sevColor = severityColor(f.severity)
            return `<div style="margin:0 0 12px;padding:12px 14px;border-left:3px solid ${sevColor};background:#f9fafb;border-radius:4px;">
              <div style="font-weight:600;color:#111827;font-size:14px;">${escapeHtml(f.heading)}</div>
              <div style="margin-top:4px;font-size:13px;color:#4b5563;line-height:1.5;">${escapeHtml(f.detail)}</div>
            </div>`
          })
          .join('')}
      </div>`
    : ''

  const recsHtml = recs.length
    ? `<div style="margin-top:22px;">
        <div style="font-size:13px;font-weight:700;text-transform:uppercase;color:#4b5563;letter-spacing:0.06em;margin-bottom:10px;">Recommendations</div>
        ${recs
          .map((r) => {
            const pColor = r.priority === 'high' ? '#dc2626' : r.priority === 'medium' ? '#d97706' : '#16a34a'
            return `<div style="margin:0 0 10px;padding:12px 14px;background:#eff6ff;border-radius:6px;">
              <div style="display:flex;align-items:baseline;gap:8px;">
                <span style="font-size:10px;font-weight:700;color:${pColor};text-transform:uppercase;letter-spacing:0.08em;">${r.priority}</span>
                <span style="font-weight:600;color:#111827;font-size:14px;">${escapeHtml(r.action)}</span>
              </div>
              ${r.rationale ? `<div style="margin-top:4px;font-size:12px;color:#4b5563;line-height:1.5;">${escapeHtml(r.rationale)}</div>` : ''}
            </div>`
          })
          .join('')}
      </div>`
    : ''

  const trendHtml = c.trendNarrative
    ? `<div style="margin-top:22px;padding:14px 16px;background:#fef3c7;border-radius:6px;">
        <div style="font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Trend narrative</div>
        <div style="font-size:13px;color:#78350f;line-height:1.55;">${escapeHtml(c.trendNarrative)}</div>
      </div>`
    : ''

  const inner = `
    <p style="font-size:15px;color:#111827;margin:0 0 12px;">Hi ${escapeHtml(brandName)},</p>
    <p style="font-size:14px;color:#374151;line-height:1.55;margin:0 0 4px;">
      Here is your weekly competitive summary for <strong>${escapeHtml(report.category ?? 'all categories')}</strong>
      (${escapeHtml(report.periodStart)} – ${escapeHtml(report.periodEnd)}).
    </p>
    ${c.headline ? `<div style="margin-top:16px;padding:14px 16px;background:#f3f4f6;border-radius:8px;font-weight:600;font-size:15px;color:#111827;line-height:1.4;">${escapeHtml(c.headline)}</div>` : ''}
    ${c.executiveSummary ? `<p style="margin-top:16px;font-size:14px;color:#374151;line-height:1.6;">${escapeHtml(c.executiveSummary)}</p>` : ''}
    ${findingsHtml}
    ${recsHtml}
    ${trendHtml}
  `
  return layout(inner, `Weekly summary · ${report.category ?? 'all categories'}`)
}

// ── Daily digest template ─────────────────────────────────────────

function buildDigestHtml(report: ReportRow, brandName: string): string {
  const c = (report.content ?? {}) as DailyDigestContent
  const alerts = (c.alerts ?? []).slice(0, 8)
  const insights = (c.insights ?? []).slice(0, 6)

  const scoresHtml = c.scores && c.scores.length > 0
    ? `<div style="margin-top:18px;display:flex;flex-wrap:wrap;gap:10px;">
        ${c.scores
          .map(
            (s) => `<div style="flex:1 1 140px;padding:12px 14px;background:#f9fafb;border-radius:8px;">
              <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Score · rank #${s.rank}</div>
              <div style="margin-top:2px;font-size:22px;font-weight:700;color:#111827;">${s.score}</div>
              <div style="margin-top:2px;font-size:11px;color:${trendColor(s.trend)};text-transform:capitalize;">${escapeHtml(s.trend)}</div>
            </div>`
          )
          .join('')}
      </div>`
    : ''

  const alertsHtml = alerts.length
    ? `<div style="margin-top:22px;">
        <div style="font-size:13px;font-weight:700;text-transform:uppercase;color:#4b5563;letter-spacing:0.06em;margin-bottom:10px;">Today's alerts</div>
        ${alerts
          .map(
            (a) => `<div style="padding:10px 12px;margin-bottom:8px;border-left:3px solid ${severityColor(a.severity)};background:#f9fafb;border-radius:4px;">
              <div style="font-weight:600;color:#111827;font-size:13px;">${escapeHtml(a.title)}</div>
              <div style="margin-top:2px;font-size:11px;color:#6b7280;">${escapeHtml(a.alertType.replaceAll('_', ' '))}</div>
            </div>`
          )
          .join('')}
      </div>`
    : `<p style="margin-top:22px;font-size:13px;color:#6b7280;">No alerts today.</p>`

  const insightsHtml = insights.length
    ? `<div style="margin-top:22px;">
        <div style="font-size:13px;font-weight:700;text-transform:uppercase;color:#4b5563;letter-spacing:0.06em;margin-bottom:10px;">AI insights</div>
        ${insights
          .map(
            (i) => `<div style="padding:10px 12px;margin-bottom:8px;border-left:3px solid ${severityColor(i.severity)};background:#eff6ff;border-radius:4px;">
              <div style="font-weight:600;color:#111827;font-size:13px;">${escapeHtml(i.title)}</div>
              <div style="margin-top:2px;font-size:11px;color:#6b7280;">${escapeHtml(i.insightType.replaceAll('_', ' '))}</div>
            </div>`
          )
          .join('')}
      </div>`
    : ''

  const inner = `
    <p style="font-size:15px;color:#111827;margin:0 0 8px;">Hi ${escapeHtml(brandName)},</p>
    <p style="font-size:14px;color:#374151;line-height:1.55;margin:0;">
      Your competitive digest for ${escapeHtml(report.periodEnd)}.
    </p>
    ${scoresHtml}
    ${alertsHtml}
    ${insightsHtml}
  `
  return layout(inner, 'Daily competitive digest')
}

// ── Generic fallback ──────────────────────────────────────────────

function buildGenericHtml(report: ReportRow, brandName: string): string {
  const inner = `
    <p style="font-size:15px;color:#111827;margin:0 0 8px;">Hi ${escapeHtml(brandName)},</p>
    <p style="font-size:14px;color:#374151;line-height:1.55;">${escapeHtml(report.title)}</p>
    <pre style="margin-top:14px;padding:12px 14px;background:#f9fafb;border-radius:6px;font-size:12px;color:#374151;white-space:pre-wrap;word-break:break-word;max-height:300px;overflow:auto;">${escapeHtml(
      JSON.stringify(report.content ?? {}, null, 2).slice(0, 4000)
    )}</pre>
  `
  return layout(inner, report.title)
}

// ── Helpers ───────────────────────────────────────────────────────

function severityColor(sev: string): string {
  switch (sev) {
    case 'critical': return '#dc2626'
    case 'warning': return '#d97706'
    case 'opportunity': return '#059669'
    default: return '#6b7280'
  }
}

function trendColor(trend: string): string {
  if (trend === 'improving') return '#059669'
  if (trend === 'declining') return '#dc2626'
  return '#6b7280'
}

function escapeHtml(s: string): string {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
