'use client'

/**
 * Shared payout-account form.
 *
 * ⚠️ EXTRACTED FROM /dashboard/influencer/payouts, WHERE IT WAS THE ONLY COPY.
 * That page sits behind an influencer-only layout guard, so the form — and
 * therefore the ability to add a payout account at all — was unreachable to
 * pure consumers. Meanwhile /dashboard/payouts happily accepted cash-out
 * requests and deducted their points, leaving them owed money with no way to
 * receive it. A real consumer is sitting in that gap right now.
 *
 * The API (/api/payouts/accounts) always accepted consumers — its own docstring
 * says "any authenticated role" and it writes userRole 'influencer' | 'consumer'.
 * The gap was purely that no consumer-reachable page rendered this form.
 *
 * Extracted rather than copied: a second hand-written copy is how two versions
 * quietly diverge, and this one holds encryption-sensitive fields (account
 * number, IBAN) whose "stored encrypted, last 4 only" promise must stay
 * identical everywhere it is made.
 */

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { getSupportedCurrencies } from '@/lib/currency'

export type AccountType = 'bank_account' | 'upi' | 'paypal' | 'wise' | 'swift'

export const COUNTRIES = [
  'United States', 'United Kingdom', 'European Union', 'United Arab Emirates',
  'Singapore', 'Australia', 'Canada', 'Japan', 'Brazil', 'Germany',
  'France', 'Netherlands', 'Other',
]

export const EMPTY_FORM = {
  accountType: '' as AccountType | '',
  currency: 'INR',
  isPrimary: false,
  // bank
  accountHolderName: '',
  accountNumber: '',
  ifscCode: '',
  // upi
  upiId: '',
  // paypal
  paypalEmail: '',
  // wise
  wiseEmail: '',
  // swift
  swiftCode: '',
  iban: '',
  bankName: '',
  bankCountry: '',
}

export type PayoutAccountForm = typeof EMPTY_FORM

export function AddAccountForm({
  form,
  setForm,
  currencies,
  onSubmit,
  submitting,
}: {
  form: PayoutAccountForm
  setForm: (f: PayoutAccountForm) => void
  currencies: ReturnType<typeof getSupportedCurrencies>
  onSubmit: () => void
  submitting: boolean
}) {
  const set = (key: keyof PayoutAccountForm, value: any) =>
    setForm({ ...form, [key]: value })

  return (
    <div className="space-y-4 pt-1">
      {/* Account type */}
      <div className="space-y-1.5">
        <Label className="text-xs">Account type *</Label>
        <Select
          value={form.accountType}
          onValueChange={v => set('accountType', v as AccountType)}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Select type…" />
          </SelectTrigger>
          <SelectContent className="bg-background text-foreground">
            <SelectItem value="bank_account">🏦 Bank Account (India)</SelectItem>
            <SelectItem value="upi">📱 UPI</SelectItem>
            <SelectItem value="paypal">🅿️ PayPal</SelectItem>
            <SelectItem value="wise">💙 Wise</SelectItem>
            <SelectItem value="swift">🌐 SWIFT / International</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Currency */}
      <div className="space-y-1.5">
        <Label className="text-xs">Currency *</Label>
        <Select value={form.currency} onValueChange={v => set('currency', v)}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-background text-foreground">
            {currencies.map(c => (
              <SelectItem key={c.code} value={c.code}>
                {c.symbol} {c.code} — {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Dynamic fields */}
      {form.accountType === 'bank_account' && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Account holder name *</Label>
            <Input
              value={form.accountHolderName}
              onChange={e => set('accountHolderName', e.target.value)}
              placeholder="Full name as on bank account"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Account number *</Label>
            <Input
              type="password"
              value={form.accountNumber}
              onChange={e => set('accountNumber', e.target.value)}
              placeholder="Account number"
              className="h-9 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">Stored encrypted. Only last 4 digits will be shown.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">IFSC code * (11 characters)</Label>
            <Input
              value={form.ifscCode}
              onChange={e => set('ifscCode', e.target.value.toUpperCase())}
              placeholder="e.g. HDFC0001234"
              maxLength={11}
              className="h-9 text-sm font-mono"
            />
          </div>
        </>
      )}

      {form.accountType === 'upi' && (
        <div className="space-y-1.5">
          <Label className="text-xs">UPI ID * (e.g. name@upi)</Label>
          <Input
            value={form.upiId}
            onChange={e => set('upiId', e.target.value)}
            placeholder="yourname@upi"
            className="h-9 text-sm"
          />
        </div>
      )}

      {form.accountType === 'paypal' && (
        <div className="space-y-1.5">
          <Label className="text-xs">PayPal email *</Label>
          <Input
            type="email"
            value={form.paypalEmail}
            onChange={e => set('paypalEmail', e.target.value)}
            placeholder="you@example.com"
            className="h-9 text-sm"
          />
        </div>
      )}

      {form.accountType === 'wise' && (
        <div className="space-y-1.5">
          <Label className="text-xs">Wise email *</Label>
          <Input
            type="email"
            value={form.wiseEmail}
            onChange={e => set('wiseEmail', e.target.value)}
            placeholder="you@example.com"
            className="h-9 text-sm"
          />
        </div>
      )}

      {form.accountType === 'swift' && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">SWIFT / BIC code * (8 or 11 chars)</Label>
            <Input
              value={form.swiftCode}
              onChange={e => set('swiftCode', e.target.value.toUpperCase())}
              placeholder="e.g. HDFCINBB"
              maxLength={11}
              className="h-9 text-sm font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">IBAN *</Label>
            <Input
              type="password"
              value={form.iban}
              onChange={e => set('iban', e.target.value.toUpperCase())}
              placeholder="IBAN number"
              className="h-9 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">Stored encrypted. Only last 4 digits will be shown.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Bank name *</Label>
            <Input
              value={form.bankName}
              onChange={e => set('bankName', e.target.value)}
              placeholder="Name of your bank"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Bank country *</Label>
            <Select value={form.bankCountry} onValueChange={v => set('bankCountry', v)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select country…" />
              </SelectTrigger>
              <SelectContent className="bg-background text-foreground">
                {COUNTRIES.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {/* Set as primary toggle */}
      {form.accountType && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isPrimary"
            checked={form.isPrimary}
            onChange={e => set('isPrimary', e.target.checked)}
            className="rounded"
          />
          <Label htmlFor="isPrimary" className="text-xs cursor-pointer">
            Set as primary account for {form.currency}
          </Label>
        </div>
      )}

      <Separator />

      <Button
        onClick={onSubmit}
        disabled={submitting || !form.accountType}
        className="w-full"
        size="sm"
      >
        {submitting ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : null}
        Add Account
      </Button>
    </div>
  )
}
