'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Pause, Play, Loader2, Ban } from 'lucide-react'
import { toast } from 'sonner'
import { setSurveyStatus, type SurveyLifecycleStatus } from '@/server/surveys/surveyService'

/**
 * Pause / resume / close a running survey.
 *
 * Surveys are LIVE ON CREATE — `createSurvey` sets `status:'active'` and
 * immediately fans out email + in-app notifications to matched consumers.
 * Until this control existed there was no off switch: a brand who published
 * with the wrong product, a typo, or at the wrong moment could not stop
 * further responses, and the notifications had already reached real inboxes.
 *
 * `status` is the source of truth; `isActive` is derived from it for display.
 */

const STATUS_META: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  active: { label: 'Active', variant: 'default' },
  paused: { label: 'Paused', variant: 'secondary' },
  closed: { label: 'Closed', variant: 'destructive' },
  draft: { label: 'Draft', variant: 'outline' },
}

export default function SurveyStatusControl({
  surveyId,
  initialStatus,
}: {
  surveyId: string
  /** From the DB. Falls back to 'active' for rows written before `status` was set. */
  initialStatus: string
}) {
  const [status, setStatus] = useState<string>(initialStatus || 'active')
  const [pending, startTransition] = useTransition()
  const [confirmClose, setConfirmClose] = useState(false)

  const meta = STATUS_META[status] ?? STATUS_META.active

  function apply(next: SurveyLifecycleStatus, successMessage: string) {
    const previous = status
    setStatus(next) // optimistic
    startTransition(async () => {
      try {
        await setSurveyStatus(surveyId, next)
        toast.success(successMessage)
      } catch (err: any) {
        setStatus(previous) // don't leave a wrong badge on screen
        toast.error(err?.message || 'Could not update the survey status')
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant={meta.variant}>{meta.label}</Badge>

      {status === 'active' ? (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => apply('paused', 'Survey paused — it no longer accepts responses')}
        >
          {pending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Pause className="w-4 h-4 mr-2" />}
          Pause
        </Button>
      ) : status !== 'closed' ? (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => apply('active', 'Survey resumed — it is accepting responses again')}
        >
          {pending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
          Resume
        </Button>
      ) : null}

      {status !== 'closed' && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          disabled={pending}
          onClick={() => setConfirmClose(true)}
        >
          <Ban className="w-4 h-4 mr-2" />
          Close
        </Button>
      )}

      {/* Close is confirmed because, unlike pause, this control offers no way
          back — a closed survey has no Resume button. Existing responses are
          untouched either way; only new ones stop. */}
      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close this survey permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              Closing stops the survey from accepting any further responses, and
              you won&apos;t be able to reopen it from here. Responses already
              collected are kept and stay visible in your analytics.
              <br />
              <br />
              If you only want to stop it temporarily, use <strong>Pause</strong> instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => apply('closed', 'Survey closed')}
            >
              Close survey
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
