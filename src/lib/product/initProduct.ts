export function initializeProductData(productId: string) {
  globalThis.__nps ??= []
  globalThis.__feedback ??= []
  globalThis.__social ??= []

  globalThis.__nps.push({
    product_id: productId,
    type: 'nps',
    active: true
  })

  globalThis.__feedback.push({
    product_id: productId,
    prompt: 'Tell us more about your experience',
    active: true
  })

  globalThis.__social.push({
    product_id: productId,
    sources: [],
    active: true
  })
}
