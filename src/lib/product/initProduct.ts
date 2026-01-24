export function initializeProductData(productId: string) {
  ;(globalThis as any).__nps ??= []
  ;(globalThis as any).__feedback ??= []
  ;(globalThis as any).__social ??= []

  ;(globalThis as any).__nps.push({
    product_id: productId,
    type: 'nps',
    active: true,
  })

  ;(globalThis as any).__feedback.push({
    product_id: productId,
    prompt: 'Tell us more about your experience',
    active: true,
  })

  ;(globalThis as any).__social.push({
    product_id: productId,
    sources: [],
    active: true,
  })
}
