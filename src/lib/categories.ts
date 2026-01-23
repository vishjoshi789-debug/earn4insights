/**
 * Product Categories for Ranking System
 * 
 * Each product belongs to ONE primary category.
 * Categories are explicit, not inferred.
 */

export const PRODUCT_CATEGORIES = {
  TECH_SAAS: 'SaaS & Productivity',
  FINTECH: 'Finance & Payments',
  ECOMMERCE: 'E-Commerce & Retail',
  HEALTH: 'Health & Wellness',
  EDUCATION: 'Education & Learning',
  FOOD: 'Food & Beverage',
  CONSUMER_ELECTRONICS: 'Consumer Electronics',
  GAMING: 'Gaming & Entertainment',
  SOCIAL: 'Social & Communication',
  MARKETPLACE: 'Marketplace & Platform',
  DEVELOPER_TOOLS: 'Developer Tools',
  OTHER: 'Other',
} as const

export type ProductCategory = keyof typeof PRODUCT_CATEGORIES

export const CATEGORY_KEYS = Object.keys(PRODUCT_CATEGORIES) as ProductCategory[]
export const CATEGORY_VALUES = Object.values(PRODUCT_CATEGORIES)

/**
 * Get category display name from key
 */
export function getCategoryName(key: ProductCategory): string {
  return PRODUCT_CATEGORIES[key]
}

/**
 * Get category key from display name
 */
export function getCategoryKey(name: string): ProductCategory | undefined {
  const entry = Object.entries(PRODUCT_CATEGORIES).find(([_, value]) => value === name)
  return entry ? (entry[0] as ProductCategory) : undefined
}

/**
 * Category descriptions for user guidance
 */
export const CATEGORY_DESCRIPTIONS: Record<ProductCategory, string> = {
  TECH_SAAS: 'Software as a Service, cloud tools, productivity apps, business software',
  FINTECH: 'Banking, payments, cryptocurrency, financial services, investing platforms',
  ECOMMERCE: 'Online stores, retail platforms, shopping apps, marketplace sellers',
  HEALTH: 'Healthcare, fitness, mental wellness, nutrition, medical devices',
  EDUCATION: 'Learning platforms, courses, educational apps, tutoring services',
  FOOD: 'Restaurants, food delivery, meal kits, beverages, food products',
  CONSUMER_ELECTRONICS: 'Smartphones, laptops, wearables, smart home devices, gadgets',
  GAMING: 'Video games, game streaming, esports, entertainment platforms',
  SOCIAL: 'Social networks, messaging apps, communities, communication tools',
  MARKETPLACE: 'Multi-vendor platforms, peer-to-peer marketplaces, gig economy',
  DEVELOPER_TOOLS: 'APIs, frameworks, IDEs, development platforms, DevOps tools',
  OTHER: 'Products that don\'t fit other categories',
}

/**
 * Category icons (emoji for simplicity, can be replaced with proper icons)
 */
export const CATEGORY_ICONS: Record<ProductCategory, string> = {
  TECH_SAAS: '💼',
  FINTECH: '💰',
  ECOMMERCE: '🛒',
  HEALTH: '🏥',
  EDUCATION: '📚',
  FOOD: '🍔',
  CONSUMER_ELECTRONICS: '📱',
  GAMING: '🎮',
  SOCIAL: '💬',
  MARKETPLACE: '🏪',
  DEVELOPER_TOOLS: '⚙️',
  OTHER: '📦',
}
