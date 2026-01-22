export type ProductStatus = 'draft' | 'launched'

export type ProductFeatures = {
  nps: boolean
  feedback: boolean
  social_listening: boolean
}

export type Product = {
  id: string
  name: string
  description?: string

  platform: 'web' | 'mobile' | 'saas'
  domain?: string

  status: ProductStatus
  features: ProductFeatures

  created_at: string
}
