'use client'

import * as React from 'react'
import { Eye, EyeOff, Check, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  PASSWORD_RULES,
  validatePassword,
  getPasswordStrength,
  type PasswordStrength,
} from '@/lib/auth/passwordPolicy'

type BaseInputProps = Omit<React.ComponentProps<'input'>, 'type'>

export type PasswordInputProps = BaseInputProps & {
  // Render the 5-rule checklist below the field. Use on the primary
  // signup field; skip on confirm-password and on login.
  showChecklist?: boolean
  // Render the 4-segment strength bar above the checklist. Same callsite
  // rule — primary signup field only.
  showStrength?: boolean
  // Used to wire aria-describedby to any external error message.
  errorId?: string
}

const STRENGTH_LABEL: Record<PasswordStrength, string> = {
  empty: '',
  weak: 'Weak',
  medium: 'Medium',
  strong: 'Strong',
}

const STRENGTH_SEGMENTS: Record<PasswordStrength, number> = {
  empty: 0,
  weak: 1,
  medium: 3,
  strong: 4,
}

const STRENGTH_COLOR: Record<PasswordStrength, string> = {
  empty: 'bg-muted',
  weak: 'bg-red-500',
  medium: 'bg-amber-500',
  strong: 'bg-green-500',
}

const STRENGTH_TEXT_COLOR: Record<PasswordStrength, string> = {
  empty: 'text-muted-foreground',
  weak: 'text-red-600 dark:text-red-400',
  medium: 'text-amber-600 dark:text-amber-400',
  strong: 'text-green-600 dark:text-green-400',
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(
    { showChecklist = false, showStrength = false, errorId, className, value, ...props },
    ref,
  ) {
    const [visible, setVisible] = React.useState(false)
    const stringValue = typeof value === 'string' ? value : ''
    const validation = React.useMemo(() => validatePassword(stringValue), [stringValue])
    const strength = React.useMemo(() => getPasswordStrength(stringValue), [stringValue])

    return (
      <div className="space-y-2">
        <div className="relative">
          <Input
            ref={ref}
            type={visible ? 'text' : 'password'}
            value={value}
            aria-describedby={errorId}
            className={cn('pr-10', className)}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            disabled={props.disabled}
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
            tabIndex={-1}
            className="absolute inset-y-0 right-0 flex items-center justify-center w-10 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-r-md"
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {showStrength && stringValue.length > 0 && (
          <div className="space-y-1" aria-live="polite">
            <div className="flex gap-1">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-colors',
                    i < STRENGTH_SEGMENTS[strength] ? STRENGTH_COLOR[strength] : 'bg-muted',
                  )}
                />
              ))}
            </div>
            <p className={cn('text-xs font-medium', STRENGTH_TEXT_COLOR[strength])}>
              {STRENGTH_LABEL[strength]}
            </p>
          </div>
        )}

        {showChecklist && (
          <ul className="space-y-1" aria-label="Password requirements">
            {PASSWORD_RULES.map((rule) => {
              const met = validation.met.some((r) => r.id === rule.id)
              return (
                <li
                  key={rule.id}
                  className={cn(
                    'flex items-center gap-2 text-xs transition-colors',
                    met ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground',
                  )}
                >
                  {met ? (
                    <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <X className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden="true" />
                  )}
                  <span>{rule.label}</span>
                  <span className="sr-only">{met ? ' — met' : ' — not yet met'}</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    )
  },
)
