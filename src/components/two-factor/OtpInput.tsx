'use client'

import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react'

/**
 * Segmented numeric code input — one box per digit. Auto-advances on
 * entry, supports backspace/arrow navigation, full-code paste, and fires
 * `onComplete` when every box is filled. Used by the 2FA setup wizard
 * and the login challenge page.
 */
type OtpInputProps = {
  value: string
  onChange: (value: string) => void
  onComplete?: (value: string) => void
  length?: number
  disabled?: boolean
  autoFocus?: boolean
}

export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  autoFocus = false,
}: OtpInputProps) {
  const inputs = useRef<Array<HTMLInputElement | null>>([])

  function emit(next: string) {
    onChange(next)
    if (next.length === length && /^\d+$/.test(next)) onComplete?.(next)
  }

  function handleChange(idx: number, raw: string) {
    const digit = raw.replace(/\D/g, '').slice(-1)
    if (!digit) return
    const arr = value.split('')
    arr[idx] = digit
    emit(arr.join('').slice(0, length))
    if (idx < length - 1) inputs.current[idx + 1]?.focus()
  }

  function handleKeyDown(idx: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      e.preventDefault()
      const arr = value.split('')
      if (arr[idx]) {
        arr[idx] = ''
        onChange(arr.join(''))
      } else if (idx > 0) {
        arr[idx - 1] = ''
        onChange(arr.join(''))
        inputs.current[idx - 1]?.focus()
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      inputs.current[idx - 1]?.focus()
    } else if (e.key === 'ArrowRight' && idx < length - 1) {
      inputs.current[idx + 1]?.focus()
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!pasted) return
    emit(pasted)
    inputs.current[Math.min(pasted.length, length - 1)]?.focus()
  }

  return (
    <div className="flex gap-2" role="group" aria-label={`${length}-digit code`}>
      {Array.from({ length }).map((_, idx) => (
        <input
          key={idx}
          ref={(el) => {
            inputs.current[idx] = el
          }}
          type="text"
          inputMode="numeric"
          autoComplete={idx === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          disabled={disabled}
          autoFocus={autoFocus && idx === 0}
          value={value[idx] || ''}
          onChange={(e) => handleChange(idx, e.target.value)}
          onKeyDown={(e) => handleKeyDown(idx, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          aria-label={`Digit ${idx + 1}`}
          className="h-14 w-12 rounded-lg border-2 border-input bg-background text-center text-2xl font-semibold tabular-nums focus:border-purple-500 focus:outline-none disabled:opacity-50"
        />
      ))}
    </div>
  )
}
