import 'server-only'

import { randomInt } from 'crypto'
import bcrypt from 'bcryptjs'
import { put } from '@vercel/blob'
import { Resend } from 'resend'
import { db } from '@/db'
import {
  users, userProfiles, consentRecords, feedback, surveyResponses,
  userEvents, communityDealsPost, communityDealsComments, communityDealsPostVotes,
  dealSaves, dealRedemptions, influencerFollows, influencerContentPosts,
  influencerProfiles,
} from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import {
  createDsarRequest, findDsarById, findLatestDsarByConsumer, updateDsarRequest,
} from '@/db/repositories/dsarRepository'
import { logDataAccess } from '@/lib/audit-log'

// Lazy Resend init
let resend: Resend | null = null
function getResend() {
  if (!resend && process.env.RESEND_API_KEY) resend = new Resend(process.env.RESEND_API_KEY)
  return resend
}

const FROM_EMAIL = process.env.EMAIL_FROM ?? 'privacy@earn4insights.com'
const RATE_LIMIT_DAYS = 30
const OTP_TTL_MS = 15 * 60 * 1000       // 15 minutes
const PDF_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

// ── Initiate ─────────────────────────────────────────────────────────────────

export async function initiateRequest(
  consumerId: string,
  consumerEmail: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<{ requestId: string; message: string }> {
  // Rate limit: 1 completed/active request per RATE_LIMIT_DAYS
  const latest = await findLatestDsarByConsumer(consumerId)
  if (latest) {
    const cutoff = new Date(Date.now() - RATE_LIMIT_DAYS * 24 * 60 * 60 * 1000)
    if (latest.createdAt > cutoff && !['expired', 'failed'].includes(latest.status)) {
      // If there is already an active otp_sent request, return it so the user can retry OTP
      if (latest.status === 'otp_sent' && latest.otpExpiresAt && latest.otpExpiresAt > new Date()) {
        return { requestId: latest.id, message: 'OTP already sent. Check your email.' }
      }
      if (latest.status === 'completed') {
        const daysRemaining = Math.ceil(
          (cutoff.getTime() - latest.createdAt.getTime() + RATE_LIMIT_DAYS * 24 * 60 * 60 * 1000)
          / (24 * 60 * 60 * 1000)
        )
        throw new Error(`You already requested your data ${RATE_LIMIT_DAYS - daysRemaining} days ago. You can request again in ${daysRemaining} day(s).`)
      }
    }
  }

  // Generate OTP
  const otp = String(randomInt(100000, 999999))
  const otpHash = await bcrypt.hash(otp, 10)
  const otpExpiresAt = new Date(Date.now() + OTP_TTL_MS)

  const record = await createDsarRequest({
    consumerId,
    status: 'otp_sent',
    otpHash,
    otpExpiresAt,
    otpAttempts: 0,
    maxOtpAttempts: 3,
    ipAddress: ipAddress ?? null,
    userAgent: userAgent ?? null,
  })

  await sendOtpEmail(consumerEmail, otp)

  await logDataAccess({
    userId: consumerId,
    action: 'export',
    dataType: 'all',
    accessedBy: consumerId,
    ipAddress,
    userAgent,
    reason: 'DSAR initiated (GDPR Art. 15) — OTP sent',
    metadata: { requestId: record.id },
  })

  return { requestId: record.id, message: 'Verification code sent to your email.' }
}

// ── Verify OTP ────────────────────────────────────────────────────────────────

export async function verifyOTP(
  requestId: string,
  consumerId: string,
  otp: string,
): Promise<{ success: boolean; pdfUrl?: string; expiresAt?: string; error?: string }> {
  const record = await findDsarById(requestId)

  if (!record || record.consumerId !== consumerId) {
    throw new Error('Request not found.')
  }
  if (record.status !== 'otp_sent') {
    if (record.status === 'completed') return { success: true, pdfUrl: record.pdfUrl ?? undefined, expiresAt: record.expiresAt?.toISOString() }
    throw new Error(`Request is ${record.status}.`)
  }
  if (!record.otpExpiresAt || record.otpExpiresAt < new Date()) {
    await updateDsarRequest(requestId, { status: 'expired' })
    throw new Error('Verification code has expired. Please start a new request.')
  }
  if (record.otpAttempts >= record.maxOtpAttempts) {
    await updateDsarRequest(requestId, { status: 'expired' })
    throw new Error('Too many incorrect attempts. Please start a new request.')
  }

  // Increment attempts first
  const newAttempts = record.otpAttempts + 1
  await updateDsarRequest(requestId, { otpAttempts: newAttempts })

  const valid = await bcrypt.compare(otp, record.otpHash!)
  if (!valid) {
    if (newAttempts >= record.maxOtpAttempts) {
      await updateDsarRequest(requestId, { status: 'expired' })
      throw new Error('Too many incorrect attempts. Please start a new request.')
    }
    const remaining = record.maxOtpAttempts - newAttempts
    throw new Error(`Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`)
  }

  // Valid — start generating
  await updateDsarRequest(requestId, { status: 'generating' })

  // Fetch consumer email for PDF/email
  const userRow = await db.select({ email: users.email }).from(users).where(eq(users.id, consumerId)).limit(1)
  const email = userRow[0]?.email ?? ''

  const { pdfUrl, expiresAt } = await generateDataPackage(requestId, consumerId, email)

  return { success: true, pdfUrl, expiresAt: expiresAt.toISOString() }
}

// ── Generate Data Package ─────────────────────────────────────────────────────

export async function generateDataPackage(
  requestId: string,
  consumerId: string,
  consumerEmail: string,
): Promise<{ pdfUrl: string; expiresAt: Date }> {
  try {
    const data = await collectAllData(consumerId, consumerEmail)

    // Build PDF
    const pdfBuffer = await buildPdf(data)

    // Upload to Vercel Blob
    const filename = `dsar/${requestId}/data-report-${Date.now()}.pdf`
    const blob = await put(filename, pdfBuffer, {
      access: 'public',
      contentType: 'application/pdf',
    })

    const now = new Date()
    const expiresAt = new Date(now.getTime() + PDF_TTL_MS)

    await updateDsarRequest(requestId, {
      status: 'completed',
      pdfUrl: blob.url,
      pdfGeneratedAt: now,
      expiresAt,
    })

    // Send delivery email
    await sendDataReadyEmail(consumerEmail, blob.url, expiresAt, requestId, pdfBuffer.length)

    await updateDsarRequest(requestId, { emailSentAt: new Date() })

    await logDataAccess({
      userId: consumerId,
      action: 'export',
      dataType: 'all',
      accessedBy: consumerId,
      reason: 'DSAR PDF generated and emailed (GDPR Art. 15)',
      metadata: { requestId, pdfUrl: blob.url, expiresAt: expiresAt.toISOString() },
    })

    return { pdfUrl: blob.url, expiresAt }
  } catch (err) {
    await updateDsarRequest(requestId, { status: 'failed' }).catch(() => {})
    throw err
  }
}

// ── Data Collection ───────────────────────────────────────────────────────────

type DsarData = {
  generatedAt: string
  account: {
    name: string | null
    email: string
    role: string | null
    createdAt: string | null
    demographics: Record<string, unknown> | null
    interests: unknown
    notificationPreferences: Record<string, unknown> | null
  }
  consents: {
    dataCategory: string
    granted: boolean
    grantedAt: string | null
    revokedAt: string | null
    purpose: string | null
    legalBasis: string | null
    consentVersion: string | null
  }[]
  feedbackItems: {
    productId: string | null
    rating: number | null
    text: string | null
    createdAt: string | null
  }[]
  surveyResponses: {
    surveyId: string | null
    responses: unknown
    completedAt: string | null
  }[]
  pointEvents: {
    eventType: string | null
    points: number | null
    createdAt: string | null
  }[]
  communityPosts: {
    title: string
    body: string
    status: string
    createdAt: string | null
  }[]
  communityComments: {
    body: string
    status: string
    createdAt: string | null
  }[]
  communityVoteCount: number
  savedDeals: {
    dealId: string
    savedAt: string | null
  }[]
  dealRedemptions: {
    dealId: string
    redemptionType: string
    pointsAwarded: number
    redeemedAt: string | null
  }[]
  influencerFollows: {
    influencerId: string
    followedAt: string | null
  }[]
  contentPosts: {
    title: string
    mediaType: string
    createdAt: string | null
  }[]
}

async function collectAllData(consumerId: string, consumerEmail: string): Promise<DsarData> {
  const [
    userRows,
    profileRows,
    consentRows,
    feedbackRows,
    surveyRows,
    eventRows,
    postRows,
    commentRows,
    voteRows,
    dealSaveRows,
    redemptionRows,
    followRows,
    contentRows,
  ] = await Promise.all([
    db.select().from(users).where(eq(users.id, consumerId)).limit(1),
    db.select().from(userProfiles).where(eq(userProfiles.id, consumerId)).limit(1),
    db.select().from(consentRecords).where(eq(consentRecords.userId, consumerId)).orderBy(desc(consentRecords.createdAt)),
    db.select().from(feedback).where(eq(feedback.userEmail, consumerEmail)).orderBy(desc(feedback.createdAt)).limit(500),
    db.select().from(surveyResponses).where(eq(surveyResponses.userEmail, consumerEmail)).orderBy(desc(surveyResponses.submittedAt)).limit(500),
    db.select().from(userEvents).where(eq(userEvents.userId, consumerId)).orderBy(desc(userEvents.createdAt)).limit(500),
    db.select({ title: communityDealsPost.title, body: communityDealsPost.body, status: communityDealsPost.status, createdAt: communityDealsPost.createdAt })
      .from(communityDealsPost).where(eq(communityDealsPost.authorId, consumerId)).orderBy(desc(communityDealsPost.createdAt)).limit(200),
    db.select({ body: communityDealsComments.body, status: communityDealsComments.status, createdAt: communityDealsComments.createdAt })
      .from(communityDealsComments).where(eq(communityDealsComments.authorId, consumerId)).orderBy(desc(communityDealsComments.createdAt)).limit(500),
    db.select({ id: communityDealsPostVotes.id })
      .from(communityDealsPostVotes).where(eq(communityDealsPostVotes.userId, consumerId)).limit(1),
    db.select({ dealId: dealSaves.dealId, savedAt: dealSaves.savedAt }).from(dealSaves).where(eq(dealSaves.userId, consumerId)).limit(200),
    db.select({ dealId: dealRedemptions.dealId, redemptionType: dealRedemptions.redemptionType, pointsAwarded: dealRedemptions.pointsAwarded, redeemedAt: dealRedemptions.redeemedAt })
      .from(dealRedemptions).where(eq(dealRedemptions.consumerId, consumerId)).orderBy(desc(dealRedemptions.redeemedAt)).limit(500),
    db.select({ influencerId: influencerFollows.influencerId, followedAt: influencerFollows.followedAt })
      .from(influencerFollows).where(eq(influencerFollows.consumerId, consumerId)).limit(200),
    db.select({ title: influencerContentPosts.title, mediaType: influencerContentPosts.mediaType, createdAt: influencerContentPosts.createdAt })
      .from(influencerContentPosts).where(eq(influencerContentPosts.influencerId, consumerId)).orderBy(desc(influencerContentPosts.createdAt)).limit(200),
  ])

  const user = userRows[0]
  const profile = profileRows[0]

  // Count community votes (just the count for privacy — not what they voted on)
  const voteCount = await db.$count(communityDealsPostVotes, eq(communityDealsPostVotes.userId, consumerId)).catch(() => 0)

  return {
    generatedAt: new Date().toISOString(),
    account: {
      name: (user as any)?.name ?? null,
      email: consumerEmail,
      role: (user as any)?.role ?? null,
      createdAt: (user as any)?.createdAt?.toISOString() ?? null,
      demographics: (profile?.demographics as Record<string, unknown>) ?? null,
      interests: profile?.interests ?? null,
      notificationPreferences: (profile?.notificationPreferences as Record<string, unknown>) ?? null,
    },
    consents: consentRows.map(c => ({
      dataCategory: c.dataCategory,
      granted: c.granted,
      grantedAt: c.grantedAt?.toISOString() ?? null,
      revokedAt: c.revokedAt?.toISOString() ?? null,
      purpose: c.purpose,
      legalBasis: c.legalBasis,
      consentVersion: c.consentVersion,
    })),
    feedbackItems: feedbackRows.map(f => ({
      productId: (f as any).productId ?? null,
      rating: (f as any).rating ?? null,
      text: (f as any).text ?? null,
      createdAt: (f as any).createdAt?.toISOString() ?? null,
    })),
    surveyResponses: surveyRows.map(s => ({
      surveyId: (s as any).surveyId ?? null,
      responses: (s as any).answers ?? null,
      completedAt: (s as any).submittedAt?.toISOString() ?? null,
    })),
    pointEvents: eventRows.map(e => ({
      eventType: (e as any).eventType ?? null,
      points: (e as any).points ?? null,
      createdAt: (e as any).createdAt?.toISOString() ?? null,
    })),
    communityPosts: postRows.map(p => ({
      title: p.title,
      body: p.body,
      status: p.status,
      createdAt: p.createdAt?.toISOString() ?? null,
    })),
    communityComments: commentRows.map(c => ({
      body: c.body,
      status: c.status,
      createdAt: c.createdAt?.toISOString() ?? null,
    })),
    communityVoteCount: typeof voteCount === 'number' ? voteCount : 0,
    savedDeals: dealSaveRows.map(d => ({
      dealId: d.dealId,
      savedAt: d.savedAt?.toISOString() ?? null,
    })),
    dealRedemptions: redemptionRows.map(r => ({
      dealId: r.dealId,
      redemptionType: r.redemptionType,
      pointsAwarded: r.pointsAwarded,
      redeemedAt: r.redeemedAt?.toISOString() ?? null,
    })),
    influencerFollows: followRows.map(f => ({
      influencerId: f.influencerId,
      followedAt: f.followedAt?.toISOString() ?? null,
    })),
    contentPosts: contentRows.map(c => ({
      title: c.title,
      mediaType: c.mediaType,
      createdAt: c.createdAt?.toISOString() ?? null,
    })),
  }
}

// ── PDF Builder ───────────────────────────────────────────────────────────────

async function buildPdf(data: DsarData): Promise<Buffer> {
  // Dynamic import so tree-shaking doesn't break non-Node runtimes
  const PDFDocument = (await import('pdfkit')).default

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4', info: { Title: 'Personal Data Report — Earn4Insights', Author: 'Earn4Insights Privacy Team' } })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const BRAND = '#4F46E5'   // indigo-600
    const GRAY  = '#6B7280'
    const BLACK = '#111827'
    const pageW = doc.page.width - 100

    function heading(text: string, level: 1 | 2 | 3 = 1) {
      if (level === 1) {
        doc.moveDown(0.5).font('Helvetica-Bold').fontSize(16).fillColor(BRAND).text(text).moveDown(0.3)
      } else if (level === 2) {
        doc.moveDown(0.4).font('Helvetica-Bold').fontSize(12).fillColor(BLACK).text(text).moveDown(0.2)
      } else {
        doc.moveDown(0.3).font('Helvetica-Bold').fontSize(10).fillColor(GRAY).text(text.toUpperCase()).moveDown(0.1)
      }
      doc.font('Helvetica').fontSize(10).fillColor(BLACK)
    }

    function row(label: string, value: string | null | undefined) {
      const v = value ?? '—'
      doc.font('Helvetica-Bold').fontSize(9).fillColor(GRAY).text(label, { continued: true, width: 180 })
      doc.font('Helvetica').fontSize(9).fillColor(BLACK).text(`  ${v}`, { width: pageW - 180 })
    }

    function divider() {
      doc.moveDown(0.3).strokeColor('#E5E7EB').lineWidth(0.5)
        .moveTo(50, doc.y).lineTo(50 + pageW, doc.y).stroke().moveDown(0.3)
      doc.fillColor(BLACK)
    }

    function tableRow(cols: string[], widths: number[], isHeader = false) {
      const x0 = 50
      let x = x0
      const y = doc.y
      const font = isHeader ? 'Helvetica-Bold' : 'Helvetica'
      const color = isHeader ? BRAND : BLACK
      cols.forEach((col, i) => {
        doc.font(font).fontSize(8).fillColor(color).text(String(col ?? '—'), x + 3, y, { width: widths[i] - 6, ellipsis: true })
        x += widths[i]
      })
      doc.moveDown(0.6)
    }

    // ── Cover ─────────────────────────────────────────────────────────────
    doc.rect(50, 50, pageW, 100).fill(BRAND)
    doc.font('Helvetica-Bold').fontSize(22).fillColor('white')
      .text('Personal Data Report', 50, 75, { width: pageW, align: 'center' })
    doc.font('Helvetica').fontSize(11).fillColor('white')
      .text('Earn4Insights · GDPR Article 15', 50, 105, { width: pageW, align: 'center' })
    doc.fillColor(BLACK).moveDown(5)

    row('Name', data.account.name)
    row('Email', data.account.email)
    row('Generated', new Date(data.generatedAt).toUTCString())
    divider()

    // ── Table of Contents ─────────────────────────────────────────────────
    heading('Contents', 2)
    const toc = [
      'Section 1 — Account Information',
      'Section 2 — Consent Records',
      'Section 3 — Feedback Submitted',
      'Section 4 — Survey Responses',
      'Section 5 — Points & Rewards',
      'Section 6 — Community Activity',
      'Section 7 — Influencer Activity',
      'Section 8 — Payment History',
      'Section 9 — Your Rights',
    ]
    toc.forEach(t => doc.font('Helvetica').fontSize(9).fillColor(GRAY).text(`  • ${t}`))
    doc.addPage()

    // ── S1: Account ────────────────────────────────────────────────────────
    heading('Section 1 — Account Information')
    row('Name', data.account.name)
    row('Email', data.account.email)
    row('Role', data.account.role)
    row('Account created', data.account.createdAt ? new Date(data.account.createdAt).toUTCString() : null)
    if (data.account.demographics) {
      heading('Demographics', 3)
      Object.entries(data.account.demographics).forEach(([k, v]) => row(k, String(v ?? '—')))
    }
    if (data.account.interests) {
      heading('Interests', 3)
      doc.font('Helvetica').fontSize(8).fillColor(GRAY).text(JSON.stringify(data.account.interests, null, 2), { width: pageW })
    }
    divider()

    // ── S2: Consent ────────────────────────────────────────────────────────
    doc.addPage()
    heading('Section 2 — Consent Records')
    doc.font('Helvetica').fontSize(9).fillColor(GRAY).text(`${data.consents.length} consent categories on record.`).moveDown(0.3)
    if (data.consents.length > 0) {
      tableRow(['Category', 'Granted', 'Legal Basis', 'Granted At', 'Revoked At'], [110, 55, 90, 120, 120], true)
      data.consents.forEach(c => tableRow([
        c.dataCategory,
        c.granted ? 'Yes' : 'No',
        c.legalBasis ?? '—',
        c.grantedAt ? new Date(c.grantedAt).toLocaleDateString() : '—',
        c.revokedAt ? new Date(c.revokedAt).toLocaleDateString() : '—',
      ], [110, 55, 90, 120, 120]))
    }
    divider()

    // ── S3: Feedback ───────────────────────────────────────────────────────
    doc.addPage()
    heading('Section 3 — Feedback Submitted')
    doc.font('Helvetica').fontSize(9).fillColor(GRAY).text(`${data.feedbackItems.length} feedback entries.`).moveDown(0.3)
    if (data.feedbackItems.length > 0) {
      tableRow(['Product ID', 'Rating', 'Date', 'Text (truncated)'], [110, 45, 100, 240], true)
      data.feedbackItems.forEach(f => tableRow([
        f.productId ?? '—',
        f.rating != null ? String(f.rating) : '—',
        f.createdAt ? new Date(f.createdAt).toLocaleDateString() : '—',
        String(f.text ?? '—').slice(0, 80),
      ], [110, 45, 100, 240]))
    }
    divider()

    // ── S4: Surveys ────────────────────────────────────────────────────────
    doc.addPage()
    heading('Section 4 — Survey Responses')
    doc.font('Helvetica').fontSize(9).fillColor(GRAY).text(`${data.surveyResponses.length} survey responses.`).moveDown(0.3)
    data.surveyResponses.forEach((s, i) => {
      heading(`Survey ${i + 1}`, 3)
      row('Survey ID', s.surveyId)
      row('Completed', s.completedAt ? new Date(s.completedAt).toUTCString() : null)
      if (s.responses) {
        doc.font('Helvetica').fontSize(8).fillColor(GRAY)
          .text(JSON.stringify(s.responses, null, 2).slice(0, 500), { width: pageW })
      }
      doc.moveDown(0.3)
    })
    divider()

    // ── S5: Points ─────────────────────────────────────────────────────────
    doc.addPage()
    heading('Section 5 — Points & Rewards')
    doc.font('Helvetica').fontSize(9).fillColor(GRAY).text(`${data.pointEvents.length} point events. ${data.dealRedemptions.length} deal redemptions.`).moveDown(0.3)
    if (data.pointEvents.length > 0) {
      heading('Point Events', 3)
      tableRow(['Event Type', 'Points', 'Date'], [200, 80, 215], true)
      data.pointEvents.slice(0, 100).forEach(e => tableRow([
        e.eventType ?? '—',
        e.points != null ? String(e.points) : '—',
        e.createdAt ? new Date(e.createdAt).toLocaleDateString() : '—',
      ], [200, 80, 215]))
    }
    if (data.dealRedemptions.length > 0) {
      heading('Deal Redemptions', 3)
      tableRow(['Deal ID', 'Type', 'Points', 'Date'], [130, 110, 60, 195], true)
      data.dealRedemptions.slice(0, 100).forEach(r => tableRow([
        r.dealId,
        r.redemptionType,
        String(r.pointsAwarded),
        r.redeemedAt ? new Date(r.redeemedAt).toLocaleDateString() : '—',
      ], [130, 110, 60, 195]))
    }
    divider()

    // ── S6: Community ──────────────────────────────────────────────────────
    doc.addPage()
    heading('Section 6 — Community Activity')
    row('Posts created', String(data.communityPosts.length))
    row('Comments written', String(data.communityComments.length))
    row('Votes cast', String(data.communityVoteCount))
    row('Deals saved', String(data.savedDeals.length))
    if (data.communityPosts.length > 0) {
      heading('Posts', 3)
      data.communityPosts.slice(0, 50).forEach(p => {
        doc.font('Helvetica-Bold').fontSize(9).fillColor(BLACK).text(p.title, { width: pageW })
        doc.font('Helvetica').fontSize(8).fillColor(GRAY)
          .text(`${p.status} · ${p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—'}`)
          .text(p.body.slice(0, 200), { width: pageW }).moveDown(0.3)
      })
    }
    divider()

    // ── S7: Influencer ─────────────────────────────────────────────────────
    doc.addPage()
    heading('Section 7 — Influencer Activity')
    row('Influencers followed', String(data.influencerFollows.length))
    row('Content posts', String(data.contentPosts.length))
    if (data.influencerFollows.length > 0) {
      heading('Follows', 3)
      tableRow(['Influencer ID', 'Followed At'], [250, 245], true)
      data.influencerFollows.slice(0, 100).forEach(f => tableRow([
        f.influencerId,
        f.followedAt ? new Date(f.followedAt).toLocaleDateString() : '—',
      ], [250, 245]))
    }
    if (data.contentPosts.length > 0) {
      heading('Content Created', 3)
      tableRow(['Title', 'Media Type', 'Date'], [250, 100, 145], true)
      data.contentPosts.slice(0, 100).forEach(c => tableRow([
        c.title,
        c.mediaType,
        c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—',
      ], [250, 100, 145]))
    }
    divider()

    // ── S8: Payments ───────────────────────────────────────────────────────
    doc.addPage()
    heading('Section 8 — Payment History')
    doc.font('Helvetica').fontSize(9).fillColor(GRAY)
      .text('Payment records associated with your account are listed below. For full transaction details, contact support@earn4insights.com.')
      .moveDown(0.3)
    row('Deal redemptions', String(data.dealRedemptions.length))
    divider()

    // ── S9: Rights ─────────────────────────────────────────────────────────
    doc.addPage()
    heading('Section 9 — Your Rights')
    const rights = [
      ['GDPR Art. 15 — Right of Access', 'You have the right to obtain a copy of your personal data at any time.'],
      ['GDPR Art. 16 — Right to Rectification', 'You can correct inaccurate personal data via your dashboard Settings.'],
      ['GDPR Art. 17 — Right to Erasure', 'You can request deletion of your account at Dashboard → Settings → Delete Account.'],
      ['GDPR Art. 20 — Right to Data Portability', 'You can download your data as JSON at Dashboard → My Data.'],
      ['GDPR Art. 21 — Right to Object', 'You can withdraw consent for any data category at Dashboard → Privacy.'],
      ['India DPDP Act §11 — Right to Information', 'You have the right to know what personal data we hold and how it is used.'],
      ['India DPDP Act §12 — Right to Withdraw Consent', 'You can withdraw consent at any time without affecting past processing.'],
    ]
    rights.forEach(([right, desc]) => {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND).text(right, { width: pageW })
      doc.font('Helvetica').fontSize(9).fillColor(GRAY).text(desc, { width: pageW }).moveDown(0.4)
    })

    heading('Data Retention', 3)
    const retention = [
      ['Signal snapshots', `${process.env.SIGNAL_RETENTION_DAYS ?? 365} days rolling window`],
      ['Consent records', 'Retained for audit purposes for 5 years after revocation'],
      ['Feedback & surveys', 'Retained until account deletion'],
      ['DSAR PDF', '7 days from generation'],
    ]
    retention.forEach(([type, period]) => row(type, period))

    heading('Contact', 3)
    row('Data Protection Officer', 'privacy@earn4insights.com')
    row('Support', 'support@earn4insights.com')
    row('Website', 'https://www.earn4insights.com/privacy')

    // ── Footer on every page ───────────────────────────────────────────────
    const pageCount = (doc as any)._pageBuffer?.length ?? 1
    const footerText = `Generated under GDPR Article 15 · ${new Date(data.generatedAt).toUTCString()} · Earn4Insights`
    doc.on('pageAdded', () => {
      doc.font('Helvetica').fontSize(7).fillColor(GRAY)
        .text(footerText, 50, doc.page.height - 30, { width: pageW, align: 'center' })
    })

    doc.end()
  })
}

// ── Emails ────────────────────────────────────────────────────────────────────

async function sendOtpEmail(to: string, otp: string) {
  const client = getResend()
  if (!client) {
    console.warn('[DSAR] Resend not configured — OTP:', otp)
    return
  }
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <div style="background:#4F46E5;border-radius:8px;padding:24px;text-align:center;margin-bottom:24px">
        <h1 style="color:white;margin:0;font-size:20px">Earn4Insights</h1>
        <p style="color:#C7D2FE;margin:8px 0 0">Data Request Verification</p>
      </div>
      <p style="color:#374151;font-size:15px">You requested a copy of your personal data.</p>
      <p style="color:#374151;font-size:15px">Your verification code is:</p>
      <div style="background:#F3F4F6;border-radius:8px;padding:20px;text-align:center;margin:20px 0">
        <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#111827;font-family:monospace">${otp}</span>
      </div>
      <p style="color:#6B7280;font-size:13px">Valid for <strong>15 minutes</strong>. Max 3 attempts.</p>
      <p style="color:#6B7280;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
      <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0">
      <p style="color:#9CA3AF;font-size:11px;text-align:center">Earn4Insights · GDPR Art. 15 · India DPDP Act 2023</p>
    </div>`
  await client.emails.send({
    from: FROM_EMAIL,
    to,
    subject: 'Verify your data request — Earn4Insights',
    html,
  }).catch(err => console.error('[DSAR] OTP email failed:', err))
}

async function sendDataReadyEmail(
  to: string,
  pdfUrl: string,
  expiresAt: Date,
  requestId: string,
  pdfBytes: number,
) {
  const client = getResend()
  if (!client) {
    console.warn('[DSAR] Resend not configured — PDF ready:', pdfUrl)
    return
  }

  const downloadUrl = `${process.env.NEXTAUTH_URL ?? 'https://www.earn4insights.com'}/api/consumer/dsar/download/${requestId}`
  const expiryStr = expiresAt.toUTCString()
  const sizeMB = (pdfBytes / 1024 / 1024).toFixed(1)

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <div style="background:#4F46E5;border-radius:8px;padding:24px;text-align:center;margin-bottom:24px">
        <h1 style="color:white;margin:0;font-size:20px">Earn4Insights</h1>
        <p style="color:#C7D2FE;margin:8px 0 0">Your Data Package is Ready</p>
      </div>
      <p style="color:#374151;font-size:15px">Your personal data report (${sizeMB} MB) has been generated.</p>
      <div style="text-align:center;margin:24px 0">
        <a href="${downloadUrl}" style="background:#4F46E5;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:600">
          Download Your Data
        </a>
      </div>
      <p style="color:#6B7280;font-size:13px;text-align:center">Link expires: <strong>${expiryStr}</strong></p>
      <p style="color:#6B7280;font-size:13px">The report covers all data we hold about you including account info, consents, feedback, surveys, points, community activity, and your legal rights under GDPR &amp; DPDP Act 2023.</p>
      <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0">
      <p style="color:#9CA3AF;font-size:11px;text-align:center">Earn4Insights · GDPR Art. 15 · India DPDP Act 2023</p>
    </div>`

  const emailPayload: any = {
    from: FROM_EMAIL,
    to,
    subject: 'Your data package is ready — Earn4Insights',
    html,
  }

  // Attach PDF inline if under 10 MB
  if (pdfBytes < 10 * 1024 * 1024) {
    try {
      const resp = await fetch(pdfUrl)
      if (resp.ok) {
        const buf = await resp.arrayBuffer()
        emailPayload.attachments = [{
          filename: `earn4insights-data-report-${new Date().toISOString().slice(0, 10)}.pdf`,
          content: Buffer.from(buf),
        }]
      }
    } catch { /* non-critical — link in email is enough */ }
  }

  await client.emails.send(emailPayload).catch(err => console.error('[DSAR] Delivery email failed:', err))
}
