/**
 * Currency Utility
 *
 * Multi-currency formatting, minor-to-major conversion, and metadata.
 * Designed to be reused by Razorpay integration later.
 *
 * All amounts in the DB are stored in the smallest currency unit
 * (paise for INR, cents for USD, etc.). This module converts and
 * formats them for display.
 */

export type CurrencyCode =
  | 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED'
  | 'SGD' | 'AUD' | 'CAD' | 'JPY' | 'BRL'

interface CurrencyInfo {
  code: CurrencyCode
  symbol: string
  name: string
  /** Number of minor units per major unit (e.g. 100 for INR, 1 for JPY) */
  minorUnits: number
}

const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  INR: { code: 'INR', symbol: '₹',    name: 'Indian Rupee',        minorUnits: 100 },
  USD: { code: 'USD', symbol: '$',    name: 'US Dollar',           minorUnits: 100 },
  EUR: { code: 'EUR', symbol: '€',    name: 'Euro',                minorUnits: 100 },
  GBP: { code: 'GBP', symbol: '£',    name: 'British Pound',       minorUnits: 100 },
  AED: { code: 'AED', symbol: 'د.إ',  name: 'UAE Dirham',          minorUnits: 100 },
  SGD: { code: 'SGD', symbol: 'S$',   name: 'Singapore Dollar',    minorUnits: 100 },
  AUD: { code: 'AUD', symbol: 'A$',   name: 'Australian Dollar',   minorUnits: 100 },
  CAD: { code: 'CAD', symbol: 'CA$',  name: 'Canadian Dollar',     minorUnits: 100 },
  JPY: { code: 'JPY', symbol: '¥',    name: 'Japanese Yen',        minorUnits: 1   },
  BRL: { code: 'BRL', symbol: 'R$',   name: 'Brazilian Real',      minorUnits: 100 },
}

/**
 * Convert amount from smallest unit to major unit.
 * e.g. 15000 INR paise → 150.00, 1500 JPY → 1500
 */
export function convertToMajor(amount: number, currencyCode: string): number {
  const info = CURRENCIES[currencyCode as CurrencyCode]
  const divisor = info?.minorUnits ?? 100
  return amount / divisor
}

/**
 * Convert amount from major unit to smallest unit.
 * e.g. 150.00 INR → 15000 paise
 */
export function convertToMinor(amount: number, currencyCode: string): number {
  const info = CURRENCIES[currencyCode as CurrencyCode]
  const multiplier = info?.minorUnits ?? 100
  return Math.round(amount * multiplier)
}

/**
 * Format an amount (in smallest currency unit) for display.
 *
 * @param amount   - Amount in smallest unit (paise, cents, etc.)
 * @param currencyCode - ISO 4217 currency code
 * @param locale   - BCP 47 locale (defaults to currency-appropriate locale)
 */
export function formatCurrency(
  amount: number,
  currencyCode: string = 'INR',
  locale?: string,
): string {
  const code = currencyCode as CurrencyCode
  const major = convertToMajor(amount, code)
  const info = CURRENCIES[code]

  // Pick a sensible default locale per currency
  const defaultLocale = LOCALE_MAP[code] ?? 'en-US'
  const resolvedLocale = locale ?? defaultLocale

  const fractionDigits = info && info.minorUnits === 1 ? 0 : 2

  return new Intl.NumberFormat(resolvedLocale, {
    style: 'currency',
    currency: code in CURRENCIES ? code : 'INR',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(major)
}

const LOCALE_MAP: Partial<Record<CurrencyCode, string>> = {
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
  AED: 'ar-AE',
  SGD: 'en-SG',
  AUD: 'en-AU',
  CAD: 'en-CA',
  JPY: 'ja-JP',
  BRL: 'pt-BR',
}

/**
 * Returns all supported currencies with metadata.
 */
export function getSupportedCurrencies(): CurrencyInfo[] {
  return Object.values(CURRENCIES)
}

/**
 * Check if a currency code is supported.
 */
export function isSupportedCurrency(code: string): code is CurrencyCode {
  return code in CURRENCIES
}
