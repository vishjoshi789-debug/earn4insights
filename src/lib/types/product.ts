export type ProductProfile = {
  currentStep: number
  isComplete: boolean
  data: {
    // STEP 1: Product Type
    productType?: string
    
    // STEP 2: Target Audience
    audienceType?: string
    targetDescription?: string
    
    // STEP 3: Feedback Channels
    feedbackChannels?: string[]
    
    // STEP 4: Primary Goal
    primaryGoal?: string
    
    // STEP 5: Visual Identity
    branding?: {
      logo?: {
        url: string
        filename: string
        size: number
      }
      productImages?: Array<{
        url: string
        filename: string
        alt?: string
      }>
      primaryColor?: string // hex color
    }
    
    // STEP 6: Product Details
    productDetails?: {
      website?: string
      tagline?: string
      description?: string
      keyFeatures?: string[]
    }
    
    // STEP 7: Maturity & Context
    context?: {
      productStage?: 'pre-launch' | 'recently-launched' | 'growth' | 'established'
      userBase?: 'under-100' | '100-1k' | '1k-10k' | '10k-100k' | '100k-plus'
      testimonials?: Array<{
        quote: string
        author: string
        role?: string
        company?: string
      }>
      socialMedia?: {
        twitter?: string
        linkedin?: string
      }
    }
  }
}

export type Product = {
  id: string
  name: string
  description?: string
  platform?: string
  created_at?: string
  
  features: {
    nps: boolean
    feedback: boolean
    social_listening: boolean
  }
  
  profile: ProductProfile
}