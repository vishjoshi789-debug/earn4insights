/**
 * User role — the user's primary view / default dashboard.
 *
 * 'admin' is intentionally not self-assignable at signup (enforced by
 * src/lib/auth/signupIntent.ts ALLOWED_SIGNUP_ROLES) — it's runtime-only,
 * granted by an existing admin via SQL. Listed here so role-check
 * narrowings throughout the codebase type-check.
 *
 * For "can this user access feature X" cross-cutting checks (e.g. a
 * consumer who has also registered as an influencer), use the boolean
 * flags on the users table: isBrand, isConsumer, isInfluencer. Existing
 * `role === 'X'` checks for primary-view decisions still work.
 */
export type UserRole = 'brand' | 'consumer' | 'influencer' | 'admin'

/** Roles a user can self-select on the /signup page. Admin is excluded. */
export type SignupRole = 'brand' | 'consumer' | 'influencer'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole

  // Multi-role capability flags (migration 022, Phase 3.5A). At least
  // one is true for non-admin users (matches users.role on signup, can
  // be expanded later — e.g. consumer who becomes an influencer keeps
  // both = true).
  isBrand?: boolean
  isConsumer?: boolean
  isInfluencer?: boolean

  // Authentication
  passwordHash?: string              // Only for email/password users
  googleId?: string                  // Only for Google OAuth users

  // Security
  twoFactorEnabled?: boolean         // TOTP 2FA active (migration 019)
  
  // Consent (required)
  consent: {
    termsAcceptedAt: string          // ISO timestamp
    privacyAcceptedAt: string        // ISO timestamp
  }
  
  // Metadata
  createdAt: string
  updatedAt: string
  
  // Future extensibility
  preferences?: {
    emailNotifications?: boolean
    whatsappNotifications?: boolean
  }
  
  // Brand-specific (optional)
  brandProfile?: {
    companyName?: string
    productsManaged?: string[]       // Product IDs
  }
  
  // Consumer-specific (optional)
  consumerProfile?: {
    surveysCompleted?: number
    lastActiveAt?: string
  }
}

export interface CreateUserInput {
  email: string
  password?: string                  // Required for email signup
  googleId?: string                  // Required for Google signup
  name: string
  // Self-assigned at signup — admin is excluded by SignupRole.
  role: SignupRole
  acceptedTerms: boolean
  acceptedPrivacy: boolean
}
