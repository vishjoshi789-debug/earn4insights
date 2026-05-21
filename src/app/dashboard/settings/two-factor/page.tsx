import { TwoFactorSetupWizard } from '@/components/two-factor/TwoFactorSetupWizard'

/**
 * Two-factor authentication setup page — /dashboard/settings/two-factor.
 * The dashboard layout already enforces authentication; this page hosts
 * the multi-step setup wizard.
 */
export default function TwoFactorSetupPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Two-Factor Authentication</h1>
        <p className="mt-1 text-muted-foreground">
          Add a second step to your sign-in for stronger account security.
        </p>
      </div>
      <TwoFactorSetupWizard />
    </div>
  )
}
