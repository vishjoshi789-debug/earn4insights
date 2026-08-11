'use server'

import 'server-only'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import {
  getAllSurveys,
  getSurveyById,
  getSurveysByProductId,
  createSurvey as createSurveyInDB,
  updateSurvey as updateSurveyInDB,
  deleteSurvey as deleteSurveyFromDB,
} from '@/db/repositories/surveyRepository'
import type { Survey, SurveyQuestion, SurveyType, SurveySettings } from '@/lib/survey-types'
import { createNPSSurvey, createCSATSurvey } from '@/lib/survey-types'
import { notifyNewSurvey } from '@/server/campaigns/surveyNotificationCampaign'
import { findIdealConsumers } from '@/lib/personalization/smartDistributionService'
import { dispatchToUsers } from '@/server/realtimeNotificationService'
import { auth } from '@/lib/auth/auth.config'
import { isAdminSession } from '@/lib/auth/roles'
import { getProductById } from '@/db/repositories/productRepository'

/**
 * ⚠️ EVERY EXPORT IN THIS FILE IS A DIRECTLY-INVOKABLE ENDPOINT.
 *
 * `'use server'` exports are not just their button's callback — they can be
 * POSTed to by anyone who knows the action id. Until 2026-08-10 none of the
 * mutating actions here checked anything, so any logged-in user could pause,
 * rewrite the questions of, or **delete** any brand's survey by id. Same
 * class as the `exportResponsesToCSV` hole closed in `61b31af`.
 *
 * The gate below is the first statement of every mutating action, raising ONE
 * generic error for every failure mode so survey ids can't be probed.
 */

/** Generic on purpose — never reveals whether the id exists. */
const DENIED = 'Survey not found or you do not have permission to modify it'

/**
 * Resolve survey → product → owner and confirm the caller owns it.
 * Admins bypass, per the platform-wide policy in `lib/auth/roles.ts`.
 *
 * FAILS CLOSED on a null `owner_id` — `products.owner_id` is nullable by
 * design (schema.ts:72, unclaimed placeholders), so `ownerId && ownerId !==`
 * would grant every unclaimed product to everyone.
 */
async function assertSurveyOwnedByCaller(surveyId: string): Promise<Survey> {
  const session = await auth()
  if (!session?.user?.id) throw new Error(DENIED)

  const survey = await getSurveyById(surveyId)
  if (!survey?.productId) throw new Error(DENIED)

  if (isAdminSession(session)) return survey

  const product = await getProductById(survey.productId)
  if (!product?.ownerId || product.ownerId !== session.user.id) throw new Error(DENIED)

  return survey
}

/** Same check for actions keyed on a product rather than a survey. */
async function assertProductOwnedByCaller(productId: string): Promise<void> {
  const session = await auth()
  if (!session?.user?.id) throw new Error(DENIED)
  if (isAdminSession(session)) return

  const product = await getProductById(productId)
  if (!product?.ownerId || product.ownerId !== session.user.id) throw new Error(DENIED)
}

export async function fetchAllSurveys() {
  return await getAllSurveys()
}

export async function fetchSurvey(surveyId: string) {
  return await getSurveyById(surveyId)
}

export async function fetchProductSurveys(productId: string) {
  return await getSurveysByProductId(productId)
}

export async function createSurvey(
  productId: string,
  title: string,
  description: string | undefined,
  type: SurveyType,
  questions: SurveyQuestion[],
  settings?: SurveySettings
) {
  // Validation
  if (!productId || !title.trim()) {
    throw new Error('Product ID and title are required')
  }

  // Creating a survey on a product fans out email + bell to real consumers.
  // Unauthenticated, that was a spam primitive pointed at our own users.
  await assertProductOwnedByCaller(productId)

  if (type === 'custom' && questions.length === 0) {
    throw new Error('Custom surveys must have at least one question')
  }

  // Generate survey based on type
  let surveyData: Omit<Survey, 'id' | 'createdAt'>

  if (type === 'nps') {
    surveyData = createNPSSurvey(productId, title, description)
  } else if (type === 'csat') {
    surveyData = createCSATSurvey(productId, title, description)
  } else {
    // Custom survey
    surveyData = {
      productId,
      title,
      description,
      type: 'custom',
      isActive: true,
      questions,
    }
  }

  const survey: Survey = {
    ...surveyData,
    id: randomUUID(),
    // Surveys go live immediately on create. The schema column defaults to
    // 'draft' and there is no separate publish step in the UI, so without
    // this every survey was born inactive (badge "Inactive" + the consumer
    // "responses are for testing only" banner) even though we fan out the
    // bell + email "complete it to earn points" notifications below.
    status: 'active',
    isActive: true,
    createdAt: new Date().toISOString(),
    settings: {
      // Phase 0 flags: default off unless explicitly enabled
      allowAudio: Boolean(settings?.allowAudio),
      allowVideo: Boolean(settings?.allowVideo),
      ...(settings || {}),
    },
  }

  await createSurveyInDB(survey)

  // Non-blocking: resolve the target audience ONCE (keyed on productId, which is
  // NOT NULL + create-validated + FK-enforced), then fan out to BOTH channels from
  // that single result — no second resolve. Empty list → both no-op, no error.
  // brandId/ownerId is never referenced here (it's nullable), so no null-throw path.
  ;(async () => {
    const recipients = await findIdealConsumers(survey.productId, 50)
    const targetUserIds = recipients.map((r) => r.userId)

    // EMAIL — feed the resolved list as targetUserIds. Previously this fired with
    // no list and early-returned to ZERO recipients; now it actually sends.
    notifyNewSurvey(survey.id, { targetUserIds }).catch((err) =>
      console.error('[createSurvey] notifyNewSurvey error:', err),
    )

    // IN-APP BELL (+ Pusher) — same audience, same single resolve.
    dispatchToUsers(
      recipients.map((r) => ({ userId: r.userId, role: 'consumer' as const })),
      {
        eventType: 'survey_available',
        title: `New survey: ${survey.title}`,
        body: 'A new survey is waiting for you. Complete it to earn points.',
        ctaUrl: `/survey/${survey.id}`, // singular — the only real survey route
        type: 'survey_available',
        entityType: 'survey',
        entityId: survey.id,
        metadata: { productId: survey.productId },
      },
    ).catch((err) => console.error('[createSurvey] bell dispatch error:', err))
  })().catch((err) => console.error('[createSurvey] survey notify error:', err))

  // Revalidate the surveys page
  revalidatePath('/dashboard/surveys')
  revalidatePath(`/dashboard/products/${productId}`)

  return survey
}

/**
 * Set a survey's lifecycle status. The brand's only way to STOP a running
 * survey.
 *
 * ── Why this replaced `toggleSurveyActive(id, isActive: boolean)` ─────────
 * `status` is the source of truth: the repository's insert and update persist
 * ONLY `status`, and `toSurvey` derives `isActive = (status === 'active')`.
 * A boolean parameter therefore had to be translated into a status anyway,
 * and it could not express `closed` at all. Taking the status directly means
 * the writable surface and the stored value are the same thing — which is the
 * `isActive` ↔ `status` reconciliation.
 *
 * `isActive` remains on the `Survey` type as a DERIVED, read-only convenience
 * for rendering. Nothing persists it. Do not add a write path for it.
 *
 * Surveys are live-on-create (see `createSurvey`), so without this control a
 * brand who published with a mistake had no recourse: the bell + email fan-out
 * has already reached real consumers' inboxes and there was no way to stop
 * further responses.
 */
export type SurveyLifecycleStatus = 'active' | 'paused' | 'closed'

export async function setSurveyStatus(
  surveyId: string,
  status: SurveyLifecycleStatus
) {
  await assertSurveyOwnedByCaller(surveyId)

  const survey = await updateSurveyInDB(surveyId, { status })

  if (survey) {
    revalidatePath('/dashboard/surveys')
    revalidatePath(`/dashboard/surveys/${surveyId}`)
    revalidatePath(`/survey/${surveyId}`)
    revalidatePath(`/dashboard/products/${survey.productId}`)
  }

  return survey
}

export async function updateSurveyQuestions(
  surveyId: string,
  questions: SurveyQuestion[]
) {
  // FIRST statement — this rewrites the questions consumers are answering.
  await assertSurveyOwnedByCaller(surveyId)

  if (!surveyId) throw new Error('Survey ID is required')
  if (questions.length === 0) throw new Error('At least one question is required')

  // Validate each question
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    if (!q.question.trim()) throw new Error(`Question ${i + 1} text is required`)
    if (q.type === 'multiple-choice') {
      if (!q.options || q.options.length < 2) {
        throw new Error(`Question ${i + 1} must have at least 2 options`)
      }
      if (q.options.some(opt => !opt.trim())) {
        throw new Error(`All options in question ${i + 1} must have text`)
      }
    }
  }

  const survey = await updateSurveyInDB(surveyId, { questions })
  if (!survey) throw new Error('Survey not found')

  revalidatePath('/dashboard/surveys')
  revalidatePath(`/dashboard/surveys/${surveyId}`)
  revalidatePath(`/survey/${surveyId}`)

  return survey
}

export async function deleteSurvey(surveyId: string) {
  // FIRST statement. Unauthenticated, this let anyone destroy any brand's
  // survey — and its responses — by id.
  const survey = await assertSurveyOwnedByCaller(surveyId)

  const success = await deleteSurveyFromDB(surveyId)
  revalidatePath('/dashboard/surveys')
  revalidatePath(`/dashboard/products/${survey.productId}`)

  return success
}
