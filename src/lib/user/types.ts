export type UserRole = 'brand' | 'consumer'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  
  // Authentication
  passwordHash?: string              // Only for email/password users
  googleId?: string                  // Only for Google OAuth users
  
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
  role: UserRole
  acceptedTerms: boolean
  acceptedPrivacy: boolean
}
