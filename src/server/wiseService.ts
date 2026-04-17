/**
 * Wise (TransferWise) Service — STUB
 *
 * Foundation for future Wise Business API integration.
 * Currently all international payouts are processed manually by admin.
 *
 * TODO: Implement Wise Business API when ready:
 *   1. Create quote: POST /v3/profiles/{profileId}/quotes
 *   2. Create recipient: POST /v1/accounts
 *   3. Create transfer: POST /v1/transfers
 *   4. Fund transfer: POST /v3/profiles/{profileId}/transfers/{transferId}/payments
 *   5. Get transfer status: GET /v1/transfers/{transferId}
 *
 * Environment variables needed:
 *   WISE_API_KEY     — Wise Business API token
 *   WISE_PROFILE_ID  — Wise business profile ID
 *
 * Wise API docs: https://docs.wise.com/api-docs
 */

import 'server-only'

// TODO: Uncomment when Wise Business API is ready
// const WISE_API_BASE = 'https://api.wise.com'
// const WISE_SANDBOX_BASE = 'https://api.sandbox.transferwise.tech'

export interface WiseTransferParams {
  recipientId: string
  recipientEmail: string
  amount: number         // major currency unit (e.g. 100.00 USD)
  currency: string       // target currency (e.g. 'USD')
  sourceCurrency?: string // source currency (defaults to 'INR')
  reference?: string     // payment reference
}

export interface WiseTransferResult {
  status: 'manual_required' | 'created' | 'processing' | 'completed' | 'failed'
  transferId?: string
  message: string
}

/**
 * Create a Wise transfer — STUB.
 *
 * Currently logs intent and returns manual_required status.
 * Admin must process this transfer manually via Wise dashboard.
 *
 * TODO: Implement actual Wise Business API call:
 *   1. Create quote with amount + currencies
 *   2. Create or reuse recipient account
 *   3. Create transfer with quote + recipient
 *   4. Fund the transfer
 */
export async function createTransfer(
  params: WiseTransferParams
): Promise<WiseTransferResult> {
  console.log('[WiseService] Transfer stub called:', {
    recipientId: params.recipientId,
    amount: params.amount,
    currency: params.currency,
    reference: params.reference,
    // Never log recipientEmail in production
  })

  // TODO: Replace with actual Wise API call
  return {
    status: 'manual_required',
    message: `Manual Wise transfer required: ${params.amount} ${params.currency} to ${params.recipientId}. Process via Wise dashboard.`,
  }
}

/**
 * Get transfer status — STUB.
 *
 * TODO: Implement GET /v1/transfers/{transferId} when Wise API is ready.
 */
export async function getTransferStatus(
  transferId: string
): Promise<{ status: string; message: string }> {
  console.log('[WiseService] Status check stub called for:', transferId)

  // TODO: Replace with actual Wise API call
  return {
    status: 'unknown',
    message: `Wise transfer status check not implemented. Check Wise dashboard for transfer ${transferId}.`,
  }
}
