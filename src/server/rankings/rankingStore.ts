import 'server-only'
import { promises as fs } from 'fs'
import path from 'path'
import type { WeeklyRanking } from '@/lib/types/ranking'
import type { ProductCategory } from '@/lib/categories'

const RANKINGS_DIR = path.join(process.cwd(), 'data', 'rankings')

/**
 * Ensure rankings directory exists
 */
async function ensureRankingsDir() {
  try {
    await fs.mkdir(RANKINGS_DIR, { recursive: true })
  } catch (error) {
    console.error('Failed to create rankings directory:', error)
  }
}

/**
 * Get week identifier (YYYY-WW format)
 * Week starts on Monday
 */
export function getWeekIdentifier(date: Date = new Date()): string {
  const year = date.getFullYear()
  const startOfYear = new Date(year, 0, 1)
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000))
  const week = Math.ceil((days + startOfYear.getDay() + 1) / 7)
  
  return `${year}-W${String(week).padStart(2, '0')}`
}

/**
 * Get Monday of current week
 */
export function getWeekStart(date: Date = new Date()): Date {
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
  const monday = new Date(date.setDate(diff))
  monday.setHours(0, 0, 0, 0)
  return monday
}

/**
 * Get Sunday of current week
 */
export function getWeekEnd(date: Date = new Date()): Date {
  const weekStart = getWeekStart(date)
  const sunday = new Date(weekStart)
  sunday.setDate(weekStart.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return sunday
}

/**
 * Get file path for ranking data
 */
function getRankingFilePath(weekId: string, category: ProductCategory): string {
  return path.join(RANKINGS_DIR, `${weekId}-${category}.json`)
}

/**
 * Save weekly ranking
 */
export async function saveWeeklyRanking(ranking: WeeklyRanking): Promise<void> {
  await ensureRankingsDir()
  
  const weekId = getWeekIdentifier(new Date(ranking.weekStart))
  const filePath = getRankingFilePath(weekId, ranking.category)
  
  await fs.writeFile(filePath, JSON.stringify(ranking, null, 2), 'utf-8')
}

/**
 * Get weekly ranking for specific week and category
 */
export async function getWeeklyRanking(
  weekId: string,
  category: ProductCategory
): Promise<WeeklyRanking | null> {
  try {
    const filePath = getRankingFilePath(weekId, category)
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content) as WeeklyRanking
  } catch (error) {
    return null
  }
}

/**
 * Get current week's ranking for a category
 */
export async function getCurrentRanking(
  category: ProductCategory
): Promise<WeeklyRanking | null> {
  const weekId = getWeekIdentifier()
  return getWeeklyRanking(weekId, category)
}

/**
 * Alias for getCurrentRanking (used by API)
 */
export const getCurrentWeeklyRanking = getCurrentRanking

/**
 * Get all rankings for a category (sorted by week, newest first)
 */
export async function getRankingHistory(
  category: ProductCategory,
  limit?: number
): Promise<WeeklyRanking[]> {
  try {
    await ensureRankingsDir()
    const files = await fs.readdir(RANKINGS_DIR)
    
    // Filter files for this category
    const categoryFiles = files.filter(f => 
      f.endsWith(`-${category}.json`)
    ).sort().reverse() // Newest first
    
    const limitedFiles = limit ? categoryFiles.slice(0, limit) : categoryFiles
    
    const rankings: WeeklyRanking[] = []
    for (const file of limitedFiles) {
      const content = await fs.readFile(path.join(RANKINGS_DIR, file), 'utf-8')
      rankings.push(JSON.parse(content))
    }
    
    return rankings
  } catch (error) {
    console.error('Failed to read ranking history:', error)
    return []
  }
}

/**
 * Alias for getRankingHistory (used by API)
 */
export const getHistoricalRankings = getRankingHistory

/**
 * Get all categories that have rankings for current week
 */
export async function getCategoriesWithRankings(weekId?: string): Promise<ProductCategory[]> {
  try {
    await ensureRankingsDir()
    const files = await fs.readdir(RANKINGS_DIR)
    const targetWeek = weekId || getWeekIdentifier()
    
    const categories = files
      .filter(f => f.startsWith(targetWeek))
      .map(f => {
        const parts = f.replace('.json', '').split('-')
        return parts[parts.length - 1] as ProductCategory
      })
    
    return [...new Set(categories)]
  } catch (error) {
    console.error('Failed to get categories:', error)
    return []
  }
}

/**
 * Get product's ranking history across all weeks
 */
export async function getProductRankingHistory(
  productId: string,
  category: ProductCategory
): Promise<Array<{
  weekStart: string
  rank: number | null
  score: number
  weekId: string
}>> {
  const history = await getRankingHistory(category)
  
  return history.map(week => {
    const entry = week.rankings.find(r => r.productId === productId)
    return {
      weekStart: week.weekStart,
      weekId: getWeekIdentifier(new Date(week.weekStart)),
      rank: entry?.rank || null,
      score: entry?.score || 0,
    }
  })
}

/**
 * Check if product was in last week's top 10
 */
export async function getPreviousRank(
  productId: string,
  category: ProductCategory
): Promise<number | null> {
  try {
    const now = new Date()
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const lastWeekId = getWeekIdentifier(lastWeek)
    
    const lastWeekRanking = await getWeeklyRanking(lastWeekId, category)
    if (!lastWeekRanking) return null
    
    const entry = lastWeekRanking.rankings.find(r => r.productId === productId)
    return entry?.rank || null
  } catch (error) {
    return null
  }
}

/**
 * Get all rankings across all categories for current week
 */
export async function getAllCurrentRankings(): Promise<WeeklyRanking[]> {
  const categories = await getCategoriesWithRankings()
  const rankings: WeeklyRanking[] = []
  
  for (const category of categories) {
    const ranking = await getCurrentRanking(category)
    if (ranking) {
      rankings.push(ranking)
    }
  }
  
  return rankings
}
