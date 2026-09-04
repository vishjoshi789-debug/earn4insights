import type { Serialized } from './serialized'
import type { getAlertRules } from '@/server/brandAlertService'

/**
 * GET /api/brand/alert-rules → { rules }
 *
 * Derives from the repository result — category B, the common case.
 *
 * ⚠️ The settings page has TEN API call sites but only ONE response type. The
 * other calls are mutations (send-otp, verify-otp, disconnect, PATCH
 * notification-settings) whose responses the page does not model. Call-site
 * count is not a proxy for typing surface — worth remembering before sizing
 * this kind of work from a grep.
 *
 * Its sibling `AlertTypeConfig` in that page is deliberately NOT shared: it is
 * local UI config (label, description, `icon: React.ElementType`, colour), not
 * a payload. Sharing it would drag React types into the api-types directory
 * and imply a server contract that does not exist.
 */
export type AlertRuleResponse = Serialized<
  Awaited<ReturnType<typeof getAlertRules>>[number]
>
