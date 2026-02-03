/**
 * Safe Aggregation Utilities for Privacy-Preserving Analytics
 * Implements k-anonymity to prevent re-identification of individuals
 */

/**
 * Minimum group size for k-anonymity protection
 * Groups smaller than this will be suppressed to prevent re-identification
 */
export const MINIMUM_SEGMENT_SIZE = 5

/**
 * Aggregates data by key while enforcing k-anonymity
 * Groups with fewer than MINIMUM_SEGMENT_SIZE members are filtered out
 * 
 * @param data - Array of items to aggregate
 * @param keyExtractor - Function to extract the grouping key from each item
 * @param aggregator - Function to compute aggregate values for each group
 * @returns Object mapping keys to aggregated values (only for groups >= minimum size)
 * 
 * @example
 * const ageGroups = safeAggregate(
 *   users,
 *   user => user.ageRange,
 *   group => ({ count: group.length, avgScore: average(group.map(u => u.score)) })
 * )
 */
export function safeAggregate<T, K extends string | number, V>(
  data: T[],
  keyExtractor: (item: T) => K | null | undefined,
  aggregator: (group: T[]) => V
): Record<K, V & { count: number; suppressed?: boolean }> {
  // Group by key
  const groups = data.reduce((acc, item) => {
    const key = keyExtractor(item)
    if (key === null || key === undefined) return acc
    
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(item)
    return acc
  }, {} as Record<K, T[]>)

  // Filter out small groups and aggregate
  const result = {} as Record<K, V & { count: number; suppressed?: boolean }>
  
  for (const [key, group] of Object.entries(groups) as [K, T[]][]) {
    if (group.length >= MINIMUM_SEGMENT_SIZE) {
      const aggregated = aggregator(group)
      result[key] = {
        ...aggregated,
        count: group.length
      }
    }
    // Small groups are suppressed (not included in result)
  }

  return result
}

/**
 * Counts number of suppressed segments (below minimum threshold)
 * Useful for displaying privacy protection metrics to users
 */
export function countSuppressedSegments<T, K extends string | number>(
  data: T[],
  keyExtractor: (item: T) => K | null | undefined
): number {
  const groups = data.reduce((acc, item) => {
    const key = keyExtractor(item)
    if (key === null || key === undefined) return acc
    
    if (!acc[key]) {
      acc[key] = 0
    }
    acc[key]++
    return acc
  }, {} as Record<K, number>)

  return (Object.values(groups) as number[]).filter(count => count < MINIMUM_SEGMENT_SIZE).length
}

/**
 * Filters an already-aggregated object to remove small segments
 * Use when you have pre-aggregated data with counts
 */
export function filterSmallSegments<T extends { count: number }>(
  aggregated: Record<string, T>
): Record<string, T> {
  const filtered = {} as Record<string, T>
  
  for (const [key, value] of Object.entries(aggregated)) {
    if (value.count >= MINIMUM_SEGMENT_SIZE) {
      filtered[key] = value
    }
  }
  
  return filtered
}

/**
 * Gets a privacy-safe note about suppressed data
 */
export function getPrivacyNote(suppressedCount: number): string {
  if (suppressedCount === 0) {
    return ''
  }
  
  return `${suppressedCount} segment${suppressedCount > 1 ? 's' : ''} with fewer than ${MINIMUM_SEGMENT_SIZE} users hidden for privacy protection`
}
