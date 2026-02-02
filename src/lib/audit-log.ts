/**
 * Audit Logging Utility
 * 
 * GDPR Compliance: Log all access to sensitive personal data
 * Security: Track who accessed what data, when, and why
 */

import { db } from '@/db'
import { auditLog } from '@/db/schema'

interface AuditLogEntry {
  userId: string
  action: 'read' | 'write' | 'delete' | 'export'
  dataType: 'sensitiveData' | 'profile' | 'events' | 'responses' | 'feedback' | 'notifications' | 'all'
  accessedBy: string // userId, 'system', 'cron', or 'admin'
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, any>
  reason?: string
}

/**
 * Log a data access event
 * 
 * @param entry - Audit log entry details
 * @returns Promise<void>
 */
export async function logDataAccess(entry: AuditLogEntry): Promise<void> {
  try {
    await db.insert(auditLog).values({
      userId: entry.userId,
      action: entry.action,
      dataType: entry.dataType,
      accessedBy: entry.accessedBy,
      ipAddress: entry.ipAddress || null,
      userAgent: entry.userAgent || null,
      metadata: entry.metadata || {},
      reason: entry.reason || null,
    })

    // Log to console for debugging (remove in production if too verbose)
    console.log(`[AUDIT] ${entry.action.toUpperCase()} ${entry.dataType} for user ${entry.userId} by ${entry.accessedBy}`)
  } catch (error) {
    // Don't throw - we don't want audit logging failures to break the app
    console.error('[AUDIT] Failed to log data access:', error)
  }
}

/**
 * Log sensitive data access specifically
 * 
 * @param userId - User whose sensitive data was accessed
 * @param accessedBy - Who accessed it
 * @param reason - Why it was accessed
 * @param metadata - Additional context
 */
export async function logSensitiveDataAccess(
  userId: string,
  accessedBy: string,
  reason: string,
  metadata?: Record<string, any>
): Promise<void> {
  await logDataAccess({
    userId,
    action: 'read',
    dataType: 'sensitiveData',
    accessedBy,
    reason,
    metadata,
  })
}

/**
 * Log data export event (GDPR Article 20)
 * 
 * @param userId - User requesting export
 * @param ipAddress - IP address of request
 * @param userAgent - User agent string
 */
export async function logDataExport(
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logDataAccess({
    userId,
    action: 'export',
    dataType: 'all',
    accessedBy: userId,
    ipAddress,
    userAgent,
    reason: 'User requested data export (GDPR Article 20)',
    metadata: {
      gdprCompliance: true,
      exportFormat: 'JSON',
    },
  })
}

/**
 * Log account deletion event (GDPR Article 17)
 * 
 * @param userId - User requesting deletion
 * @param ipAddress - IP address of request
 * @param userAgent - User agent string
 * @param deletionReason - User's reason for deletion
 */
export async function logAccountDeletion(
  userId: string,
  ipAddress?: string,
  userAgent?: string,
  deletionReason?: string
): Promise<void> {
  await logDataAccess({
    userId,
    action: 'delete',
    dataType: 'all',
    accessedBy: userId,
    ipAddress,
    userAgent,
    reason: 'User requested account deletion (GDPR Article 17)',
    metadata: {
      gdprCompliance: true,
      deletionReason,
      gracePeriodDays: 30,
    },
  })
}

/**
 * Get audit log for a specific user
 * 
 * @param userId - User ID to get logs for
 * @param limit - Maximum number of logs to return
 * @returns Promise<AuditLog[]>
 */
export async function getUserAuditLog(userId: string, limit = 100) {
  const { eq, desc } = await import('drizzle-orm')
  
  return await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.userId, userId))
    .orderBy(desc(auditLog.timestamp))
    .limit(limit)
}

/**
 * Get recent sensitive data access logs
 * 
 * @param limit - Maximum number of logs to return
 * @returns Promise<AuditLog[]>
 */
export async function getRecentSensitiveDataAccess(limit = 50) {
  const { eq, desc } = await import('drizzle-orm')
  
  return await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.dataType, 'sensitiveData'))
    .orderBy(desc(auditLog.timestamp))
    .limit(limit)
}
