import { NotificationInbox } from '@/components/notifications/NotificationInbox'

export default function NotificationsPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-headline font-semibold">Notifications</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your notification history — kept for 90 days.
        </p>
      </div>
      <NotificationInbox />
    </div>
  )
}
