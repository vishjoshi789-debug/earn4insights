import { z } from 'zod'

/**
 * Brand onboarding validation schemas — one Zod schema per wizard step
 * so the client can validate partial saves and the server can re-validate
 * with the same shape.
 *
 * Industry list is intentionally bounded to ~15 common options so
 * downstream analytics / segmentation can group brands without
 * free-text drift.
 */

export const INDUSTRY_OPTIONS = [
  'fashion-apparel',
  'beauty-personal-care',
  'food-beverage',
  'electronics-tech',
  'home-furniture',
  'health-wellness',
  'sports-fitness',
  'baby-kids',
  'pet-supplies',
  'automotive',
  'travel-hospitality',
  'finance-fintech',
  'education',
  'saas-b2b',
  'other',
] as const

export const COMPANY_SIZE_OPTIONS = ['1-10', '11-50', '51-200', '200+'] as const

/**
 * Indian GST identifier format:
 *   2 digit state code + 10 character PAN + 1 entity char + 'Z' + 1 checksum
 *   Example: 27ABCDE1234F1Z5
 * Optional during onboarding — only validated when a value is provided.
 */
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

/**
 * Phone regex — permissive on purpose. We accept E.164-ish (+91...) and
 * common Indian formats. Stricter validation happens at WhatsApp OTP time.
 */
const PHONE_PATTERN = /^[+]?[0-9\s\-().]{7,20}$/

const httpsUrlSchema = z
  .string()
  .trim()
  .url('Must be a valid URL (e.g. https://example.com)')
  .max(200, 'URL too long')
  .optional()
  .or(z.literal(''))

// ── Step 2: Company basics ──────────────────────────────────────
export const companyBasicsSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(2, 'Company name must be at least 2 characters')
    .max(100, 'Company name must be 100 characters or fewer'),
  industry: z.enum(INDUSTRY_OPTIONS, {
    errorMap: () => ({ message: 'Pick an industry' }),
  }),
  companySize: z.enum(COMPANY_SIZE_OPTIONS).optional().or(z.literal('')),
  website: httpsUrlSchema,
  description: z
    .string()
    .trim()
    .max(500, 'Keep it under 500 characters')
    .optional()
    .or(z.literal('')),
})

// ── Step 3: Primary contact ─────────────────────────────────────
export const primaryContactSchema = z.object({
  primaryContactName: z
    .string()
    .trim()
    .max(100, 'Name must be 100 characters or fewer')
    .optional()
    .or(z.literal('')),
  primaryContactRole: z
    .string()
    .trim()
    .max(100, 'Role must be 100 characters or fewer')
    .optional()
    .or(z.literal('')),
  primaryContactPhone: z
    .string()
    .trim()
    .regex(PHONE_PATTERN, 'Phone number looks invalid')
    .optional()
    .or(z.literal('')),
})

// ── Step 4: Billing (all optional) ──────────────────────────────
export const billingSchema = z.object({
  billingEntity: z
    .string()
    .trim()
    .max(200, 'Billing entity must be 200 characters or fewer')
    .optional()
    .or(z.literal('')),
  billingAddress: z
    .object({
      street: z.string().trim().max(200).optional().or(z.literal('')),
      city: z.string().trim().max(100).optional().or(z.literal('')),
      state: z.string().trim().max(100).optional().or(z.literal('')),
      postalCode: z.string().trim().max(20).optional().or(z.literal('')),
      country: z.string().trim().max(100).optional().or(z.literal('')),
    })
    .optional()
    .nullable(),
  billingGstin: z
    .string()
    .trim()
    .regex(GSTIN_PATTERN, 'GSTIN format invalid (e.g. 27ABCDE1234F1Z5)')
    .optional()
    .or(z.literal('')),
})

// ── Step 5: Brand assets + audience targeting ───────────────────
export const brandAssetsSchema = z.object({
  brandLogoUrl: z
    .string()
    .trim()
    .url('Logo URL must be a valid URL')
    .max(500)
    .optional()
    .or(z.literal('')),
  targetAudience: z
    .object({
      categories: z.array(z.string().trim().max(50)).max(20).optional(),
      regions: z.array(z.string().trim().max(50)).max(30).optional(),
    })
    .optional()
    .nullable(),
})

// ── Combined: full wizard payload (used by completeBrandOnboarding) ──
//
// Re-validates at final step. companyBasicsSchema fields are required
// (companyName + industry); everything else may still be missing if the
// brand skipped optional sections. The wizard UI enforces step 2 ahead
// of completion, so a missing companyName at this point is an error
// the brand can't reach through normal flow — it gets a 400.
export const completeBrandOnboardingSchema = companyBasicsSchema
  .merge(primaryContactSchema)
  .merge(billingSchema)
  .merge(brandAssetsSchema)

export type CompanyBasicsInput = z.infer<typeof companyBasicsSchema>
export type PrimaryContactInput = z.infer<typeof primaryContactSchema>
export type BillingInput = z.infer<typeof billingSchema>
export type BrandAssetsInput = z.infer<typeof brandAssetsSchema>
export type CompleteBrandOnboardingInput = z.infer<typeof completeBrandOnboardingSchema>
